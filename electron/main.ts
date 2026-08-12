import { app, BrowserWindow, dialog, ipcMain, protocol } from "electron";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { exportClip } from "./export/clipExportService";
import { inspectVideoFile } from "./media/videoInspectionService";
import {
  createOrReuseWorkingCopy,
  findExistingWorkingCopyForSource,
  findReusableWorkingCopy
} from "./media/videoWorkingCopyService";
import { runPlayerTracking } from "./tracking/runTracking";
import type {
  AppSettings,
  AppStore,
  ClipExportRequest,
  ClipRecord,
  ManualTrackSeed,
  StoredMatch,
  StoredVideo,
  Team,
  VideoFile,
  VideoWorkingCopyProgress,
  VideoTag
} from "../shared/types";

type TagStore = {
  teams?: Team[];
  videos?: Record<string, StoredVideo | VideoTag[]>;
  clips?: ClipRecord[];
  matches?: StoredMatch[];
  settings?: AppSettings;
};

const isDev = !app.isPackaged;
const mediaScheme = "clipboard-coach-video";

protocol.registerSchemesAsPrivileged([
  {
    scheme: mediaScheme,
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true
    }
  }
]);

function getStorePath() {
  return path.join(app.getPath("userData"), "tags.json");
}

function getBackupStorePath() {
  return path.join(app.getPath("userData"), "tags.backup.json");
}

let sessionBackupCreated = false;

async function atomicWriteFile(filePath: string, contents: string) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(directory, `tags.${process.pid}.${Date.now()}.tmp`);
  const fileHandle = await fs.open(temporaryPath, "w");
  let renamed = false;

  try {
    await fileHandle.writeFile(contents, "utf-8");
    await fileHandle.sync();
    await fileHandle.close();
    await fs.rename(temporaryPath, filePath);
    renamed = true;
  } catch (error) {
    await fileHandle.close().catch(() => undefined);
    throw error;
  } finally {
    if (!renamed) {
      await fs.rm(temporaryPath, { force: true });
    }
  }
}

async function createSessionBackup(rawStore: string) {
  if (sessionBackupCreated) {
    return;
  }

  try {
    await atomicWriteFile(getBackupStorePath(), rawStore);
    sessionBackupCreated = true;
  } catch (error) {
    console.warn("Unable to create session backup for tag store:", error);
  }
}

async function readStore(): Promise<TagStore> {
  try {
    const raw = await fs.readFile(getStorePath(), "utf-8");
    const parsed = JSON.parse(raw) as TagStore;
    await createSessionBackup(raw);
    return {
      teams: parsed.teams ?? [],
      videos: parsed.videos ?? {},
      clips: parsed.clips ?? [],
      matches: parsed.matches ?? [],
      settings: parsed.settings
    };
  } catch {
    return { teams: [], videos: {}, clips: [], matches: [], settings: undefined };
  }
}

function normalizeTags(tags: VideoTag[]) {
  return tags.map((tag) => ({
    ...tag,
    startTime: tag.startTime ?? tag.time,
    endTime: tag.endTime ?? (tag.startTime ?? tag.time) + 5
  }));
}

function normalizeTeams(teams: Team[] = []) {
  return teams.map((team) => ({
    ...team,
    players: (team.players ?? []).map((player) => {
      if (player.firstName || player.lastName) {
        return player;
      }

      const nameParts = (player.name ?? "").trim().split(/\s+/).filter(Boolean);
      return {
        ...player,
        firstName: nameParts[0] ?? "",
        lastName: nameParts.slice(1).join(" ")
      };
    })
  }));
}

