"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// R2 (like S3) rejects a single PUT over ~5GB. Anything at or above this
// threshold gets split into parts and sent via multipart upload instead.
const MULTIPART_THRESHOLD = 4 * 1024 * 1024 * 1024; // 4GB
const PART_SIZE = 100 * 1024 * 1024; // 100MB per part
const UPLOAD_CONCURRENCY = 4;

async function callMultipartApi(action: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/videos/multipart-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  if (!res.ok) throw new Error(`Multipart "${action}" request failed`);
  return res.json();
}

async function uploadSingle(file: File, key: string): Promise<string> {
  const res = await fetch("/api/videos/upload-url", {
    method: "POST",
    body: JSON.stringify({ key, contentType: file.type })
  });
  if (!res.ok) throw new Error("Could not get upload URL");
  const { uploadUrl, publicUrl } = await res.json();

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type }
  });
  if (!putRes.ok) throw new Error("Upload to storage failed");

  return publicUrl;
}

async function uploadMultipart(file: File, key: string, onProgress: (fraction: number) => void): Promise<string> {
  const { uploadId } = await callMultipartApi("create", { key, contentType: file.type });
  const totalParts = Math.ceil(file.size / PART_SIZE);

  try {
    const parts: { ETag: string; PartNumber: number }[] = [];
    let uploadedBytes = 0;
    let nextPartNumber = 1;

    async function worker() {
      while (nextPartNumber <= totalParts) {
        const partNumber = nextPartNumber++;
        const start = (partNumber - 1) * PART_SIZE;
        const end = Math.min(start + PART_SIZE, file.size);
        const chunk = file.slice(start, end);

        const { urls } = await callMultipartApi("part-urls", { key, uploadId, partNumbers: [partNumber] });
        const putRes = await fetch(urls[0].url, { method: "PUT", body: chunk });
        if (!putRes.ok) throw new Error(`Failed to upload part ${partNumber}`);

        const etag = putRes.headers.get("ETag");
        if (!etag) {
          throw new Error("Missing ETag on part response - check the R2 bucket CORS ExposeHeaders setting");
        }

        parts.push({ ETag: etag, PartNumber: partNumber });
        uploadedBytes += chunk.size;
        onProgress(uploadedBytes / file.size);
      }
    }

    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, totalParts) }, worker));

    parts.sort((a, b) => a.PartNumber - b.PartNumber);
    const { publicUrl } = await callMultipartApi("complete", { key, uploadId, parts });
    return publicUrl;
  } catch (error) {
    await callMultipartApi("abort", { key, uploadId }).catch(() => undefined);
    throw error;
  }
}

export function VideoUploader({ teamId, onUploaded }: { teamId: string | null; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const supabase = createClient();

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setProgress(0);
      setError("");

      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();

        const key = `videos/${crypto.randomUUID()}-${file.name}`;

        const publicUrl =
          file.size >= MULTIPART_THRESHOLD
            ? await uploadMultipart(file, key, setProgress)
            : await uploadSingle(file, key);

        const { data: video, error: insertError } = await supabase
          .from("videos")
          .insert({
            coach_id: user!.id,
            team_id: teamId,
            video_url: publicUrl,
            video_key: key,
            file_size: file.size,
            title: file.name.replace(/\.[^/.]+$/, "")
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        // Fire-and-forget: kicks off background compression to a
        // browser-friendly proxy. The coach can keep working from the raw
        // upload in the meantime - this just swaps the video in once ready.
        fetch(`/api/videos/${video.id}/process`, { method: "POST" }).catch(() => undefined);

        onUploaded();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        event.target.value = "";
      }
    },
    [teamId, onUploaded]
  );

  return (
    <div className="border-2 border-dashed border-borderButton rounded-xl p-8 text-center hover:border-accent transition">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
        id="video-upload"
      />
      <label htmlFor="video-upload" className="cursor-pointer">
        {uploading ? (
          <p className="text-textPrimary">Uploading... {progress > 0 ? `${Math.round(progress * 100)}%` : ""}</p>
        ) : (
          <div>
            <p className="text-textPrimary text-lg font-medium">Drop video here or click to browse</p>
            <p className="text-textMuted text-sm mt-1">MP4, MOV, WebM</p>
          </div>
        )}
      </label>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
