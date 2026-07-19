"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Player, StandardTag, Tag, Video } from "@/types/database";
import { VideoPlayer } from "@/components/video-player/VideoPlayer";
import { Timeline } from "@/components/video-player/Timeline";
import { TagList } from "@/components/tags/TagList";
import { ActivePlayerSelector } from "@/components/teams/ActivePlayerSelector";
import { ClipBuilder } from "@/components/clips/ClipBuilder";
import { getTagColor } from "@/lib/utils";

export default function VideoViewerPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [standardTags, setStandardTags] = useState<StandardTag[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [newTagLabel, setNewTagLabel] = useState("");
  const supabase = createClient();

  useEffect(() => {
    loadVideo();
    loadTags();
    loadStandardTags();
  }, [videoId]);

  useEffect(() => {
    if (video?.team_id) {
      loadPlayers(video.team_id);
    } else {
      setPlayers([]);
    }
  }, [video?.team_id]);

  async function loadVideo() {
    const { data } = await supabase.from("videos").select("*").eq("id", videoId).single();
    setVideo(data);
  }

  async function loadTags() {
    const { data } = await supabase
      .from("tags")
      .select("*")
      .eq("video_id", videoId)
      .order("start_time", { ascending: true });

    setTags(data ?? []);
  }

  async function loadStandardTags() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from("standard_tags").select("*").eq("coach_id", user.id).order("created_at");
    setStandardTags(data ?? []);
  }

  async function loadPlayers(teamId: string) {
    const { data } = await supabase.from("players").select("*").eq("team_id", teamId).order("last_name");
    setPlayers(data ?? []);
  }

  async function addTag(label: string) {
    if (!label.trim() || !video) return;

    const startTime = currentTime;
    const { data, error } = await supabase
      .from("tags")
      .insert({
        video_id: video.id,
        name: label.trim(),
        start_time: startTime,
        end_time: startTime + 5,
        color: getTagColor(label),
        player_ids: video.active_player_ids
      })
      .select()
      .single();

    if (!error && data) {
      setTags((current) => [...current, data].sort((a, b) => a.start_time - b.start_time));
    }
  }

  async function deleteTag(tagId: string) {
    await supabase.from("tags").delete().eq("id", tagId);
    setTags((current) => current.filter((tag) => tag.id !== tagId));
    setSelectedTagIds((current) => current.filter((id) => id !== tagId));
  }

  async function updateActivePlayers(playerIds: string[]) {
    if (!video) return;
    setVideo({ ...video, active_player_ids: playerIds });
    await supabase.from("videos").update({ active_player_ids: playerIds }).eq("id", video.id);
  }

  function seekTo(time: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }

  function toggleTagSelected(tagId: string) {
    setSelectedTagIds((current) => (current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]));
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
        <Link
          href="/dashboard"
          title="Home"
          className="flex-shrink-0 w-12 h-12 rounded-lg bg-button border border-borderButton flex items-center justify-center hover:border-accent hover:bg-cardHover transition"
        >
          <Image src="/branding/home.png" alt="Home" width={28} height={28} />
        </Link>
        <p className="text-textBright font-semibold">{video?.title || "Untitled video"}</p>
      </div>

      <div className="flex flex-1 min-h-0">
      <div className="w-64 bg-card p-4 flex flex-col gap-4 overflow-y-auto border-r border-border">
        <ActivePlayerSelector players={players} selected={video?.active_player_ids ?? []} onChange={updateActivePlayers} />

        <div className="space-y-2">
          {standardTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => addTag(tag.name)}
              className="w-full py-2 bg-button border border-borderButton text-textPrimary rounded-lg hover:bg-cardHover"
            >
              {tag.name}
            </button>
          ))}
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="Custom tag"
              value={newTagLabel}
              onChange={(event) => setNewTagLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && newTagLabel.trim()) {
                  addTag(newTagLabel);
                  setNewTagLabel("");
                }
              }}
              className="flex-1 px-2 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <h3 className="text-textBright font-semibold mb-2">Tags</h3>
          <TagList
            tags={tags}
            selectedTagIds={selectedTagIds}
            onToggleSelect={toggleTagSelected}
            onSeek={seekTo}
            onDelete={deleteTag}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-3">
        <VideoPlayer
          ref={videoRef}
          src={video?.video_url}
          onTimeUpdate={setCurrentTime}
          onDurationChange={setDuration}
        />
        <Timeline duration={duration} currentTime={currentTime} tags={tags} onSeek={seekTo} />
      </div>

      <div className="w-80 bg-card p-4 border-l border-border overflow-y-auto">
        <ClipBuilder
          videoId={videoId}
          teamId={video?.team_id ?? null}
          selectedTagIds={selectedTagIds}
          tags={tags}
          players={players}
          onClipCreated={() => setSelectedTagIds([])}
        />
      </div>
      </div>
    </div>
  );
}