function normalizeStore(store: TagStore): AppStore {
  const videos: Record<string, StoredVideo> = {};

  for (const [videoPath, value] of Object.entries(store.videos ?? {})) {
    if (Array.isArray(value)) {
      videos[videoPath] = {
        path: videoPath,
        name: path.basename(videoPath),
        extension: path.extname(videoPath).toLowerCase(),
        lastOpenedAt: new Date().toISOString(),
        tags: normalizeTags(value),
        matchState: undefined,
        matchInfo: undefined,
        kickoffVideoOffset: undefined,
        blockEndVideoOffset: undefined,
        matchId: undefined,
        matchBlockNumber: undefined,
        matchBlockLabel: undefined,
        matchBlockStartMinute: undefined,
        originalSourcePath: undefined,
        playbackPath: undefined,
        compatibleWorkingCopyPath: undefined,
        mediaInfo: undefined,
        workingCopy: undefined
      };
    } else {
      videos[videoPath] = {
        path: value.path ?? videoPath,
        name: value.name ?? path.basename(videoPath),
        extension: value.extension ?? path.extname(videoPath).toLowerCase(),
        lastOpenedAt: value.lastOpenedAt ?? new Date().toISOString(),
        tags: normalizeTags(value.tags ?? []),
        matchState: value.matchState
          ? {
              teamId: value.matchState.teamId,
              teamName: value.matchState.teamName,
              players: value.matchState.players ?? []
            }
          : undefined,
        matchInfo: value.matchInfo,
        kickoffVideoOffset: value.kickoffVideoOffset,
        blockEndVideoOffset: value.blockEndVideoOffset,
        matchId: value.matchId,
        matchBlockNumber: value.matchBlockNumber,
        matchBlockLabel: value.matchBlockLabel,
        matchBlockStartMinute: value.matchBlockStartMinute,
        calibration: value.calibration,
        tracking: value.tracking,
        originalSourcePath: value.originalSourcePath ?? value.path ?? videoPath,
        playbackPath: value.playbackPath,
        compatibleWorkingCopyPath: value.compatibleWorkingCopyPath ?? value.workingCopy?.playbackPath,
        mediaInfo: value.mediaInfo,
        workingCopy: value.workingCopy
      };
    }
  }

  return {
    teams: normalizeTeams(store.teams ?? []),
    videos,
    matches: (store.matches ?? []).map((match) => {
      const legacyMatch = match as StoredMatch & {
        homeTeam?: string;
        awayTeam?: string;
        selectedPlayerIds?: string[];
      };

      return {
        id: match.id,
        date: match.date ?? "",
        startTime: match.startTime,
        teamAName: match.teamAName ?? legacyMatch.homeTeam ?? "",
        teamBName: match.teamBName ?? legacyMatch.awayTeam ?? "",
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        selectedTeamAPlayerIds: match.selectedTeamAPlayerIds ?? legacyMatch.selectedPlayerIds ?? [],
        selectedTeamBPlayerIds: match.selectedTeamBPlayerIds ?? [],
        videoBlockIds: match.videoBlockIds ?? [],
        createdAt: match.createdAt ?? new Date().toISOString(),
        updatedAt: match.updatedAt ?? match.createdAt ?? new Date().toISOString(),
        lastOpenedAt: match.lastOpenedAt
      };
    }),
    clips: (store.clips ?? []).map((clip) => {
      const rawAudience = clip.intendedAudience as { type?: string; teamId?: string; teamName?: string } | undefined;
      const staffOnlyAudience = rawAudience?.type === "staff";

      return {
        ...clip,
        teamId: clip.teamId ?? rawAudience?.teamId,
        teamName: clip.teamName ?? rawAudience?.teamName,
        selectedTagIds: clip.selectedTagIds ?? [],
        tagNames: clip.tagNames ?? [],
        tagSnapshots: clip.tagSnapshots ?? [],
        intendedAudience: staffOnlyAudience ? undefined : clip.intendedAudience,
        exportStatus: clip.exportStatus ?? "prepared_only",
        localClipPath: clip.localClipPath ?? null,
        shareUrl: clip.shareUrl ?? null,
        uploadStatus: clip.uploadStatus ?? "not_uploaded",
        missingExportFile: clip.missingExportFile ?? true,
        missingSourceVideo: clip.missingSourceVideo ?? false,
        shareWithStaff: staffOnlyAudience ? true : clip.shareWithStaff ?? false
      };
    }),
    settings: {
      standardTags: store.settings?.standardTags?.length ? store.settings.standardTags : ["Start", "Goal"],
      lastSelectedTeamId: store.settings?.lastSelectedTeamId,
      activeMatchTeamId: store.settings?.activeMatchTeamId,
      activeMatchPlayerIds: store.settings?.activeMatchPlayerIds ?? [],
      playerNameOrder: store.settings?.playerNameOrder ?? "first_last",
      theme: store.settings?.theme ?? "dark"
    }
  };
}

async function readAppStore(): Promise<AppStore> {
  return normalizeStore(await readStore());
}

async function writeStore(store: AppStore) {
  await fs.mkdir(path.dirname(getStorePath()), { recursive: true });
  await atomicWriteFile(getStorePath(), JSON.stringify(store, null, 2));
}

