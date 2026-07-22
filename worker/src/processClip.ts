import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildMobileMp4 } from "./hlsPipeline";
import { downloadToFile, uploadFile } from "./r2";
import { supabase } from "./supabase";

type RenderedSegment = {
  id: string;
  key: string;
  url: string;
  file_size: number;
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
      await buildMobileMp4(inputPath, outputPath);
      await uploadFile(segment.key, outputPath, "video/mp4");
      const stat = await fs.stat(outputPath);
      optimized.push({ ...segment, file_size: stat.size, video_codec: "avc", mobile_compatible: true });
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
