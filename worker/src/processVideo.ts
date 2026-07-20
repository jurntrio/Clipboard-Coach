import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildHlsProxy, probeDurationSeconds } from "./hlsPipeline";
import { deleteObject, downloadToFile, getPublicUrl, uploadFile } from "./r2";
import { supabase } from "./supabase";

export async function processVideo(videoId: string, sourceKey: string) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `cc-video-${videoId}-`));
  const rawPath = path.join(workDir, "source" + path.extname(sourceKey));

  try {
    await supabase.from("videos").update({ processing_status: "processing" }).eq("id", videoId);

    await downloadToFile(sourceKey, rawPath);
    const duration = await probeDurationSeconds(rawPath);
    const { dir: hlsDir, playlistPath } = await buildHlsProxy(rawPath);

    const proxyPrefix = `videos/${videoId}/proxy`;
    const files = await fs.readdir(hlsDir);

    for (const file of files) {
      const contentType = file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
      await uploadFile(`${proxyPrefix}/${file}`, path.join(hlsDir, file), contentType);
    }

    const playlistUrl = getPublicUrl(`${proxyPrefix}/${path.basename(playlistPath)}`);

    await supabase
      .from("videos")
      .update({
        video_url: playlistUrl,
        video_key: `${proxyPrefix}/${path.basename(playlistPath)}`,
        duration,
        processing_status: "ready",
        processing_error: null
      })
      .eq("id", videoId);

    await deleteObject(sourceKey);
    await fs.rm(hlsDir, { recursive: true, force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("videos").update({ processing_status: "failed", processing_error: message }).eq("id", videoId);
    throw error;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
