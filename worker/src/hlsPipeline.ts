import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require("ffmpeg-static") as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobePath = (require("ffprobe-static") as { path: string }).path;

const MEDIA_COMMAND_TIMEOUT_MS = 15 * 60 * 1000;

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${path.basename(bin)} timed out after ${Math.round(MEDIA_COMMAND_TIMEOUT_MS / 60000)} minutes`));
    }, MEDIA_COMMAND_TIMEOUT_MS);
    timer.unref();
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (error: Error | null, output = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(output);
    };
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (code === 0) finish(null, stdout);
      else finish(new Error(`${path.basename(bin)} exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

export async function probeDurationSeconds(inputPath: string): Promise<number> {
  const stdout = await run(ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath
  ]);
  const seconds = Number(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`ffprobe returned an invalid duration for ${path.basename(inputPath)}: ${stdout.trim() || "empty output"}`);
  }
  return seconds;
}

/**
 * Transcodes the source video into a single-rendition 720p HLS proxy
 * (small segments, standard H.264/AAC) so it plays reliably in every
 * browser regardless of the source codec/bitrate.
 */
export async function buildHlsProxy(inputPath: string): Promise<{ dir: string; playlistPath: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-hls-"));
  const playlistPath = path.join(dir, "playlist.m3u8");

  try {
    await run(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-vf",
      "scale=-2:720",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-g",
      "48",
      "-keyint_min",
      "48",
      "-sc_threshold",
      "0",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-hls_time",
      "5",
      "-hls_playlist_type",
      "vod",
      "-hls_segment_filename",
      path.join(dir, "segment_%04d.ts"),
      playlistPath
    ]);

    return { dir, playlistPath };
  } catch (error) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}


/** Convert a short shared clip to a broadly supported mobile MP4. */
export async function buildMobileMp4(inputPath: string, outputPath: string, startSeconds = 0, durationSeconds?: number) {
  const trimArgs = [
    ...(startSeconds > 0 ? ["-ss", startSeconds.toFixed(3)] : []),
    ...(durationSeconds !== undefined ? ["-t", durationSeconds.toFixed(3)] : [])
  ];
  await run(ffmpegPath, [
    "-y",
    ...trimArgs,
    "-i",
    inputPath,
    "-vf",
    "scale=-2:min(720\\,ih)",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-profile:v",
    "high",
    "-level",
    "4.0",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath
  ]);
}

export type ClipDrawingInput = {
  imagePath: string;
  atSeconds: number;
  durationSeconds: number;
};

async function buildMobileVideoPart(inputPath: string, outputPath: string, startSeconds: number, durationSeconds: number) {
  await run(ffmpegPath, [
    "-y",
    "-ss", startSeconds.toFixed(3),
    "-t", durationSeconds.toFixed(3),
    "-i", inputPath,
    "-vf", "scale=-2:min(720\\,ih)",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-profile:v", "high",
    "-level", "4.0",
    "-r", "25",
    "-c:a", "aac",
    "-ar", "48000",
    "-ac", "2",
    "-b:a", "128k",
    outputPath
  ]);
}

async function buildDrawingPart(imagePath: string, outputPath: string, durationSeconds: number) {
  await run(ffmpegPath, [
    "-y",
    "-loop", "1",
    "-framerate", "25",
    "-i", imagePath,
    "-f", "lavfi",
    "-i", "anullsrc=r=48000:cl=stereo",
    "-vf", "scale=-2:min(720\\,ih)",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-profile:v", "high",
    "-level", "4.0",
    "-r", "25",
    "-c:a", "aac",
    "-ar", "48000",
    "-ac", "2",
    "-b:a", "128k",
    "-t", durationSeconds.toFixed(3),
    "-shortest",
    outputPath
  ]);
}

/** Convert a shared clip and insert each saved drawing as a timed freeze-frame. */
export async function buildMobileMp4WithDrawings(
  inputPath: string,
  outputPath: string,
  drawings: ClipDrawingInput[],
  workDir: string,
  trimStartSeconds = 0,
  trimDurationSeconds?: number
) {
  if (drawings.length === 0) {
    await buildMobileMp4(inputPath, outputPath, trimStartSeconds, trimDurationSeconds);
    return;
  }

  const probedDuration = await probeDurationSeconds(inputPath);
  const availableDuration = Math.max(0, probedDuration - trimStartSeconds);
  const inputDuration = trimDurationSeconds === undefined
    ? availableDuration
    : Math.min(availableDuration, trimDurationSeconds);
  if (inputDuration <= 0) {
    throw new Error(`Invalid trimmed clip duration for ${path.basename(inputPath)}`);
  }
  const ordered = drawings
    .filter((drawing) => Number.isFinite(drawing.atSeconds) && Number.isFinite(drawing.durationSeconds))
    .map((drawing) => ({
      ...drawing,
      atSeconds: Math.min(inputDuration, Math.max(0, drawing.atSeconds)),
      durationSeconds: Math.min(30, Math.max(1, drawing.durationSeconds))
    }))
    .sort((first, second) => first.atSeconds - second.atSeconds);

  const resolvedWorkDir = path.resolve(workDir);
  const partPaths: string[] = [];
  let cursor = 0;
  let partIndex = 0;

  for (const drawing of ordered) {
    if (drawing.atSeconds > cursor + 0.001) {
      const partPath = path.join(resolvedWorkDir, `part-${partIndex++}.mp4`);
      await buildMobileVideoPart(inputPath, partPath, trimStartSeconds + cursor, drawing.atSeconds - cursor);
      partPaths.push(partPath);
    }

    const drawingPath = path.join(resolvedWorkDir, `part-${partIndex++}.mp4`);
    await buildDrawingPart(drawing.imagePath, drawingPath, drawing.durationSeconds);
    partPaths.push(drawingPath);
    cursor = Math.max(cursor, drawing.atSeconds);
  }

  if (cursor < inputDuration - 0.001) {
    const partPath = path.join(resolvedWorkDir, `part-${partIndex++}.mp4`);
    await buildMobileVideoPart(inputPath, partPath, trimStartSeconds + cursor, inputDuration - cursor);
    partPaths.push(partPath);
  }

  const listPath = path.join(resolvedWorkDir, "concat.txt");
  await fs.writeFile(listPath, partPaths.map((partPath) => `file '${partPath.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
  await run(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", outputPath]);
}

export async function concatenateMp4Files(inputPaths: string[], outputPath: string, workDir: string) {
  if (inputPaths.length === 0) throw new Error("Cannot concatenate an empty clip");
  if (inputPaths.length === 1) {
    await fs.copyFile(inputPaths[0], outputPath);
    return;
  }

  const listPath = path.join(workDir, "final-concat.txt");
  await fs.writeFile(listPath, inputPaths.map((inputPath) => `file '${inputPath.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
  await run(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", outputPath]);
}
