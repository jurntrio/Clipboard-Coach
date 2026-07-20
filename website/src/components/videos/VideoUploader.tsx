"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function VideoUploader({ teamId, onUploaded }: { teamId: string | null; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setError("");

      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();

        const key = `videos/${crypto.randomUUID()}-${file.name}`;
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
          <p className="text-textPrimary">Uploading...</p>
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
