"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Team, Video } from "@/types/database";
import { VideoUploader } from "@/components/videos/VideoUploader";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const supabase = createClient();

  useEffect(() => {
    loadTeams();
    loadVideos();
  }, []);

  async function loadTeams() {
    const { data } = await supabase.from("teams").select("*").order("name");
    setTeams(data ?? []);
  }

  async function loadVideos() {
    const { data } = await supabase
      .from("videos")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    setVideos(data ?? []);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <SectionHeader title="Videos" artworkSrc="/branding/video-viewer.png" />

      <div className="max-w-xl mb-8 space-y-3">
        <select
          value={teamId}
          onChange={(event) => setTeamId(event.target.value)}
          className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border"
        >
          <option value="">No team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <VideoUploader teamId={teamId || null} onUploaded={loadVideos} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video) => (
          <Link
            key={video.id}
            href={`/dashboard/videos/${video.id}`}
            className="bg-card rounded-xl border border-border p-4 hover:bg-cardHover transition"
          >
            <p className="text-textBright font-medium truncate">{video.title || "Untitled video"}</p>
            <p className="text-textMuted text-sm mt-1">{new Date(video.created_at).toLocaleDateString()}</p>
            {video.processing_status === "processing" && (
              <p className="text-amber-400 text-xs mt-1">Compressing in the background…</p>
            )}
            {video.processing_status === "failed" && (
              <p className="text-red-400 text-xs mt-1">Compression failed — still playable from the original</p>
            )}
          </Link>
        ))}
        {videos.length === 0 && <p className="text-textMuted">No videos uploaded yet.</p>}
      </div>
    </div>
  );
}
