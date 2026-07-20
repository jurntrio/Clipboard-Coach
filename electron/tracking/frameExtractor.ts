import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { runFfmpeg, parseFfmpegTimeSeconds } from "../export/ffmpegRunner";

// Sample rate for tracking frame extraction. 15fps balances distance-measurement
// accuracy against detection/tracking compute cost for offline batch processing —
// raise it (e.g. toward native fps) if Phase 7 ground-truth verification shows
// meaningful error.
export const TRACKING_SAMPLE_FPS = 15;

export type FrameExtractionRequest = {
  sourcePath: string;
  userDataPath: string;
  startSeconds: number;
  endSeconds: number;
  onProgressSeconds?: (seconds: number) => void;
};

export type FrameExtractionResult = {
  frameDir: string;
  frameCount: number;
  sampleFps: number;
  frameTimestamps: number[];
};

function getFrameDir(userDataPath: string, sourcePath: string, startSeconds: number, endSeconds: number) {
  const id = crypto
    .createHash("sha256")
    .update(`${sourcePath}:${startSeconds}:${endSeconds}:${TRACKING_SAMPLE_FPS}`)
    .digest("hex")
    .slice(0, 24);

  return path.join(userDataPath, "tracking-frames", id);
}

export async function extractTrackingFrames(request: FrameExtractionRequest): Promise<FrameExtractionResult> {
  const { sourcePath, userDataPath, startSeconds, endSeconds, onProgressSeconds } = request;
  const frameDir = getFrameDir(userDataPath, sourcePath, startSeconds, endSeconds);

  await fs.rm(frameDir, { recursive: true, force: true });
  await fs.mkdir(frameDir, { recursive: true });

  const durationSeconds = endSeconds - startSeconds;
  if (durationSeconds <= 0) {
    throw new Error("endSeconds must be greater than startSeconds.");
  }

  const args = [
    "-hide_banner",
    "-ss",
    startSeconds.toString(),
    "-i",
    sourcePath,
    "-t",
    durationSeconds.toString(),
    "-vf",
    `fps=${TRACKING_SAMPLE_FPS}`,
    "-q:v",
    "2",
    path.join(frameDir, "frame_%06d.jpg")
  ];

  await runFfmpeg(args, onProgressSeconds);

  const files = (await fs.readdir(frameDir)).filter((name) => name.endsWith(".jpg")).sort();
  const frameTimestamps = files.map((_, index) => startSeconds + index / TRACKING_SAMPLE_FPS);

  return {
    frameDir,
    frameCount: files.length,
    sampleFps: TRACKING_SAMPLE_FPS,
    frameTimestamps
  };
}

export function getFramePath(frameDir: string, frameIndex: number): string {
  return path.join(frameDir, `frame_${(frameIndex + 1).toString().padStart(6, "0")}.jpg`);
}

// Re-exported so callers parsing ffmpeg's own stderr (e.g. for a combined
// extraction+detection progress bar) don't need a second import path.
export { parseFfmpegTimeSeconds };
