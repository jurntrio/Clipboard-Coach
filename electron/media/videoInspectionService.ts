import path from "node:path";
import type { AudioStreamInfo, VideoInspectionResult, VideoStreamInfo } from "../../shared/types";
import { runFfmpegCapture } from "../export/ffmpegRunner";

function parseDurationSeconds(text: string) {
  const match = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(text);

  if (!match) {
    return undefined;
  }

  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function parseVideoStream(text: string): VideoStreamInfo | undefined {
  const line = text.split(/\r?\n/).find((entry) => entry.includes(" Video: "));

  if (!line) {
    return undefined;
  }

  const codecMatch = /Video:\s*([^,\s(]+)/.exec(line);
  const profileMatch = /Video:\s*[^,]*\(([^)]+)\)/.exec(line);
  const dimensionsMatch = /(\d{2,5})x(\d{2,5})/.exec(line);
  const frameRateMatch = /([\d.]+)\s*fps/.exec(line) ?? /([\d.]+)\s*tbr/.exec(line);
  const parts = line.split(",").map((part) => part.trim());
  const pixelFormat = parts.find((part) => /^yuv|^nv12|^p0[0-9]{2}|^rgb|^bgr/i.test(part))?.split(/\s|\(/)[0];

  return {
    codec: codecMatch?.[1]?.toLowerCase(),
    profile: profileMatch?.[1],
    pixelFormat,
    width: dimensionsMatch ? Number(dimensionsMatch[1]) : undefined,
    height: dimensionsMatch ? Number(dimensionsMatch[2]) : undefined,
    frameRate: frameRateMatch ? Number(frameRateMatch[1]) : undefined
  };
}

function parseAudioStream(text: string): AudioStreamInfo | undefined {
  const line = text.split(/\r?\n/).find((entry) => entry.includes(" Audio: "));

  if (!line) {
    return undefined;
  }

  const codecMatch = /Audio:\s*([^,\s(]+)/.exec(line);
  return { codec: codecMatch?.[1]?.toLowerCase() };
}

export function isDirectPlaybackLikelySupported(info: Omit<VideoInspectionResult, "directPlaybackLikelySupported">) {
  const extension = path.extname(info.path).toLowerCase();
  const videoCodec = info.video?.codec?.toLowerCase();
  const profile = info.video?.profile?.toLowerCase() ?? "";
  const pixelFormat = info.video?.pixelFormat?.toLowerCase();
  const audioCodec = info.audio?.codec?.toLowerCase();

  if (![".mp4", ".m4v", ".mov"].includes(extension)) {
    return { supported: false, reason: "The container is not a reliable MP4/MOV playback target." };
  }

  if (!videoCodec || !["h264", "avc1"].includes(videoCodec)) {
    return { supported: false, reason: `Video codec ${videoCodec ?? "unknown"} is not reliably supported.` };
  }

  if (profile.includes("10") || !pixelFormat || !["yuv420p", "yuvj420p", "nv12"].includes(pixelFormat)) {
    return { supported: false, reason: `Pixel format/profile ${pixelFormat ?? profile ?? "unknown"} is not reliably supported.` };
  }

  if (audioCodec && !["aac", "mp3", "mp4a"].includes(audioCodec)) {
    return { supported: false, reason: `Audio codec ${audioCodec} is not reliably supported.` };
  }

  return { supported: true, reason: undefined };
}

export async function inspectVideoFile(filePath: string): Promise<VideoInspectionResult> {
  const output = await runFfmpegCapture(["-hide_banner", "-i", filePath], true);
  const details = `${output.stderr}\n${output.stdout}`;
  const durationSeconds = parseDurationSeconds(details);
  const video = parseVideoStream(details);
  const audio = parseAudioStream(details);
  const support = isDirectPlaybackLikelySupported({ path: filePath, durationSeconds, video, audio });

  if (video && typeof durationSeconds === "number") {
    video.durationSeconds = durationSeconds;
  }

  return {
    path: filePath,
    container: path.extname(filePath).toLowerCase().replace(/^\./, ""),
    durationSeconds,
    video,
    audio,
    directPlaybackLikelySupported: support.supported,
    compatibilityReason: support.reason
  };
}
