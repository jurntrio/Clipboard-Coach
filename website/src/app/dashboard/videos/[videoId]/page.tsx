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
import {
  getRememberedLocalVideo,
  isLocalVideoUrl,
  localVideoFingerprint,
  rememberLocalVideo
} from "@/lib/local-video-store";

export default function VideoViewerPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reconnectInputRef = useRef<HTMLInputElement | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [standardTags, setStandardTags] = useState<StandardTag[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
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

  useEffect(() => {
    if (!video || !isLocalVideoUrl(video.video_url)) return;
    let active = true;
    void getRememberedLocalVideo(video.id).then((file) => {
      if (active && file) setLocalFile(file);
    });
    return () => { active = false; };
  }, [video]);

  useEffect(() => {
    if (!localFile) {
      setLocalVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(localFile);
    setLocalVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [localFile]);

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

  async function attachLocalFile(file: File, handle?: FileSystemFileHandle | null) {
    if (!video) return;
    const fingerprint = await localVideoFingerprint(file);
    if (video.video_key !== `local/${fingerprint}`) {
      setLocalError("That is not the same match file. Select the original video again.");
      return;
    }
    await rememberLocalVideo(video.id, file, handle);
    setLocalFile(file);
    setLocalError("");
  }

  async function reconnectLocalVideo() {
    if (!video) return;
    const remembered = await getRememberedLocalVideo(video.id, true);
    if (remembered) {
      setLocalFile(remembered);
      setLocalError("");
      return;
    }

    const picker = (window as unknown as {
      showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]>;
    }).showOpenFilePicker;
    if (!picker) {
      reconnectInputRef.current?.click();
      return;
    }
    try {
      const [handle] = await picker({ multiple: false, types: [{ description: "Video", accept: { "video/mp4": [".mp4", ".m4v"], "video/quicktime": [".mov"] } }] });
      if (handle) await attachLocalFile(await handle.getFile(), handle);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setLocalError(error instanceof Error ? error.message : "The video could not be opened.");
      }
    }
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
        <input
          ref={reconnectInputRef}
          type="file"
          accept=".mp4,.mov,.m4v,video/mp4,video/quicktime"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void attachLocalFile(file);
            event.target.value = "";
          }}
        />
        {video && isLocalVideoUrl(video.video_url) && !localVideoUrl ? (
          <div className="flex-1 min-h-0 grid place-items-center bg-black rounded-lg border border-border p-8 text-center">
            <div>
              <h2 className="text-textBright text-lg font-semibold">Reconnect the local match video</h2>
              <p className="text-textMuted text-sm mt-2 max-w-md">Your tags are saved online, but the full match remains on this PC. Select the same file to continue.</p>
              <button onClick={() => void reconnectLocalVideo()} className="mt-4 px-4 py-2 rounded-lg bg-accent text-page font-semibold">Select original video</button>
              {localError && <p className="mt-3 text-sm text-red-300">{localError}</p>}
            </div>
          </div>
        ) : (
          <VideoPlayer
            ref={videoRef}
            src={localVideoUrl ?? video?.video_url}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
          />
        )}
        <Timeline duration={duration} currentTime={currentTime} tags={tags} onSeek={seekTo} />
      </div>

      <div className="w-80 bg-card p-4 border-l border-border overflow-y-auto">
        <ClipBuilder
          videoId={videoId}
          teamId={video?.team_id ?? null}
          selectedTagIds={selectedTagIds}
          tags={tags}
          players={players}
          localVideo={isLocalVideoUrl(video?.video_url)}
          localFile={localFile}
          onClipCreated={() => setSelectedTagIds([])}
        />
      </div>
      </div>
    </div>
  );
}
