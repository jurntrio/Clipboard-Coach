import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildHlsProxy, probeDurationSeconds } from "./hlsPipeline";
import { deleteObject, downloadToFile, getPublicUrl, uploadFile } from "./r2";
import { supabase } from "./supabase";

export async function processVideo(videoId: string, sourceKey: string) {
  let workDir: string | null = null;
  let hlsDir: string | null = null;

  try {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), `cc-video-${videoId}-`));
    const rawPath = path.join(workDir, "source" + path.extname(sourceKey));
    await supabase.from("videos").update({ processing_status: "processing" }).eq("id", videoId);

    await downloadToFile(sourceKey, rawPath);
    const duration = await probeDurationSeconds(rawPath);
    const hlsResult = await buildHlsProxy(rawPath);
    hlsDir = hlsResult.dir;
    const proxyPrefix = `videos/${videoId}/proxy`;
    const files = await fs.readdir(hlsDir);

    for (const file of files) {
      const contentType = file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
      await uploadFile(`${proxyPrefix}/${file}`, path.join(hlsDir, file), contentType);
    }

    const playlistName = path.basename(hlsResult.playlistPath);
    await supabase.from("videos").update({
      video_url: getPublicUrl(`${proxyPrefix}/${playlistName}`),
      video_key: `${proxyPrefix}/${playlistName}`,
      duration,
      processing_status: "ready",
      processing_error: null
    }).eq("id", videoId);
    await deleteObject(sourceKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("videos").update({ processing_status: "failed", processing_error: message }).eq("id", videoId);
    throw error;
  } finally {
    if (hlsDir) await fs.rm(hlsDir, { recursive: true, force: true }).catch(() => undefined);
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