function getStoredVideosForSource(store: AppStore, sourcePath: string) {
  return Object.entries(store.videos).filter(([, storedVideo]) => storedVideo.path === sourcePath);
}

function getExistingWorkingCopy(store: AppStore, sourcePath: string) {
  return getStoredVideosForSource(store, sourcePath).find(([, storedVideo]) => storedVideo.workingCopy)?.[1].workingCopy;
}

function getStoredVideoForSourceOrKey(store: AppStore, sourcePathOrKey: string) {
  return store.videos[sourcePathOrKey] ?? Object.values(store.videos).find((storedVideo) => storedVideo.path === sourcePathOrKey);
}

async function pathExists(filePath?: string | null) {
  if (!filePath) {
    return false;
  }

  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatInspectionDetails(mediaInfo: Awaited<ReturnType<typeof inspectVideoFile>>) {
  const video = mediaInfo.video;
  const audio = mediaInfo.audio;
  const size = video?.width && video?.height ? `${video.width}x${video.height}` : "unknown size";
  const frameRate = video?.frameRate ? `${video.frameRate} fps` : "unknown frame rate";

  return [
    `Video: ${video?.codec ?? "unknown"}${video?.profile ? ` (${video.profile})` : ""}`,
    `Pixel format: ${video?.pixelFormat ?? "unknown"}`,
    `Size: ${size}`,
    `Frame rate: ${frameRate}`,
    `Duration: ${mediaInfo.durationSeconds ? `${mediaInfo.durationSeconds.toFixed(1)}s` : "unknown"}`,
    `Audio: ${audio?.codec ?? "none detected"}`,
    mediaInfo.compatibilityReason ? `Reason: ${mediaInfo.compatibilityReason}` : ""
  ].filter(Boolean).join("\n");
}

async function updateVideoPlaybackMetadata(
  store: AppStore,
  sourcePath: string,
  videoFile: VideoFile,
  baseRecord: StoredVideo
) {
  const matchingEntries = getStoredVideosForSource(store, sourcePath);
  const nextRecord = (storedVideo: StoredVideo): StoredVideo => ({
    ...storedVideo,
    path: sourcePath,
    originalSourcePath: sourcePath,
    name: storedVideo.name ?? videoFile.name,
    extension: storedVideo.extension ?? videoFile.extension,
    lastOpenedAt: new Date().toISOString(),
    playbackPath: videoFile.playbackPath,
    compatibleWorkingCopyPath: videoFile.compatibleWorkingCopyPath,
    mediaInfo: videoFile.mediaInfo,
    workingCopy: videoFile.workingCopy
  });

  if (!store.videos[sourcePath]) {
    store.videos[sourcePath] = nextRecord(baseRecord);
  }

  for (const [videoKey, storedVideo] of getStoredVideosForSource(store, sourcePath)) {
    store.videos[videoKey] = nextRecord(storedVideo);
  }
}

async function prepareVideoFileForPlayback(
  filePath: string,
  store: AppStore,
  onWorkingCopyProgress?: (progress: VideoWorkingCopyProgress) => void
): Promise<VideoFile | null> {
  const storedVideo = getStoredVideoForSourceOrKey(store, filePath);
  const sourcePath = storedVideo?.path ?? filePath;
  const sourceExists = await pathExists(sourcePath);
  const storedWorkingCopyPath = storedVideo?.workingCopy?.playbackPath ?? storedVideo?.compatibleWorkingCopyPath ?? storedVideo?.playbackPath;
  const storedWorkingCopyExists = !!storedWorkingCopyPath && storedWorkingCopyPath !== sourcePath && await pathExists(storedWorkingCopyPath);

  if (!sourceExists) {
    if (storedWorkingCopyExists && storedWorkingCopyPath) {
      return {
        path: sourcePath,
        originalSourcePath: sourcePath,
        name: storedVideo?.name ?? path.basename(sourcePath),
        extension: storedVideo?.extension ?? path.extname(sourcePath).toLowerCase(),
        url: getMediaUrl(storedWorkingCopyPath),
        playbackPath: storedWorkingCopyPath,
        compatibleWorkingCopyPath: storedWorkingCopyPath,
        mediaInfo: storedVideo?.mediaInfo,
        workingCopy: storedVideo?.workingCopy
      };
    }

    await fs.access(sourcePath);
  }

  const fileExtension = path.extname(sourcePath).toLowerCase();
  const mediaInfo = await inspectVideoFile(sourcePath);
  const existingWorkingCopy = getExistingWorkingCopy(store, sourcePath);
  const reusableWorkingCopy = mediaInfo.directPlaybackLikelySupported
    ? null
    : await findReusableWorkingCopy(existingWorkingCopy, sourcePath, mediaInfo);
  const deterministicWorkingCopy = !mediaInfo.directPlaybackLikelySupported && !reusableWorkingCopy
    ? await findExistingWorkingCopyForSource(sourcePath, app.getPath("userData"), mediaInfo)
    : null;
  let playbackPath = sourcePath;
  let workingCopy = reusableWorkingCopy ?? deterministicWorkingCopy ?? undefined;

  if (!mediaInfo.directPlaybackLikelySupported && !workingCopy) {
    const choice = await dialog.showMessageBox({
      type: "warning",
      buttons: ["Create Working Copy", "Use Original", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      title: "Create compatible working copy?",
      message: "This video may not play reliably in Clipboard Coach Studio.",
      detail: `${formatInspectionDetails(mediaInfo)}\n\nThe original file will not be modified. A compatible H.264 MP4 working copy can be created for playback and review.`
    });

    if (choice.response === 2) {
      return null;
    }

    if (choice.response === 0) {
      const result = await createOrReuseWorkingCopy({
        sourcePath,
        userDataPath: app.getPath("userData"),
        mediaInfo,
        existingWorkingCopy,
        onProgress: onWorkingCopyProgress
      });
      workingCopy = result.workingCopy;
    }
  }

  if (workingCopy) {
    playbackPath = workingCopy.playbackPath;
  }

  return {
    path: sourcePath,
    originalSourcePath: sourcePath,
    name: path.basename(sourcePath),
    extension: fileExtension,
    url: getMediaUrl(playbackPath),
    playbackPath,
    compatibleWorkingCopyPath: workingCopy?.playbackPath,
    mediaInfo,
    workingCopy
  };
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    icon: path.join(__dirname, "../assets/branding/svs-app.ico"),
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    window.loadURL("http://127.0.0.1:5173");
  } else {
    window.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function getMediaUrl(filePath: string) {
  const encodedPath = Buffer.from(filePath, "utf-8").toString("base64url");
  return `${mediaScheme}://local/${encodedPath}`;
}

function getVideoContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".ogg":
    case ".ogv":
      return "video/ogg";
    default:
      return "application/octet-stream";
  }
}

app.whenReady().then(() => {
  protocol.handle(mediaScheme, async (request) => {
    const requestUrl = new URL(request.url);
    const encodedPath = requestUrl.pathname.slice(1);
    const filePath = Buffer.from(encodedPath, "base64url").toString("utf-8");

    try {
      const stats = await fs.stat(filePath);
      const rangeHeader = request.headers.get("range");
      const contentType = getVideoContentType(filePath);

      if (rangeHeader) {
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
        const start = match?.[1] ? Number.parseInt(match[1], 10) : 0;
        const end = match?.[2] ? Number.parseInt(match[2], 10) : stats.size - 1;
        const safeEnd = Math.min(end, stats.size - 1);
        const chunkSize = safeEnd - start + 1;

        if (start >= stats.size || safeEnd < start) {
          return new Response(null, {
            status: 416,
            headers: {
              "content-range": `bytes */${stats.size}`
            }
          });
        }

        return new Response(
          Readable.toWeb(createReadStream(filePath, { start, end: safeEnd })) as ReadableStream,
          {
            status: 206,
            headers: {
              "accept-ranges": "bytes",
              "content-length": String(chunkSize),
              "content-range": `bytes ${start}-${safeEnd}/${stats.size}`,
              "content-type": contentType,
              "access-control-allow-origin": "*"
            }
          }
        );
      }

      return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
        status: 200,
        headers: {
          "accept-ranges": "bytes",
          "content-length": String(stats.size),
          "content-type": contentType,
          "access-control-allow-origin": "*"
        }
      });
    } catch (error) {
      console.error("Unable to load selected video file:", filePath, error);
      return new Response("Video file could not be loaded.", {
        status: 404,
        headers: { "content-type": "text/plain" }
      });
    }
  });

  ipcMain.handle("app:quit", () => { app.quit(); });

  ipcMain.handle("video:open", async (event) => {
    const result = await dialog.showOpenDialog({
      title: "Open a video file",
      properties: ["openFile"],
      filters: [
        {
          name: "Video files",
          extensions: ["mp4", "mov", "m4v", "webm", "ogg", "avi", "mkv"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const store = await readAppStore();
    const videoFile = await prepareVideoFileForPlayback(filePath, store, (progress) => {
      event.sender.send("video:working-copy:progress", progress);
    });

    if (!videoFile) {
      return null;
    }

    const existingVideo = store.videos[filePath];

    await updateVideoPlaybackMetadata(store, filePath, videoFile, {
      path: filePath,
      name: videoFile.name,
      extension: videoFile.extension,
      lastOpenedAt: new Date().toISOString(),
      tags: existingVideo?.tags ?? [],
      matchState: existingVideo?.matchState,
      matchInfo: existingVideo?.matchInfo,
      kickoffVideoOffset: existingVideo?.kickoffVideoOffset,
      blockEndVideoOffset: existingVideo?.blockEndVideoOffset,
      matchId: existingVideo?.matchId,
      matchBlockNumber: existingVideo?.matchBlockNumber,
      matchBlockLabel: existingVideo?.matchBlockLabel,
      matchBlockStartMinute: existingVideo?.matchBlockStartMinute
    });
    await writeStore(store);

    return videoFile;
  });

  ipcMain.handle("video:fromPath", async (_event, filePath: string) => {
    const store = await readAppStore();
    const videoFile = await prepareVideoFileForPlayback(filePath, store, (progress) => {
      _event.sender.send("video:working-copy:progress", progress);
    });

    if (!videoFile) {
      throw new Error("Video open cancelled.");
    }

    const existingVideo = store.videos[filePath];
    await updateVideoPlaybackMetadata(store, filePath, videoFile, {
      path: filePath,
      name: existingVideo?.name ?? videoFile.name,
      extension: existingVideo?.extension ?? videoFile.extension,
      lastOpenedAt: new Date().toISOString(),
      tags: existingVideo?.tags ?? [],
      matchState: existingVideo?.matchState,
      matchInfo: existingVideo?.matchInfo,
      kickoffVideoOffset: existingVideo?.kickoffVideoOffset,
      blockEndVideoOffset: existingVideo?.blockEndVideoOffset,
      matchId: existingVideo?.matchId,
      matchBlockNumber: existingVideo?.matchBlockNumber,
      matchBlockLabel: existingVideo?.matchBlockLabel,
      matchBlockStartMinute: existingVideo?.matchBlockStartMinute
    });
    await writeStore(store);

    return videoFile;
  });

  ipcMain.handle("store:load", async () => {
    const store = await readAppStore();
    const videos = Object.fromEntries(
      await Promise.all(
        Object.entries(store.videos).map(async ([videoPath, storedVideo]) => {
          const sourceAvailable = await pathExists(storedVideo.path);
          const workingCopyPath =
            storedVideo.workingCopy?.playbackPath ?? storedVideo.compatibleWorkingCopyPath ?? storedVideo.playbackPath;
          const workingCopyAvailable = workingCopyPath !== storedVideo.path && await pathExists(workingCopyPath);

          return [videoPath, { ...storedVideo, missing: !sourceAvailable && !workingCopyAvailable }];
        })
      )
    );
    const clips = await Promise.all(
      store.clips.map(async (clip) => {
        let missingSourceVideo = false;

        if (clip.sourceVideoPath) {
          try {
            await fs.access(clip.sourceVideoPath);
          } catch {
            missingSourceVideo = true;
          }
        }

        try {
          if (!clip.filePath && !clip.localClipPath) {
            return { ...clip, missing: true, missingExportFile: true, missingSourceVideo };
          }

          await fs.access(clip.localClipPath ?? clip.filePath);
          return { ...clip, missing: false, missingSourceVideo };
        } catch {
          return { ...clip, missing: true, missingSourceVideo };
        }
      })
    );

    return { ...store, videos, clips };
  });

  ipcMain.handle("store:save", async (_event, store: AppStore) => {
    await writeStore(normalizeStore(store));
    return readAppStore();
  });

  ipcMain.handle("tags:load", async (_event, videoPath: string) => {
    const store = await readAppStore();
    return store.videos[videoPath]?.tags ?? [];
  });

  ipcMain.handle("tags:save", async (_event, videoPath: string, tags: VideoTag[]) => {
    const store = await readAppStore();
    const existingVideo = store.videos[videoPath];

    store.videos[videoPath] = {
      path: existingVideo?.path ?? videoPath,
      name: existingVideo?.name ?? path.basename(existingVideo?.path ?? videoPath),
      extension: existingVideo?.extension ?? path.extname(existingVideo?.path ?? videoPath).toLowerCase(),
      lastOpenedAt: new Date().toISOString(),
      tags: normalizeTags(tags),
      matchState: existingVideo?.matchState,
      matchInfo: existingVideo?.matchInfo,
      kickoffVideoOffset: existingVideo?.kickoffVideoOffset,
      blockEndVideoOffset: existingVideo?.blockEndVideoOffset,
      matchId: existingVideo?.matchId,
      matchBlockNumber: existingVideo?.matchBlockNumber,
      matchBlockLabel: existingVideo?.matchBlockLabel,
      matchBlockStartMinute: existingVideo?.matchBlockStartMinute,
      originalSourcePath: existingVideo?.originalSourcePath ?? existingVideo?.path ?? videoPath,
      playbackPath: existingVideo?.playbackPath,
      compatibleWorkingCopyPath: existingVideo?.compatibleWorkingCopyPath,
      mediaInfo: existingVideo?.mediaInfo,
      workingCopy: existingVideo?.workingCopy
    };
    await writeStore(store);
    return store.videos[videoPath].tags;
  });

  ipcMain.handle(
    "tracking:run",
    async (
      event,
      videoKey: string,
      request: { startSeconds: number; endSeconds: number; seeds: ManualTrackSeed[] }
    ) => {
      const store = await readAppStore();
      const existingVideo = store.videos[videoKey];

      if (!existingVideo) {
        throw new Error("Video not found in store.");
      }

      const sourcePath = existingVideo.playbackPath ?? existingVideo.path;
      const result = await runPlayerTracking({
        sourcePath,
        userDataPath: app.getPath("userData"),
        startSeconds: request.startSeconds,
        endSeconds: request.endSeconds,
        seeds: request.seeds,
        onProgress: (progress) => {
          event.sender.send("tracking:progress", { videoKey, ...progress });
        }
      });

      store.videos[videoKey] = { ...existingVideo, tracking: result };
      await writeStore(store);
      return result;
    }
  );

  ipcMain.handle("clip:export", async (event, request: ClipExportRequest) => {
    const saveDialogResult = await dialog.showSaveDialog({
      title: "Export clip",
      defaultPath: path.join(app.getPath("downloads"), request.suggestedName),
      filters: [{ name: "MP4 video", extensions: ["mp4"] }]
    });

    if (saveDialogResult.canceled || !saveDialogResult.filePath) {
      return null;
    }

    const result = await exportClip(request, saveDialogResult.filePath, (progress) => {
      event.sender.send("clip:export:progress", progress);
    });
    const store = await readAppStore();
    const existingClip = store.clips.find((clip) => clip.id === result.clipId);

    if (existingClip) {
      const nextClips = store.clips.map((clip) =>
        clip.id === result.clipId
          ? ({
              ...clip,
              filePath: result.filePath,
              localClipPath: result.filePath,
              exportStatus: "exported",
              missingExportFile: false,
              missing: false
            } satisfies ClipRecord)
          : clip
      );
      await writeStore({ ...store, clips: nextClips });
    }

    return result;
  });

  ipcMain.handle(
    "clip:saveAs",
    async (_event, payload: { sourcePath: string; suggestedName: string }) => {
      const result = await dialog.showSaveDialog({
        title: "Save clip as",
        defaultPath: payload.suggestedName,
        filters: [{ name: "MP4 video", extensions: ["mp4"] }]
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      await fs.copyFile(payload.sourcePath, result.filePath);
      return result.filePath;
    }
  );

  ipcMain.handle(
    "drawing:saveAs",
    async (_event, payload: { dataUrl: string; suggestedName: string }) => {
      const result = await dialog.showSaveDialog({
        title: "Save drawing as",
        defaultPath: path.join(app.getPath("downloads"), payload.suggestedName),
        filters: [{ name: "PNG image", extensions: ["png"] }]
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      const base64Data = payload.dataUrl.replace(/^data:image\/png;base64,/, "");
      await fs.writeFile(result.filePath, Buffer.from(base64Data, "base64"));
      return result.filePath;
    }
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
