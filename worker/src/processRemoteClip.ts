import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { buildMobileMp4WithDrawings, probeDurationSeconds } from "./hlsPipeline";
import { downloadToFile, uploadFile } from "./r2";
import { supabase } from "./supabase";
import { createRemoteRangeProxy, type RemoteRangeProxy } from "./remoteRangeProxy";

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
  id: string;
  sequence_order: number;
  render_status: "pending" | "rendering" | "ready" | "failed";
  rendered_segment: RenderedRemoteSegment | null;
  render_attempts: number;
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

type RenderedRemoteSegment = {
  id: string;
  url: string;
  key: string;
  name: string;
  color: string;
  file_size: number;
  duration: number;
  play_start: number;
  source_start: number;
  source_end: number;
  drawing_time_base: "clip";
  drawings: [];
  video_codec: "avc";
  mobile_compatible: true;
  clip_segment_id: string;
  sequence_order: number;
};

/**
 * Renders a clip whose segments live on a remote source (not previously uploaded to R2 by the
 * browser) from each source video's URL. A localhost proxy preserves the source's HTTP byte-range
 * semantics while isolating ffmpeg from the multi-GB remote URL that previously made it segfault.
 * Only the MP4 index and bytes around the requested tag are transferred. A full local download
 * remains available as a per-camera fallback.
 */
export async function processRemoteClip(clipId: string) {
  let workDir: string | null = null;
  let activeSegmentId: string | null = null;
  const rangeProxiesByUrl = new Map<string, RemoteRangeProxy>();
  const fallbackSourcesByUrl = new Map<string, string>();

  try {
    workDir = await fsp.mkdtemp(path.join(os.tmpdir(), `cc-remote-clip-${clipId}-`));
    const { data: clip, error: clipError } = await supabase.from("clips").select("coach_id").eq("id", clipId).single();
    if (clipError || !clip) throw clipError ?? new Error("Clip not found");
    await supabase.from("clips").update({ render_status: "rendering", render_error: null }).eq("id", clipId);

    const { data: segmentRows, error: segmentsError } = await supabase
      .from("clip_segments")
      .select("id, sequence_order, render_status, rendered_segment, render_attempts, videos(video_url), tags(name, color, start_time, end_time, drawings, videos(video_url))")
      .eq("clip_id", clipId)
      .order("sequence_order");
    if (segmentsError) throw segmentsError;
    const segments = ((segmentRows ?? []) as unknown as RemoteSegmentRow[]).filter((segment) => !!segment.tags);
    if (!segments.length) throw new Error("Clip has no segments");

    async function rangeSource(sourceUrl: string) {
      const cached = rangeProxiesByUrl.get(sourceUrl);
      if (cached) return cached.inputUrl;
      const proxy = await createRemoteRangeProxy(sourceUrl);
      rangeProxiesByUrl.set(sourceUrl, proxy);
      return proxy.inputUrl;
    }
    async function fallbackSource(sourceUrl: string, index: number) {
      const cached = fallbackSourcesByUrl.get(sourceUrl);
      if (cached) return cached;
      const localPath = path.join(workDir!, `source-${index}-${randomUUID()}.mp4`);
      await downloadRemoteFile(sourceUrl, localPath);
      fallbackSourcesByUrl.set(sourceUrl, localPath);
      return localPath;
    }

    const rendered: RenderedRemoteSegment[] = [];
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (segment.render_status === "ready" && segment.rendered_segment?.url) {
        rendered.push(segment.rendered_segment);
        continue;
      }
      activeSegmentId = segment.id;
      const { error: startError } = await supabase.from("clip_segments").update({
        render_status: "rendering",
        render_error: null,
        render_attempts: (segment.render_attempts ?? 0) + 1,
        render_started_at: new Date().toISOString()
      }).eq("id", segment.id);
      if (startError) throw startError;
      const tag = segment.tags!;
      const sourceUrl = segment.videos?.video_url ?? tag.videos?.video_url;
      if (!sourceUrl) throw new Error(`Segment ${index} has no source video`);

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

      let usedRangeExtraction = false;
      if (!fallbackSourcesByUrl.has(sourceUrl)) {
        try {
          const proxyInput = await rangeSource(sourceUrl);
          await buildMobileMp4WithDrawings(proxyInput, outputPath, drawingInputs, segmentWorkDir, tag.start_time, tag.end_time - tag.start_time);
          usedRangeExtraction = true;
        } catch (rangeError) {
          console.warn(`[worker] range extraction unavailable for clip ${clipId} segment ${segment.id}; using full-download fallback`);
        }
      }
      if (!usedRangeExtraction) {
        const localSource = await fallbackSource(sourceUrl, index);
        await buildMobileMp4WithDrawings(localSource, outputPath, drawingInputs, segmentWorkDir, tag.start_time, tag.end_time - tag.start_time);
      }

      const key = `clips/${clip.coach_id}/${clipId}/${index}-${randomUUID()}-mobile.mp4`;
      const url = await uploadFile(key, outputPath, "video/mp4");
      const stat = await fsp.stat(outputPath);
      const duration = await probeDurationSeconds(outputPath);
      const renderedSegment: RenderedRemoteSegment = {
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
        mobile_compatible: true,
        clip_segment_id: segment.id,
        sequence_order: segment.sequence_order
      };
      const { error: persistError } = await supabase.from("clip_segments").update({
        render_status: "ready",
        rendered_segment: renderedSegment,
        render_error: null,
        render_completed_at: new Date().toISOString()
      }).eq("id", segment.id);
      if (persistError) throw persistError;
      rendered.push(renderedSegment);
      activeSegmentId = null;
    }

    const { error: updateError } = await supabase
      .from("clips")
      .update({ rendered_segments: rendered.sort((a, b) => a.sequence_order - b.sequence_order), render_status: "ready", render_error: null })
      .eq("id", clipId);
    if (updateError) throw updateError;
    for (const proxy of rangeProxiesByUrl.values()) {
      console.log(`[worker] clip ${clipId} range source complete: ${proxy.stats.requestCount} requests, ${Math.round(proxy.stats.transferredBytes / 1048576)} MiB`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (activeSegmentId) {
      await supabase.from("clip_segments").update({ render_status: "failed", render_error: message }).eq("id", activeSegmentId);
    }
    await supabase.from("clips").update({ render_status: "failed", render_error: message }).eq("id", clipId);
    throw error;
  } finally {
    await Promise.all([...rangeProxiesByUrl.values()].map((proxy) => proxy.close().catch(() => undefined)));
    if (workDir) await fsp.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
