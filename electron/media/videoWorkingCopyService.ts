import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { VideoInspectionResult, VideoWorkingCopy, VideoWorkingCopyProgress } from "../../shared/types";
import { runFfmpeg, hasFfmpegEncoder } from "../export/ffmpegRunner";
import { getEvenDimensionScaleFilter } from "../export/filters/drawingOverlayFilter";
import { inspectVideoFile } from "./videoInspectionService";

type WorkingCopyRequest = {
  sourcePath: string;
  userDataPath: string;
  mediaInfo: VideoInspectionResult;
  existingWorkingCopy?: VideoWorkingCopy;
  onProgress?: (progress: VideoWorkingCopyProgress) => void;
};

export type WorkingCopyResult = {
  workingCopy: VideoWorkingCopy;
  reused: boolean;
  nvencAvailable: boolean;
};

async function getSourceSignature(sourcePath: string) {
  const stats = await fs.stat(sourcePath);
  return {
    size: stats.size,
    modifiedMs: stats.mtimeMs
  };
}

function getWorkingCopyPath(userDataPath: string, sourcePath: string, sourceSize: number, sourceModifiedMs: number) {
  const id = crypto
    .createHash("sha256")
    .update(`${sourcePath}:${sourceSize}:${sourceModifiedMs}`)
    .digest("hex")
    .slice(0, 24);

  return path.join(userDataPath, "working-copies", `${id}.h264.mp4`);
}

function getTemporaryWorkingCopyPath(playbackPath: string) {
  return `${playbackPath}.${process.pid}.${Date.now()}.tmp.mp4`;
}

function createWorkingCopyRecord(
  sourcePath: string,
  playbackPath: string,
  sourceSize: number,
  sourceModifiedMs: number,
  videoCodec: string | undefined,
  encoder: VideoWorkingCopy["encoder"]
): VideoWorkingCopy {
  return {
    sourcePath,
    playbackPath,
    createdAt: new Date().toISOString(),
    sourceSize,
    sourceModifiedMs,
    videoCodec,
    encoder
  };
}

async function assertWorkingCopyExists(playbackPath: string) {
  const stats = await fs.stat(playbackPath);

  if (!stats.isFile() || stats.size === 0) {
    throw new Error(`Working copy was not created correctly: ${playbackPath}`);
  }
}

async function assertRendererCompatibleWorkingCopy(playbackPath: string, sourceMediaInfo: VideoInspectionResult) {
  await assertWorkingCopyExists(playbackPath);

  const workingCopyInfo = await inspectVideoFile(playbackPath);
  const sourceVideo = sourceMediaInfo.video;
  const workingVideo = workingCopyInfo.video;

  if (
    !workingCopyInfo.directPlaybackLikelySupported ||
    workingVideo?.codec !== "h264" ||
    workingVideo.pixelFormat !== "yuv420p" ||
    (sourceVideo?.width && workingVideo.width !== sourceVideo.width) ||
    (sourceVideo?.height && workingVideo.height !== sourceVideo.height)
  ) {
    throw new Error(`Working copy is not renderer compatible: ${playbackPath}`);
  }
}

async function canReuseWorkingCopy(
  workingCopy: VideoWorkingCopy | undefined,
  sourceSize: number,
  sourceModifiedMs: number,
  sourceMediaInfo: VideoInspectionResult
) {
  if (!workingCopy || workingCopy.sourceSize !== sourceSize || workingCopy.sourceModifiedMs !== sourceModifiedMs) {
    return false;
  }

  try {
    await assertRendererCompatibleWorkingCopy(workingCopy.playbackPath, sourceMediaInfo);
    return true;
  } catch {
    return false;
  }
}

export async function findReusableWorkingCopy(
  workingCopy: VideoWorkingCopy | undefined,
  sourcePath: string,
  sourceMediaInfo: VideoInspectionResult
) {
  const sourceSignature = await getSourceSignature(sourcePath);

  if (await canReuseWorkingCopy(workingCopy, sourceSignature.size, sourceSignature.modifiedMs, sourceMediaInfo)) {
    return workingCopy;
  }

  return null;
}

export async function findExistingWorkingCopyForSource(
  sourcePath: string,
  userDataPath: string,
  mediaInfo: VideoInspectionResult
) {
  const sourceSignature = await getSourceSignature(sourcePath);
  const playbackPath = getWorkingCopyPath(
    userDataPath,
    sourcePath,
    sourceSignature.size,
    sourceSignature.modifiedMs
  );

  try {
    await assertRendererCompatibleWorkingCopy(playbackPath, mediaInfo);
    return createWorkingCopyRecord(
      sourcePath,
      playbackPath,
      sourceSignature.size,
      sourceSignature.modifiedMs,
      mediaInfo.video?.codec,
      "unknown"
    );
  } catch {
    return null;
  }
}

