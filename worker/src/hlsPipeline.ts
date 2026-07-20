import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require("ffmpeg-static") as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobePath = (require("ffprobe-static") as { path: string }).path;

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${path.basename(bin)} exited with code ${code}: ${stderr.slice(-2000)}`));
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
  return Number.isFinite(seconds) ? Math.round(seconds) : 0;
}

/**
 * Transcodes the source video into a single-rendition 720p HLS proxy
 * (small segments, standard H.264/AAC) so it plays reliably in every
 * browser regardless of the source codec/bitrate.
 */
export async function buildHlsProxy(inputPath: string): Promise<{ dir: string; playlistPath: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-hls-"));
  const playlistPath = path.join(dir, "playlist.m3u8");

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
}
