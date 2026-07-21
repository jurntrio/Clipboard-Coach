"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getRememberedLocalVideo, isLocalVideoUrl, localVideoFingerprint, rememberLocalVideo } from "@/lib/local-video-store";
import { getTagColor } from "@/lib/utils";
import type { Match, Player, StandardTag, Tag, Video } from "@/types/database";
import { VideoPlayer } from "@/components/video-player/VideoPlayer";
import { Timeline } from "@/components/video-player/Timeline";
import { TagList } from "@/components/tags/TagList";
import { ActivePlayerSelector } from "@/components/teams/ActivePlayerSelector";
import { ClipBuilder } from "@/components/clips/ClipBuilder";

type MatchBlock = { id: string; sequence_order: number; label: string; videos: Video | null };
type MatchWithBlocks = Match & { match_videos: MatchBlock[] };

function messageFrom(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

export default function MatchViewerPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reconnectInputRef = useRef<HTMLInputElement | null>(null);
  const reconnectVideoRef = useRef<Video | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const autoPlayRef = useRef(false);
  const [match, setMatch] = useState<MatchWithBlocks | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [standardTags, setStandardTags] = useState<StandardTag[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [combinedTime, setCombinedTime] = useState(0);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [error, setError] = useState("");

  const blocks = useMemo(() => [...(match?.match_videos ?? [])].sort((a, b) => a.sequence_order - b.sequence_order), [match]);
  const videos = useMemo(() => blocks.map((block) => block.videos).filter((video): video is Video => !!video), [blocks]);
  const offsets = useMemo(() => {
    const map = new Map<string, number>();
    let offset = 0;
    for (const video of videos) {
      map.set(video.id, offset);
      offset += video.duration ?? 0;
    }
    return { map, total: offset };
  }, [videos]);
  const currentVideo = videos[currentIndex] ?? null;
  const currentFile = currentVideo ? files[currentVideo.id] : null;
  const localFilesReady = videos.filter((video) => isLocalVideoUrl(video.video_url)).every((video) => !!files[video.id]);
  const displayTags = useMemo(() => tags.map((tag) => {
    const offset = offsets.map.get(tag.video_id) ?? 0;
    return { ...tag, start_time: tag.start_time + offset, end_time: tag.end_time + offset };
  }), [offsets, tags]);

  useEffect(() => { void loadMatch(); void loadStandardTags(); }, [matchId]);

  useEffect(() => {
    if (!match?.team_a_id) { setPlayers([]); return; }
    void supabase.from("players").select("*").eq("team_id", match.team_a_id).order("last_name").then(({ data }) => setPlayers(data ?? []));
  }, [match?.team_a_id]);

  useEffect(() => {
    if (!currentFile) { setPlaybackUrl(null); return; }
    const url = URL.createObjectURL(currentFile);
    setPlaybackUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [currentFile]);

  async function loadMatch() {
    const { data, error: loadError } = await supabase.from("matches")
      .select("*, match_videos(id, sequence_order, label, videos(*))")
      .eq("id", matchId).single();
    if (loadError || !data) { setError(loadError?.message || "Match not found."); return; }
    const loaded = data as unknown as MatchWithBlocks;
    setMatch(loaded);
    const loadedVideos = loaded.match_videos.map((block) => block.videos).filter((video): video is Video => !!video);
    if (loadedVideos.length) {
      const [{ data: tagData }, remembered] = await Promise.all([
        supabase.from("tags").select("*").in("video_id", loadedVideos.map((video) => video.id)),
        Promise.all(loadedVideos.map(async (video) => [video.id, await getRememberedLocalVideo(video.id)] as const))
      ]);
      const order = new Map(loadedVideos.map((video, index) => [video.id, index]));
      setTags((tagData ?? []).sort((a, b) => (order.get(a.video_id) ?? 0) - (order.get(b.video_id) ?? 0) || a.start_time - b.start_time));
      setFiles(Object.fromEntries(remembered.filter((entry): entry is readonly [string, File] => !!entry[1])));
    }
  }

  async function loadStandardTags() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("standard_tags").select("*").eq("coach_id", user.id).order("created_at");
    setStandardTags(data ?? []);
  }

  async function attachFile(video: Video, file: File, handle?: FileSystemFileHandle | null) {
    try {
      const fingerprint = await localVideoFingerprint(file);
      if (video.video_key !== `local/${fingerprint}`) throw new Error("That is not the original file for this video block.");
      await rememberLocalVideo(video.id, file, handle);
      setFiles((current) => ({ ...current, [video.id]: file }));
      setError("");
    } catch (attachError) {
      setError(messageFrom(attachError, "The local video could not be opened."));
    }
  }

  async function reconnect(video: Video) {
    const remembered = await getRememberedLocalVideo(video.id, true);
    if (remembered) { setFiles((current) => ({ ...current, [video.id]: remembered })); return; }
    const picker = (window as unknown as { showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker;
    if (!picker) { reconnectVideoRef.current = video; reconnectInputRef.current?.click(); return; }
    try {
      const [handle] = await picker({ multiple: false, types: [{ description: "Match video", accept: { "video/mp4": [".mp4", ".m4v"], "video/quicktime": [".mov"] } }] });
      if (handle) await attachFile(video, await handle.getFile(), handle);
    } catch (pickerError) {
      if (!(pickerError instanceof DOMException && pickerError.name === "AbortError")) setError(messageFrom(pickerError, "The local video could not be opened."));
    }
  }

  async function addTag(label: string) {
    if (!currentVideo || !label.trim()) return;
    const localTime = videoRef.current?.currentTime ?? Math.max(0, combinedTime - (offsets.map.get(currentVideo.id) ?? 0));
    const { data, error: tagError } = await supabase.from("tags").insert({
      video_id: currentVideo.id,
      name: label.trim(),
      start_time: localTime,
      end_time: localTime + 5,
      color: getTagColor(label),
      player_ids: currentVideo.active_player_ids
    }).select().single();
    if (tagError) { setError(tagError.message); return; }
    if (data) setTags((current) => [...current, data].sort((a, b) => (offsets.map.get(a.video_id) ?? 0) + a.start_time - ((offsets.map.get(b.video_id) ?? 0) + b.start_time)));
  }

  async function deleteTag(tagId: string) {
    await supabase.from("tags").delete().eq("id", tagId);
    setTags((current) => current.filter((tag) => tag.id !== tagId));
    setSelectedTagIds((current) => current.filter((id) => id !== tagId));
  }

  async function updateActivePlayers(playerIds: string[]) {
    if (!videos.length) return;
    setMatch((current) => current ? { ...current, match_videos: current.match_videos.map((block) => block.videos ? { ...block, videos: { ...block.videos, active_player_ids: playerIds } } : block) } : current);
    await supabase.from("videos").update({ active_player_ids: playerIds }).in("id", videos.map((video) => video.id));
  }

  function seekTo(time: number) {
    if (!videos.length) return;
    let targetIndex = videos.length - 1;
    for (let index = 0; index < videos.length; index += 1) {
      const start = offsets.map.get(videos[index].id) ?? 0;
      const end = start + (videos[index].duration ?? 0);
      if (time < end || index === videos.length - 1) { targetIndex = index; break; }
    }
    const localTime = Math.max(0, time - (offsets.map.get(videos[targetIndex].id) ?? 0));
    pendingSeekRef.current = localTime;
    setCombinedTime(time);
    if (targetIndex === currentIndex && videoRef.current) {
      videoRef.current.currentTime = localTime;
      pendingSeekRef.current = null;
    } else setCurrentIndex(targetIndex);
  }

  function onVideoReady() {
    if (pendingSeekRef.current !== null && videoRef.current) {
      videoRef.current.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;
    }
    if (autoPlayRef.current) {
      autoPlayRef.current = false;
      void videoRef.current?.play().catch(() => undefined);
    }
  }

  function playNext() {
    if (currentIndex >= videos.length - 1) return;
    pendingSeekRef.current = 0;
    autoPlayRef.current = true;
    setCurrentIndex((index) => index + 1);
  }

  const title = match ? `${match.team_a_name || "Team A"} – ${match.team_b_name || "Team B"}` : "Match";

  return (
    <div className="flex flex-col h-screen">
      <input ref={reconnectInputRef} type="file" accept=".mp4,.mov,.m4v,video/mp4,video/quicktime" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; const video = reconnectVideoRef.current; if (file && video) void attachFile(video, file); event.target.value = ""; }} />
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
        <Link href="/dashboard/videos" title="Video Viewer" className="w-12 h-12 rounded-lg bg-button border border-borderButton flex items-center justify-center"><Image src="/branding/video-viewer.png" alt="Video Viewer" width={30} height={30} /></Link>
        <div><p className="text-textBright font-semibold">{title}</p><p className="text-xs text-textMuted">{match?.match_date || "No date"} · {videos.length} videos</p></div>
      </div>

      <div className="flex flex-1 min-h-0">
        <aside className="w-64 bg-card p-4 flex flex-col gap-4 overflow-y-auto border-r border-border">
          <ActivePlayerSelector players={players} selected={currentVideo?.active_player_ids ?? []} onChange={updateActivePlayers} />
          <div className="space-y-2">{standardTags.map((tag) => <button key={tag.id} onClick={() => void addTag(tag.name)} className="w-full py-2 bg-button border border-borderButton text-textPrimary rounded-lg hover:bg-cardHover">{tag.name}</button>)}<input value={newTagLabel} onChange={(event) => setNewTagLabel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && newTagLabel.trim()) { void addTag(newTagLabel); setNewTagLabel(""); } }} placeholder="Custom tag" className="w-full px-2 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm" /></div>
          <div className="flex-1 min-h-0 flex flex-col"><h3 className="text-textBright font-semibold mb-2">Tags</h3><TagList tags={displayTags} selectedTagIds={selectedTagIds} onToggleSelect={(id) => setSelectedTagIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onSeek={seekTo} onDelete={(id) => void deleteTag(id)} /></div>
        </aside>

        <main className="flex-1 flex flex-col p-4 gap-3 min-w-0">
          <div className="flex gap-2 overflow-x-auto pb-1">{videos.map((video, index) => <button key={video.id} onClick={() => seekTo(offsets.map.get(video.id) ?? 0)} className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${index === currentIndex ? "border-accent bg-accentDim text-textBright" : "border-border bg-button text-textSecondary"}`}>Video {index + 1}{isLocalVideoUrl(video.video_url) && !files[video.id] ? " · reconnect" : ""}</button>)}</div>
          {currentVideo && isLocalVideoUrl(currentVideo.video_url) && !currentFile ? <div className="flex-1 grid place-items-center bg-black rounded-lg border border-border p-8 text-center"><div><h2 className="text-textBright text-lg font-semibold">Reconnect video {currentIndex + 1}</h2><p className="text-textMuted text-sm mt-2">Select the original file. The match and tags are already saved.</p><button onClick={() => void reconnect(currentVideo)} className="mt-4 px-4 py-2 rounded-lg bg-accent text-page font-semibold">Select original video</button></div></div> : <VideoPlayer ref={videoRef} src={playbackUrl ?? currentVideo?.video_url} onTimeUpdate={(time) => setCombinedTime((offsets.map.get(currentVideo?.id ?? "") ?? 0) + time)} onDurationChange={onVideoReady} onEnded={playNext} />}
          <Timeline duration={offsets.total} currentTime={combinedTime} tags={displayTags} onSeek={seekTo} />
          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        </main>

        <aside className="w-80 bg-card p-4 border-l border-border overflow-y-auto">
          {videos[0] && <ClipBuilder videoId={videos[0].id} teamId={match?.team_a_id ?? null} selectedTagIds={selectedTagIds} tags={tags} players={players} localVideo localFile={files[videos[0].id] ?? null} localFilesByVideoId={files} localSourcesReady={localFilesReady} onClipCreated={() => setSelectedTagIds([])} />}
        </aside>
      </div>
    </div>
  );
}
