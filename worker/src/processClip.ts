import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildMobileMp4WithDrawings, probeDurationSeconds } from "./hlsPipeline";
import { deleteObject, downloadToFile, uploadFile } from "./r2";
import { supabase } from "./supabase";

type RenderedSegment = {
  id: string;
  key: string;
  url: string;
  file_size: number;
  duration?: number;
  play_start?: number;
  drawing_time_base?: "clip";
  drawings?: Array<{
    key: string;
    at_seconds: number;
    duration_seconds: number;
  }>;
  [key: string]: unknown;
};

export async function processClip(clipId: string) {
  let workDir: string | null = null;
  let activeSegmentId: string | null = null;

  try {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), `cc-clip-${clipId}-`));
    const { data: clip, error } = await supabase.from("clips").select("rendered_segments").eq("id", clipId).single();
    if (error || !clip) throw error ?? new Error("Clip not found");
    const segments = (clip.rendered_segments ?? []) as RenderedSegment[];
    if (!segments.length) throw new Error("Clip has no uploaded segments");

    const { data: segmentRows, error: segmentRowsError } = await supabase
      .from("clip_segments")
      .select("id, sequence_order, render_status, rendered_segment, render_attempts")
      .eq("clip_id", clipId)
      .order("sequence_order");
    if (segmentRowsError) throw segmentRowsError;
    if ((segmentRows ?? []).length !== segments.length) throw new Error("Clip segment metadata does not match uploaded segments");
    await supabase.from("clips").update({ render_status: "rendering", render_error: null }).eq("id", clipId);

    const optimized: RenderedSegment[] = [];
    const sourceKeysToDelete: string[] = [];
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const segmentRow = segmentRows![index];
      if (segmentRow.render_status === "ready" && segmentRow.rendered_segment) {
        optimized.push(segmentRow.rendered_segment as RenderedSegment);
        continue;
      }
      activeSegmentId = segmentRow.id;
      const { error: startError } = await supabase.from("clip_segments").update({
        render_status: "rendering",
        render_error: null,
        render_attempts: (segmentRow.render_attempts ?? 0) + 1,
        render_started_at: new Date().toISOString()
      }).eq("id", segmentRow.id);
      if (startError) throw startError;
      const inputPath = path.join(workDir, `${index}-source.mp4`);
      const outputPath = path.join(workDir, `${index}-mobile.mp4`);
      await downloadToFile(segment.key, inputPath);
      const drawingInputs = [];
      for (const [drawingIndex, drawing] of (segment.drawings ?? []).entries()) {
        if (!drawing.key) continue;
        const imagePath = path.join(workDir, `${index}-drawing-${drawingIndex}.png`);
        await downloadToFile(drawing.key, imagePath);
        drawingInputs.push({
          sourceIndex: drawingIndex,
          imagePath,
          atSeconds: drawing.at_seconds,
          durationSeconds: drawing.duration_seconds
        });
      }
      const segmentWorkDir = path.join(workDir, `${index}-parts`);
      await fs.mkdir(segmentWorkDir, { recursive: true });
      const playStart = Math.max(0, Number(segment.play_start) || 0);
      const storedDuration = Number(segment.duration);
      const playDuration = Number.isFinite(storedDuration) && storedDuration > playStart
        ? storedDuration - playStart
        : undefined;
      const normalizedDrawingInputs = drawingInputs.map((drawing) => ({
        ...drawing,
        atSeconds: segment.drawing_time_base === "clip" ? drawing.atSeconds : drawing.atSeconds - playStart
      }));
      await buildMobileMp4WithDrawings(
        inputPath,
        outputPath,
        normalizedDrawingInputs,
        segmentWorkDir,
        playStart,
        playDuration
      );
      // Use a new object key instead of overwriting the browser-uploaded source.
      // Public/CDN caches may otherwise keep serving the old unsupported codec
      // after the database already reports that the mobile MP4 is ready.
      const mobileKey = segment.key.replace(/\.mp4$/i, "") + "-mobile.mp4";
      const mobileUrl = await uploadFile(mobileKey, outputPath, "video/mp4");
      const stat = await fs.stat(outputPath);
      const duration = await probeDurationSeconds(outputPath);
      sourceKeysToDelete.push(segment.key);
      const optimizedSegment: RenderedSegment = {
        ...segment,
        key: mobileKey,
        url: mobileUrl,
        duration,
        play_start: 0,
        drawing_time_base: "clip",
        // Drawings are already baked into the optimized MP4 as freeze-frames.
        // Keeping their metadata would make web players show the same drawing twice.
        drawings: [],
        file_size: stat.size,
        video_codec: "avc",
        mobile_compatible: true,
        clip_segment_id: segmentRow.id,
        sequence_order: segmentRow.sequence_order
      };
      const { error: persistError } = await supabase.from("clip_segments").update({
        render_status: "ready",
        rendered_segment: optimizedSegment,
        render_error: null,
        render_completed_at: new Date().toISOString()
      }).eq("id", segmentRow.id);
      if (persistError) throw persistError;
      optimized.push(optimizedSegment);
      activeSegmentId = null;
    }

    const { error: updateError } = await supabase
      .from("clips")
      .update({ rendered_segments: optimized, render_status: "ready", render_error: null })
      .eq("id", clipId);
    if (updateError) throw updateError;
    await Promise.all(sourceKeysToDelete.map((key) => deleteObject(key).catch(() => undefined)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (activeSegmentId) {
      await supabase.from("clip_segments").update({ render_status: "failed", render_error: message }).eq("id", activeSegmentId);
    }
    await supabase.from("clips").update({ render_status: "failed", render_error: message }).eq("id", clipId);
    throw error;
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
