import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const ffmpeg = require("ffmpeg-static") as string;
const ffprobe = (require("ffprobe-static") as { path: string }).path;

export function runMedia(bin: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    const chunks: Buffer[] = []; let error = "";
    child.stdout.on("data", chunk => chunks.push(chunk));
    child.stderr.on("data", chunk => { error = (error + chunk).slice(-4000); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`Clip image encoding failed (${code}): ${error}`)));
  });
}

const videoArgs = ["-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0", "-r", "25", "-video_track_timescale", "12800", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "128k"];

/** Encode prefix images and the existing clip into matching H.264/AAC parts.
 * Called for every segment in an image-enabled clip, including segments with no
 * prefix, so the existing MP4 download merger receives compatible tracks. */
export async function prependClipImages(input: string, output: string, images: Array<{ imagePath: string; duration: number }>, workDir: string) {
  const directory = path.resolve(workDir);
  await fs.mkdir(directory, { recursive: true });
  const parts: string[] = [];
  for (const [index, image] of images.entries()) {
    if (!Number.isFinite(image.duration) || image.duration < 0.5 || image.duration > 60) throw new Error("Invalid intro duration");
    const part = path.join(directory, `intro-${index}.mp4`);
    await runMedia(ffmpeg, ["-y", "-loop", "1", "-framerate", "25", "-i", image.imagePath, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v:0", "-map", "1:a:0", ...videoArgs, "-t", image.duration.toFixed(3), "-shortest", part]);
    parts.push(part);
  }
  const probe = JSON.parse((await runMedia(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", input])).toString());
  const duration = Number(probe.format.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Invalid video duration");
  const hasAudio = probe.streams.some((stream: { codec_type: string }) => stream.codec_type === "audio");
  const video = path.join(directory, "video.mp4");
  await runMedia(ffmpeg, ["-y", "-i", input, ...(!hasAudio ? ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"] : []), "-map", "0:v:0", "-map", hasAudio ? "0:a:0" : "1:a:0", ...videoArgs, "-t", duration.toFixed(3), "-shortest", video]);
  parts.push(video);
  const list = path.join(directory, "concat.txt");
  await fs.writeFile(list, parts.map(part => `file '${part.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"));
  await runMedia(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", output]);
}