function getNvencArgs(sourcePath: string, outputPath: string) {
  return [
    "-y",
    "-i", sourcePath,
    "-map", "0:v:0",
    "-map", "0:a?",
    "-c:v", "h264_nvenc",
    "-preset", "p5",
    "-profile:v", "high",
    "-level:v", "5.2",
    "-rc", "vbr",
    "-cq", "20",
    "-b:v", "0",
    "-pix_fmt", "yuv420p",
    "-vf", getEvenDimensionScaleFilter(),
    "-c:a", "aac",
    "-b:a", "160k",
    "-movflags", "+faststart",
    outputPath
  ];
}

function getLibx264Args(sourcePath: string, outputPath: string) {
  return [
    "-y",
    "-i", sourcePath,
    "-map", "0:v:0",
    "-map", "0:a?",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-profile:v", "high",
    "-level:v", "5.2",
    "-pix_fmt", "yuv420p",
    "-vf", getEvenDimensionScaleFilter(),
    "-c:a", "aac",
    "-b:a", "160k",
    "-movflags", "+faststart",
    outputPath
  ];
}

export async function createOrReuseWorkingCopy(request: WorkingCopyRequest): Promise<WorkingCopyResult> {
  const sourceSignature = await getSourceSignature(request.sourcePath);
  const existingWorkingCopy = request.existingWorkingCopy;

  if (
    existingWorkingCopy &&
    await canReuseWorkingCopy(existingWorkingCopy, sourceSignature.size, sourceSignature.modifiedMs, request.mediaInfo)
  ) {
    return {
      workingCopy: existingWorkingCopy,
      reused: true,
      nvencAvailable: existingWorkingCopy.encoder === "h264_nvenc"
    };
  }

  const playbackPath = getWorkingCopyPath(
    request.userDataPath,
    request.sourcePath,
    sourceSignature.size,
    sourceSignature.modifiedMs
  );

  try {
    await assertRendererCompatibleWorkingCopy(playbackPath, request.mediaInfo);
    return {
      workingCopy: createWorkingCopyRecord(
        request.sourcePath,
        playbackPath,
        sourceSignature.size,
        sourceSignature.modifiedMs,
        request.mediaInfo.video?.codec,
        "unknown"
      ),
      reused: true,
      nvencAvailable: await hasFfmpegEncoder("h264_nvenc")
    };
  } catch {
    // No deterministic working copy exists yet; create one below.
  }

  await fs.mkdir(path.dirname(playbackPath), { recursive: true });

  const nvencAvailable = await hasFfmpegEncoder("h264_nvenc");
  let encoder: VideoWorkingCopy["encoder"] = "libx264";
  const temporaryPlaybackPath = getTemporaryWorkingCopyPath(playbackPath);

  request.onProgress?.({
    sourcePath: request.sourcePath,
    outputPath: playbackPath,
    stage: "starting",
    progress: 0,
    encoder: nvencAvailable ? "h264_nvenc" : "libx264"
  });

  try {
    const durationSeconds = request.mediaInfo.durationSeconds ?? request.mediaInfo.video?.durationSeconds ?? 0;
    const emitTranscodeProgress = (seconds: number) => {
      request.onProgress?.({
        sourcePath: request.sourcePath,
        outputPath: playbackPath,
        stage: "transcoding",
        progress: durationSeconds > 0 ? Math.min(0.98, Math.max(0, seconds / durationSeconds)) : 0,
        encoder
      });
    };

    if (nvencAvailable) {
      try {
        encoder = "h264_nvenc";
        await runFfmpeg(getNvencArgs(request.sourcePath, temporaryPlaybackPath), emitTranscodeProgress);
      } catch (error) {
        console.warn("NVENC working-copy transcode failed; falling back to libx264.", error);
        await fs.rm(temporaryPlaybackPath, { force: true }).catch(() => undefined);
        encoder = "libx264";
        await runFfmpeg(getLibx264Args(request.sourcePath, temporaryPlaybackPath), emitTranscodeProgress);
      }
    } else {
      await runFfmpeg(getLibx264Args(request.sourcePath, temporaryPlaybackPath), emitTranscodeProgress);
    }

    request.onProgress?.({
      sourcePath: request.sourcePath,
      outputPath: playbackPath,
      stage: "validating",
      progress: 0.99,
      encoder
    });
    await assertRendererCompatibleWorkingCopy(temporaryPlaybackPath, request.mediaInfo);
    await fs.rm(playbackPath, { force: true }).catch(() => undefined);
    await fs.rename(temporaryPlaybackPath, playbackPath);
  } catch (error) {
    await fs.rm(temporaryPlaybackPath, { force: true }).catch(() => undefined);
    throw error;
  }

  await assertRendererCompatibleWorkingCopy(playbackPath, request.mediaInfo);
  request.onProgress?.({
    sourcePath: request.sourcePath,
    outputPath: playbackPath,
    stage: "ready",
    progress: 1,
    encoder
  });

  return {
    workingCopy: createWorkingCopyRecord(
      request.sourcePath,
      playbackPath,
      sourceSignature.size,
      sourceSignature.modifiedMs,
      request.mediaInfo.video?.codec,
      encoder
    ),
    reused: false,
    nvencAvailable
  };
}
