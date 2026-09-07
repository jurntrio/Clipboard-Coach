import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prependClipImages, runMedia } from "./clipImagePipeline";
import { parseImageManifest } from "./clipImagePlan";
const ffmpeg = require("ffmpeg-static") as string;
const ffprobe = (require("ffprobe-static") as { path: string }).path;

test("manifest rejects paths outside intro assets and invalid durations", () => {
  const segment = "11111111-1111-1111-1111-111111111111";
  const key = `clip-intros/render-assets/${segment}/opening.png`;
  assert.equal(parseImageManifest({ version: 1, segments: { [segment]: [{ key, duration: 0.5 }] } }).version, 1);
  for (const value of [{ key: "../../secret", duration: 2 }, { key, duration: 61 }, { key, duration: NaN }]) assert.throws(() => parseImageManifest({ version: 1, segments: { [segment]: [value] } }));
});

test("encoded MP4 contains ordered images, full video and compatible silent audio", { timeout: 90000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "svs-intro-test-"));
  try {
    const source = path.join(dir, "source.mp4");
    const red = path.join(dir, "red.png");
    const green = path.join(dir, "green.png");
    const output = path.join(dir, "result.mp4");
    await runMedia(ffmpeg, ["-y", "-f", "lavfi", "-i", "color=c=blue:s=320x240:r=25:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", source]);
    await runMedia(ffmpeg, ["-y", "-f", "lavfi", "-i", "color=c=red:s=200x400", "-frames:v", "1", red]);
    await runMedia(ffmpeg, ["-y", "-f", "lavfi", "-i", "color=c=green:s=640x200", "-frames:v", "1", green]);
    await prependClipImages(source, output, [{ imagePath: red, duration: 1 }, { imagePath: green, duration: 0.5 }], path.join(dir, "parts"));
    const probe = JSON.parse((await runMedia(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", output])).toString());
    const video = probe.streams.find((stream: { codec_type: string }) => stream.codec_type === "video");
    const audio = probe.streams.find((stream: { codec_type: string }) => stream.codec_type === "audio");
    assert.equal(video.width, 1280); assert.equal(video.height, 720); assert.equal(video.codec_name, "h264");
    assert.equal(audio.codec_name, "aac"); assert.equal(audio.channels, 2);
    assert.ok(Math.abs(Number(probe.format.duration) - 3.5) < 0.2, `duration ${probe.format.duration}`);
    for (const [time, channel] of [[0.4, 0], [1.25, 1], [2.0, 2]] as const) {
      const pixel = await runMedia(ffmpeg, ["-v", "error", "-ss", String(time), "-i", output, "-frames:v", "1", "-vf", "crop=2:2:640:360,scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]);
      assert.ok(pixel[channel] > 80 && pixel[channel] > pixel[(channel + 1) % 3] * 2, `wrong color at ${time}: ${pixel.toString("hex")}`);
    }
    // A segment with no prefix is also normalized, so full-clip downloads merge.
    const plain = path.join(dir, "plain.mp4");
    await prependClipImages(source, plain, [], path.join(dir, "plain-parts"));
    const plainProbe = JSON.parse((await runMedia(ffprobe, ["-v", "error", "-show_streams", "-of", "json", plain])).toString());
    assert.equal(plainProbe.streams.find((stream: { codec_type: string }) => stream.codec_type === "audio").codec_name, "aac");
    // Preserve real match audio after a silent intro, including portrait inputs.
    const audible = path.join(dir, "audible.mp4");
    const audibleOutput = path.join(dir, "audible-intro.mp4");
    await runMedia(ffmpeg, ["-y", "-f", "lavfi", "-i", "color=c=blue:s=240x320:r=25:d=2", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2", "-c:v", "libx264", "-c:a", "aac", "-shortest", audible]);
    await prependClipImages(audible, audibleOutput, [{ imagePath: red, duration: 0.5 }], path.join(dir, "audible-parts"));
    async function peak(time: string) {
      const samples = await runMedia(ffmpeg, ["-v", "error", "-ss", time, "-i", audibleOutput, "-t", "0.15", "-vn", "-f", "s16le", "-ac", "1", "pipe:1"]);
      let max = 0; for (let offset = 0; offset + 1 < samples.length; offset += 2) max = Math.max(max, Math.abs(samples.readInt16LE(offset)));
      return max;
    }
    assert.ok(await peak("0.15") < 20, "intro must be silent");
    assert.ok(await peak("1.2") > 1000, "original match audio must remain audible");
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
