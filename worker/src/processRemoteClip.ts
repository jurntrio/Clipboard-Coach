import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { buildMobileMp4WithDrawings, probeDurationSeconds } from "./hlsPipeline";
import { downloadToFile, uploadFile } from "./r2";
import { supabase } from "./supabase";

// ffmpeg's HTTP protocol handler segfaults reading these sources directly
// (confirmed: identical -ss/-i args crash over the network but succeed
// against a local copy of the exact same file) - likely because these are
// raw multi-GB (>4GB) camera recordings, a known trigger for demuxer bugs.
// Downloading first sidesteps ffmpeg's network code path entirely.
async function downloadRemoteFile(url: string, destPath: string) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  await pipeline(response.body as unknown as NodeJS.ReadableStream, fs.createWriteStream(destPath));
}

type RemoteSegmentRow = {
  sequence_order: number;
  videos: { video_url: string } | null;
  tags: {
    name: string;
    color: string;
    start_time: number;
    end_time: number;
    drawings: Array<{ key: string; video_time: number; duration_seconds: number }> | null;
    videos: { video_url: string } | null;
  } | null;
};

/**
 * Renders a clip whose segments live on a remote source (not previously uploaded to R2 by the
 * browser) from each source video's URL. Each distinct source is downloaded to local disk once
 * (see downloadRemoteFile above) and ffmpeg runs against that local copy - passing the remote
 * URL straight to ffmpeg reliably segfaults on these multi-GB recordings.
 */
export async function processRemoteClip(clipId: string) {
  let workDir: string | null = null;

  try {
    workDir = await fsp.mkdtemp(path.join(os.tmpdir(), `cc-remote-clip-${clipId}-`));
    const { data: clip, error: clipError } = await supabase.from("clips").select("coach_id").eq("id", clipId).single();
    if (clipError || !clip) throw clipError ?? new Error("Clip not found");

    const { data: segmentRows, error: segmentsError } = await supabase
      .from("clip_segments")
      .select("sequence_order, videos(video_url), tags(name, color, start_time, end_time, drawings, videos(video_url))")
      .eq("clip_id", clipId)
      .order("sequence_order");
    if (segmentsError) throw segmentsError;
    const segments = ((segmentRows ?? []) as unknown as RemoteSegmentRow[]).filter((segment) => !!segment.tags);
    if (!segments.length) throw new Error("Clip has no segments");

    const localSourcesByUrl = new Map<string, string>();
    async function localSourcePath(sourceUrl: string, index: number) {
      const cached = localSourcesByUrl.get(sourceUrl);
      if (cached) return cached;
      const localPath = path.join(workDir!, `source-${index}-${randomUUID()}.mp4`);
      await downloadRemoteFile(sourceUrl, localPath);
      localSourcesByUrl.set(sourceUrl, localPath);
      return localPath;
    }

    const rendered = [];
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const tag = segment.tags!;
      const sourceUrl = segment.videos?.video_url ?? tag.videos?.video_url;
      if (!sourceUrl) throw new Error(`Segment ${index} has no source video`);
      const localSource = await localSourcePath(sourceUrl, index);

      const outputPath = path.join(workDir, `${index}-mobile.mp4`);
      const segmentWorkDir = path.join(workDir, `${index}-parts`);
      await fsp.mkdir(segmentWorkDir, { recursive: true });

      const drawingInputs = [];
      for (const [drawingIndex, drawing] of (tag.drawings ?? []).entries()) {
        if (!drawing.key || drawing.video_time < tag.start_time || drawing.video_time > tag.end_time) continue;
        const imagePath = path.join(workDir, `${index}-drawing-${drawingIndex}.png`);
        await downloadToFile(drawing.key, imagePath);
        drawingInputs.push({ imagePath, atSeconds: drawing.video_time - tag.start_time, durationSeconds: drawing.duration_seconds });
      }

      await buildMobileMp4WithDrawings(localSource, outputPath, drawingInputs, segmentWorkDir, tag.start_time, tag.end_time - tag.start_time);

      const key = `clips/${clip.coach_id}/${clipId}/${index}-${randomUUID()}-mobile.mp4`;
      const url = await uploadFile(key, outputPath, "video/mp4");
      const stat = await fsp.stat(outputPath);
      const duration = await probeDurationSeconds(outputPath);
      rendered.push({
        id: randomUUID(),
        url,
        key,
        name: tag.name,
        color: tag.color,
        file_size: stat.size,
        duration,
        play_start: 0,
        source_start: tag.start_time,
        source_end: tag.end_time,
        drawing_time_base: "clip",
        drawings: [],
        video_codec: "avc",
        mobile_compatible: true
      });
    }

    const { error: updateError } = await supabase
      .from("clips")
      .update({ rendered_segments: rendered, render_status: "ready", render_error: null })
      .eq("id", clipId);
    if (updateError) throw updateError;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("clips").update({ render_status: "failed", render_error: message }).eq("id", clipId);
    throw error;
  } finally {
    if (workDir) await fsp.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
