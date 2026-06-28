import { app, BrowserWindow, dialog, ipcMain, protocol } from "electron";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

type VideoTag = {
  id: string;
  time: number;
  startTime?: number;
  endTime?: number;
  label: string;
  color?: string;
  createdAt: string;
};

type TagStore = {
  teams?: Team[];
  videos?: Record<string, StoredVideo | VideoTag[]>;
  clips?: ClipRecord[];
};

type Team = {
  id: string;
  name: string;
  players: Player[];
  createdAt: string;
};

type Player = {
  id: string;
  name: string;
  createdAt: string;
};

type StoredVideo = {
  path: string;
  name: string;
  extension: string;
  lastOpenedAt: string;
  tags: VideoTag[];
};

type ClipRecord = {
  id: string;
  name: string;
  filePath: string;
  sourceVideoPath?: string;
  startTime?: number;
  endTime?: number;
  createdAt: string;
  missing?: boolean;
};

type AppStore = {
  teams: Team[];
  videos: Record<string, StoredVideo>;
  clips: ClipRecord[];
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

async function readStore(): Promise<TagStore> {
  try {
    const raw = await fs.readFile(getStorePath(), "utf-8");
    const parsed = JSON.parse(raw) as TagStore;
    return {
      teams: parsed.teams ?? [],
      videos: parsed.videos ?? {},
      clips: parsed.clips ?? []
    };
  } catch {
    return { teams: [], videos: {}, clips: [] };
  }
}

function normalizeTags(tags: VideoTag[]) {
  return tags.map((tag) => ({
    ...tag,
    startTime: tag.startTime ?? tag.time,
    endTime: tag.endTime ?? tag.time
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
        tags: normalizeTags(value)
      };
    } else {
      videos[videoPath] = {
        path: value.path ?? videoPath,
        name: value.name ?? path.basename(videoPath),
        extension: value.extension ?? path.extname(videoPath).toLowerCase(),
        lastOpenedAt: value.lastOpenedAt ?? new Date().toISOString(),
        tags: normalizeTags(value.tags ?? [])
      };
    }
  }

  return {
    teams: store.teams ?? [],
    videos,
    clips: store.clips ?? []
  };
}

async function readAppStore(): Promise<AppStore> {
  return normalizeStore(await readStore());
}

async function writeStore(store: AppStore) {
  await fs.mkdir(path.dirname(getStorePath()), { recursive: true });
  await fs.writeFile(getStorePath(), JSON.stringify(store, null, 2), "utf-8");
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    icon: path.join(__dirname, "../assets/app-icon.ico"),
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
              "content-type": contentType
            }
          }
        );
      }

      return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
        status: 200,
        headers: {
          "accept-ranges": "bytes",
          "content-length": String(stats.size),
          "content-type": contentType
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

  ipcMain.handle("video:open", async () => {
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
    const fileExtension = path.extname(filePath).toLowerCase();
    const videoFile = {
      path: filePath,
      name: path.basename(filePath),
      extension: fileExtension,
      url: getMediaUrl(filePath)
    };
    const store = await readAppStore();
    const existingVideo = store.videos[filePath];

    store.videos[filePath] = {
      path: filePath,
      name: videoFile.name,
      extension: fileExtension,
      lastOpenedAt: new Date().toISOString(),
      tags: existingVideo?.tags ?? []
    };
    await writeStore(store);

    return videoFile;
  });

  ipcMain.handle("video:fromPath", async (_event, filePath: string) => {
    const fileExtension = path.extname(filePath).toLowerCase();

    await fs.access(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      extension: fileExtension,
      url: getMediaUrl(filePath)
    };
  });

  ipcMain.handle("store:load", async () => {
    const store = await readAppStore();
    const clips = await Promise.all(
      store.clips.map(async (clip) => {
        try {
          await fs.access(clip.filePath);
          return { ...clip, missing: false };
        } catch {
          return { ...clip, missing: true };
        }
      })
    );

    return { ...store, clips };
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
      path: videoPath,
      name: existingVideo?.name ?? path.basename(videoPath),
      extension: existingVideo?.extension ?? path.extname(videoPath).toLowerCase(),
      lastOpenedAt: new Date().toISOString(),
      tags: normalizeTags(tags)
    };
    await writeStore(store);
    return store.videos[videoPath].tags;
  });

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
