import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildMobileMp4WithDrawings, probeDurationSeconds } from "./hlsPipeline";
import { downloadToFile, uploadFile } from "./r2";
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
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `cc-clip-${clipId}-`));

  try {
    const { data: clip, error } = await supabase.from("clips").select("rendered_segments").eq("id", clipId).single();
    if (error || !clip) throw error ?? new Error("Clip not found");
    const segments = (clip.rendered_segments ?? []) as RenderedSegment[];
    if (!segments.length) throw new Error("Clip has no uploaded segments");

    const optimized: RenderedSegment[] = [];
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
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
      await uploadFile(segment.key, outputPath, "video/mp4");
      const stat = await fs.stat(outputPath);
      const duration = await probeDurationSeconds(outputPath);
      optimized.push({
        ...segment,
        duration,
        play_start: 0,
        drawing_time_base: "clip",
        drawings: (segment.drawings ?? []).map((drawing, drawingIndex) => ({
          ...drawing,
          at_seconds: normalizedDrawingInputs.find((input) => input.sourceIndex === drawingIndex)?.atSeconds ?? drawing.at_seconds
        })),
        file_size: stat.size,
        video_codec: "avc",
        mobile_compatible: true
      });
    }

    const { error: updateError } = await supabase
      .from("clips")
      .update({ rendered_segments: optimized, render_status: "ready", render_error: null })
      .eq("id", clipId);
    if (updateError) throw updateError;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("clips").update({ render_status: "failed", render_error: message }).eq("id", clipId);
    throw error;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
