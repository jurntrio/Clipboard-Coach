"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Player, StandardTag, Tag, Video } from "@/types/database";
import { VideoPlayer } from "@/components/video-player/VideoPlayer";
import { PlaybackControls } from "@/components/video-player/PlaybackControls";
import { Timeline } from "@/components/video-player/Timeline";
import { TagList } from "@/components/tags/TagList";
import { QuickTagCreator } from "@/components/tags/QuickTagCreator";
import { ClipBuilder } from "@/components/clips/ClipBuilder";
import { getTagColor } from "@/lib/utils";
import { isPeriodMarker } from "@/lib/tags";
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
  const [extraPlayers, setExtraPlayers] = useState<Player[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const supabase = createClient();

  useEffect(() => {
    loadVideo();
    loadTags();
    loadStandardTags();
    loadExtraPlayers();
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
    const { data } = await supabase.from("players").select("*").eq("team_id", teamId).neq("role", "staff").order("last_name");
    setPlayers(data ?? []);
  }

  async function loadExtraPlayers() {
    const { data } = await supabase.from("teams").select("players(*)").ilike("name", "EXTRA");
    const groups = (data as unknown as { players: Player[] }[] | null) ?? [];
    setExtraPlayers(groups.flatMap((group) => group.players).filter((player) => player.role !== "staff"));
  }

  async function addTag(label: string) {
    if (!label.trim() || !video) return;

    const startTime = currentTime;
    const marker = isPeriodMarker(label);
    const { data, error } = await supabase
      .from("tags")
      .insert({
        video_id: video.id,
        name: label.trim(),
        start_time: startTime,
        end_time: marker ? startTime : Math.min(duration || Number.POSITIVE_INFINITY, startTime + 5),
        color: getTagColor(label),
        player_ids: video.active_player_ids
      })
      .select()
      .single();

    if (!error && data) {
      setTags((current) => [...current, data].sort((a, b) => a.start_time - b.start_time));
    }
  }

  async function updateTag(tagId: string, startTime: number, endTime: number) {
    const tag = tags.find((item) => item.id === tagId);
    if (!tag) return;
    const safeStart = Math.min(duration || Number.POSITIVE_INFINITY, Math.max(0, startTime));
    const safeEnd = isPeriodMarker(tag.name) ? safeStart : Math.min(duration || Number.POSITIVE_INFINITY, Math.max(safeStart, endTime));
    const { error } = await supabase.from("tags").update({ start_time: safeStart, end_time: safeEnd }).eq("id", tagId);
    if (!error) setTags((current) => current.map((item) => item.id === tagId ? { ...item, start_time: safeStart, end_time: safeEnd } : item).sort((a, b) => a.start_time - b.start_time));
  }

  async function renameTag(tagId: string, name: string) {
    const { error } = await supabase.from("tags").update({ name, color: getTagColor(name) }).eq("id", tagId);
    if (!error) setTags((current) => current.map((tag) => tag.id === tagId ? { ...tag, name, color: getTagColor(name) } : tag));
  }

  async function deleteTag(tagId: string) {
    await supabase.from("tags").delete().eq("id", tagId);
    setTags((current) => current.filter((tag) => tag.id !== tagId));
    setSelectedTagIds((current) => current.filter((id) => id !== tagId));
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

  function togglePlayback() {
    const player = videoRef.current;
    if (!player) return;
    if (player.paused) void player.play().catch(() => undefined);
    else player.pause();
  }

  function cyclePlaybackRate() {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (videoRef.current) videoRef.current.playbackRate = nextRate;
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
      <div className="flex flex-1 min-h-0">
      <div className="w-64 bg-card p-4 flex flex-col gap-4 overflow-y-auto border-r border-border">
        <div className="flex items-center gap-3"><Link href="/dashboard" title="Home" aria-label="Home" className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg border border-borderButton bg-button hover:border-accent"><Image src="/branding/home.png" alt="Home" width={28} height={28} /></Link><p className="min-w-0 truncate text-sm font-semibold text-textBright">{video?.title || "Untitled video"}</p></div>
        <PlaybackControls isPlaying={isPlaying} playbackRate={playbackRate} onBack={() => seekTo(Math.max(0, currentTime - 5))} onTogglePlay={togglePlayback} onCycleSpeed={cyclePlaybackRate} />
        <div className="space-y-2"><h3 className="text-sm font-semibold text-textBright">Period markers</h3>{(["Start", "End"] as const).map((name) => <button key={name} type="button" onClick={() => void addTag(name)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-borderButton bg-button py-2 text-textPrimary hover:bg-cardHover"><span className={`relative inline-block h-4 w-4 border-l-2 ${name === "End" ? "border-white" : "border-accent"}`}><span className={`absolute left-0 top-0 h-2.5 w-3 rounded-r-sm ${name === "End" ? "border border-white" : "bg-accent"}`} style={name === "End" ? { backgroundImage: "conic-gradient(#fff 25%, #111 0 50%, #fff 0 75%, #111 0)", backgroundSize: "5px 5px" } : undefined} /></span>{name}</button>)}</div>
        {tags.some((tag) => isPeriodMarker(tag.name)) && (
          <details className="rounded-lg border border-border bg-cardDeep px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-textBright">Period times</summary>
            <div className="mt-2">
            <TagList tags={tags.filter((tag) => isPeriodMarker(tag.name))} selectedTagIds={[]} onToggleSelect={() => undefined} onSeek={seekTo} onDelete={deleteTag} onUpdate={updateTag} />
            </div>
          </details>
        )}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-textBright">Add clip tag</h3>
          <div className="grid grid-cols-1 gap-2">
            {standardTags.filter((tag) => !isPeriodMarker(tag.name)).map((tag) => <button key={tag.id} onClick={() => void addTag(tag.name)} className="rounded-lg border border-borderButton bg-button px-2 py-2 text-sm text-textPrimary hover:bg-cardHover">{tag.name}</button>)}
          </div>
          <div className="mt-2"><QuickTagCreator onCreated={(tag) => setStandardTags((current) => [...current, tag])} /></div>
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 flex flex-col p-4 gap-3">
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
            onDurationChange={(value) => { setDuration(value); if (videoRef.current) videoRef.current.playbackRate = playbackRate; }}
            onPlayingChange={setIsPlaying}
          />
        )}
        <Timeline duration={duration} currentTime={currentTime} tags={tags} onSeek={seekTo} />
      </div>

      <div className="w-96 bg-card p-4 border-l border-border overflow-y-auto space-y-4">
        <section>
          <h3 className="mb-2 font-semibold text-textBright">Tagged clips</h3>
          <TagList tags={tags.filter((tag) => !isPeriodMarker(tag.name))} selectedTagIds={selectedTagIds} onToggleSelect={toggleTagSelected} onSeek={seekTo} onDelete={deleteTag} onUpdate={updateTag} onRename={renameTag} />
        </section>
        <ClipBuilder
          videoId={videoId}
          teamId={video?.team_id ?? null}
          selectedTagIds={selectedTagIds}
          tags={tags}
          players={players}
          extraPlayers={extraPlayers}
          localVideo={isLocalVideoUrl(video?.video_url)}
          localFile={localFile}
          onClipCreated={() => setSelectedTagIds([])}
        />
      </div>
      </div>
    </div>
  );
}
