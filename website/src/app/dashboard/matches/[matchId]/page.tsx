"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getRememberedLocalVideo, isLocalVideoUrl, localVideoFingerprint, rememberLocalVideo } from "@/lib/local-video-store";
import { formatTime, getTagColor } from "@/lib/utils";
import { isPeriodMarker } from "@/lib/tags";
import type { Match, Player, StandardTag, Tag, Video } from "@/types/database";
import { VideoPlayer } from "@/components/video-player/VideoPlayer";
import { PlaybackControls } from "@/components/video-player/PlaybackControls";
import { Timeline } from "@/components/video-player/Timeline";
import { TagList } from "@/components/tags/TagList";
import { QuickTagCreator } from "@/components/tags/QuickTagCreator";
import { ClipBuilder } from "@/components/clips/ClipBuilder";
import { MatchDetailsCard } from "@/components/matches/MatchDetailsCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { inspectLocalVideo } from "@/lib/media/local-clips";

type MatchBlock = { id: string; sequence_order: number; label: string; videos: Video | null };
type MatchWithBlocks = Match & { match_videos: MatchBlock[] };

function messageFrom(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

export default function MatchViewerPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reconnectInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const reconnectVideoRef = useRef<Video | null>(null);
  const reconnectAllRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const autoPlayRef = useRef(false);
  const [match, setMatch] = useState<MatchWithBlocks | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [standardTags, setStandardTags] = useState<StandardTag[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [extraPlayers, setExtraPlayers] = useState<Player[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [combinedTime, setCombinedTime] = useState(0);
  const [error, setError] = useState("");
  const [supportsPersistentFileAccess, setSupportsPersistentFileAccess] = useState<boolean | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentUserId, setCurrentUserId] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [confirmDeleteMatch, setConfirmDeleteMatch] = useState(false);
  const [deletingMatch, setDeletingMatch] = useState(false);

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
  const markerTags = ["Start", "End"] as const;
  const clipTags = standardTags.filter((tag) => !isPeriodMarker(tag.name));

  useEffect(() => {
    void loadMatch();
    void loadStandardTags();
    void loadExtraPlayers();
    setSupportsPersistentFileAccess(typeof (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker === "function");
    void supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ""));
  }, [matchId]);

  useEffect(() => {
    if (!match?.team_a_id) { setPlayers([]); return; }
    void supabase.from("players").select("*").eq("team_id", match.team_a_id).neq("role", "staff").order("last_name").then(({ data }) => setPlayers(data ?? []));
  }, [match?.team_a_id]);

  useEffect(() => {
    if (!currentFile) { setPlaybackUrl(null); return; }
    const url = URL.createObjectURL(currentFile);
    setPlaybackUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [currentFile]);

  async function loadMatch() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: loadError } = await supabase.from("matches")
      .select("*, match_videos(id, sequence_order, label, videos(*))")
      .eq("id", matchId).single();
    if (loadError || !data) { setError(loadError?.message || "Match not found."); return; }
    const loaded = data as unknown as MatchWithBlocks;
    if (!user || loaded.coach_id !== user.id) { router.replace("/dashboard/clips"); return; }
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

  async function loadExtraPlayers() {
    const { data } = await supabase.from("teams").select("players(*)").ilike("name", "EXTRA");
    const groups = (data as unknown as { players: Player[] }[] | null) ?? [];
    setExtraPlayers(groups.flatMap((group) => group.players).filter((player) => player.role !== "staff"));
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
    if (!picker) { reconnectAllRef.current = false; reconnectVideoRef.current = video; reconnectInputRef.current?.click(); return; }
    try {
      const [handle] = await picker({ multiple: false, types: [{ description: "Match video", accept: { "video/mp4": [".mp4", ".m4v"], "video/quicktime": [".mov"] } }] });
      if (handle) await attachFile(video, await handle.getFile(), handle);
    } catch (pickerError) {
      if (!(pickerError instanceof DOMException && pickerError.name === "AbortError")) setError(messageFrom(pickerError, "The local video could not be opened."));
    }
  }

  async function reconnectAllVideos() {
    setError("");
    const missing: Video[] = [];
    const restored: Record<string, File> = {};
    for (const video of videos.filter((item) => isLocalVideoUrl(item.video_url))) {
      const file = await getRememberedLocalVideo(video.id, true);
      if (file) restored[video.id] = file;
      else missing.push(video);
    }
    if (Object.keys(restored).length) setFiles((current) => ({ ...current, ...restored }));
    if (!missing.length) return;

    const picker = (window as unknown as { showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker;
    if (!picker) {
      reconnectAllRef.current = true;
      reconnectVideoRef.current = null;
      reconnectInputRef.current?.click();
      return;
    }
    try {
      const handles = await picker({ multiple: true, types: [{ description: "Match videos", accept: { "video/mp4": [".mp4", ".m4v"], "video/quicktime": [".mov"] } }] });
      for (const handle of handles) {
        const file = await handle.getFile();
        const fingerprint = await localVideoFingerprint(file);
        const video = missing.find((item) => item.video_key === `local/${fingerprint}`);
        if (video) await attachFile(video, file, handle);
      }
    } catch (pickerError) {
      if (!(pickerError instanceof DOMException && pickerError.name === "AbortError")) setError(messageFrom(pickerError, "The local videos could not be reconnected."));
    }
  }

  async function handleFallbackSelection(selectedFiles: File[]) {
    if (!reconnectAllRef.current) {
      const video = reconnectVideoRef.current;
      if (selectedFiles[0] && video) await attachFile(video, selectedFiles[0]);
      return;
    }
    for (const file of selectedFiles) {
      const fingerprint = await localVideoFingerprint(file);
      const video = videos.find((item) => item.video_key === `local/${fingerprint}`);
      if (video) await attachFile(video, file);
    }
    reconnectAllRef.current = false;
  }

  async function replaceSelectedVideos(selections: { file: File; handle: FileSystemFileHandle | null }[]) {
    if (selections.length !== videos.length) {
      setError(`Select exactly ${videos.length} replacement video${videos.length === 1 ? "" : "s"}, in playback order.`);
      return;
    }
    setReplacing(true);
    setError("");
    try {
      for (let index = 0; index < videos.length; index += 1) {
        const video = videos[index];
        const selection = selections[index];
        const [info, fingerprint] = await Promise.all([inspectLocalVideo(selection.file), localVideoFingerprint(selection.file)]);
        const changes = { video_url: `local://${fingerprint}`, video_key: `local/${fingerprint}`, file_size: selection.file.size, duration: Math.round(info.duration), processing_status: "ready", title: selection.file.name.replace(/\.[^/.]+$/, "") };
        const { error: updateError } = await supabase.from("videos").update(changes).eq("id", video.id);
        if (updateError) throw updateError;
        await rememberLocalVideo(video.id, selection.file, selection.handle);
      }
      setCurrentIndex(0);
      setCombinedTime(0);
      await loadMatch();
    } catch (replaceError) {
      setError(messageFrom(replaceError, "The match videos could not be replaced."));
    } finally {
      setReplacing(false);
    }
  }

  async function chooseReplacementVideos() {
    const picker = (window as unknown as { showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker;
    if (!picker) { replaceInputRef.current?.click(); return; }
    try {
      const handles = await picker({ multiple: videos.length > 1, types: [{ description: "Replacement match videos", accept: { "video/mp4": [".mp4", ".m4v"], "video/quicktime": [".mov"] } }] });
      await replaceSelectedVideos(await Promise.all(handles.map(async (handle) => ({ file: await handle.getFile(), handle }))));
    } catch (pickerError) {
      if (!(pickerError instanceof DOMException && pickerError.name === "AbortError")) setError(messageFrom(pickerError, "The replacement videos could not be opened."));
    }
  }

  async function deleteMatch() {
    setDeletingMatch(true);
    const response = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) { setError(body?.error || "The match could not be deleted."); setDeletingMatch(false); setConfirmDeleteMatch(false); return; }
    router.push("/dashboard");
  }

  async function addTag(label: string) {
    if (!currentVideo || !label.trim()) return;
    const localTime = videoRef.current?.currentTime ?? Math.max(0, combinedTime - (offsets.map.get(currentVideo.id) ?? 0));
    const marker = isPeriodMarker(label);
    const { data, error: tagError } = await supabase.from("tags").insert({
      video_id: currentVideo.id,
      name: label.trim(),
      start_time: localTime,
      end_time: marker ? localTime : Math.min(currentVideo.duration ?? Number.POSITIVE_INFINITY, localTime + 5),
      color: getTagColor(label),
      player_ids: currentVideo.active_player_ids
    }).select().single();
    if (tagError) { setError(tagError.message); return; }
    if (data) setTags((current) => [...current, data].sort((a, b) => (offsets.map.get(a.video_id) ?? 0) + a.start_time - ((offsets.map.get(b.video_id) ?? 0) + b.start_time)));
  }

  async function updateTag(tagId: string, combinedStart: number, combinedEnd: number) {
    const tag = tags.find((item) => item.id === tagId);
    if (!tag) return;
    const offset = offsets.map.get(tag.video_id) ?? 0;
    const sourceVideo = videos.find((video) => video.id === tag.video_id);
    const maximum = sourceVideo?.duration ?? Number.POSITIVE_INFINITY;
    const startTime = Math.min(maximum, Math.max(0, combinedStart - offset));
    const requestedEnd = Math.min(maximum, Math.max(startTime, combinedEnd - offset));
    const endTime = isPeriodMarker(tag.name) ? startTime : requestedEnd;
    const { error: updateError } = await supabase.from("tags").update({ start_time: startTime, end_time: endTime }).eq("id", tagId);
    if (updateError) { setError(updateError.message); return; }
    setTags((current) => current
      .map((item) => item.id === tagId ? { ...item, start_time: startTime, end_time: endTime } : item)
      .sort((a, b) => (offsets.map.get(a.video_id) ?? 0) + a.start_time - ((offsets.map.get(b.video_id) ?? 0) + b.start_time)));
  }

  async function renameTag(tagId: string, name: string) {
    const { error: updateError } = await supabase.from("tags").update({ name, color: getTagColor(name) }).eq("id", tagId);
    if (!updateError) setTags((current) => current.map((tag) => tag.id === tagId ? { ...tag, name, color: getTagColor(name) } : tag));
  }

  async function deleteTag(tagId: string) {
    await supabase.from("tags").delete().eq("id", tagId);
    setTags((current) => current.filter((tag) => tag.id !== tagId));
    setSelectedTagIds((current) => current.filter((id) => id !== tagId));
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
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
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

  return (
    <div className="flex flex-col h-screen">
      <input ref={reconnectInputRef} type="file" multiple accept=".mp4,.mov,.m4v,video/mp4,video/quicktime" className="hidden" onChange={(event) => { void handleFallbackSelection(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      <input ref={replaceInputRef} type="file" multiple={videos.length > 1} accept=".mp4,.mov,.m4v,video/mp4,video/quicktime" className="hidden" onChange={(event) => { void replaceSelectedVideos(Array.from(event.target.files ?? []).map((file) => ({ file, handle: null }))); event.target.value = ""; }} />
      <div className="flex flex-1 min-h-0">
        <aside className="w-64 bg-card p-4 flex flex-col gap-4 overflow-y-auto border-r border-border">
          <Link href="/dashboard" title="Home" aria-label="Home" className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg border border-borderButton bg-button hover:border-accent"><Image src="/branding/home.png" alt="Home" width={28} height={28} /></Link>
          {match && <MatchDetailsCard match={match} videoCount={videos.length} onSaved={(updated) => setMatch((current) => current ? { ...current, ...updated } : current)} />}
          {match?.coach_id === currentUserId && <div className="grid gap-2"><button type="button" disabled={replacing || !videos.length} onClick={() => void chooseReplacementVideos()} className="rounded-lg border border-borderButton bg-button px-3 py-2 text-sm font-semibold text-textPrimary hover:border-accent disabled:opacity-50">{replacing ? "Replacing videos..." : "Replace match videos"}</button><button type="button" disabled={replacing} onClick={() => setConfirmDeleteMatch(true)} className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50">Delete match</button></div>}
          <PlaybackControls isPlaying={isPlaying} playbackRate={playbackRate} onBack={() => seekTo(Math.max(0, combinedTime - 5))} onTogglePlay={togglePlayback} onCycleSpeed={cyclePlaybackRate} />
          <div><h3 className="mb-2 text-sm font-semibold text-textBright">Period markers</h3><div className="space-y-2">{markerTags.map((name) => <button key={name} type="button" onClick={() => void addTag(name)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-borderButton bg-button py-2 text-textPrimary hover:bg-cardHover"><span className={`relative inline-block h-4 w-4 border-l-2 ${name === "End" ? "border-white" : "border-accent"}`}><span className={`absolute left-0 top-0 h-2.5 w-3 rounded-r-sm ${name === "End" ? "border border-white" : "bg-accent"}`} style={name === "End" ? { backgroundImage: "conic-gradient(#fff 25%, #111 0 50%, #fff 0 75%, #111 0)", backgroundSize: "5px 5px" } : undefined} /></span>{name}</button>)}</div></div>
          {displayTags.some((tag) => isPeriodMarker(tag.name)) && (
            <details className="rounded-lg border border-border bg-cardDeep px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-textBright">Period times</summary>
              <div className="mt-2">
              <TagList tags={displayTags.filter((tag) => isPeriodMarker(tag.name))} selectedTagIds={[]} onToggleSelect={() => undefined} onSeek={seekTo} onDelete={(id) => void deleteTag(id)} onUpdate={updateTag} />
              </div>
            </details>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-textBright">Add clip tag</h3>
            <div className="grid grid-cols-1 gap-2">
              {clipTags.map((tag) => <button key={tag.id} onClick={() => void addTag(tag.name)} className="rounded-lg border border-borderButton bg-button px-2 py-2 text-sm text-textPrimary hover:bg-cardHover">{tag.name}</button>)}
            </div>
            <div className="mt-2"><QuickTagCreator onCreated={(tag) => setStandardTags((current) => [...current, tag])} /></div>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 flex flex-col p-4 gap-3">
          {currentVideo && isLocalVideoUrl(currentVideo.video_url) && !currentFile ? <div className="flex-1 grid place-items-center bg-black rounded-lg border border-border p-8 text-center"><div><h2 className="text-textBright text-lg font-semibold">Reconnect video {currentIndex + 1}</h2><p className="text-textMuted text-sm mt-2">Select the original files. The match and tags are already saved.</p>{supportsPersistentFileAccess === false && <p className="mt-2 text-xs text-amber-300">This browser cannot restore local files automatically. Use Chrome or Edge for persistent reconnect.</p>}<div className="mt-4 flex flex-wrap justify-center gap-2"><button onClick={() => void reconnectAllVideos()} className="px-4 py-2 rounded-lg bg-accent text-page font-semibold">Reconnect all videos</button><button onClick={() => void reconnect(currentVideo)} className="px-4 py-2 rounded-lg bg-button text-textPrimary">Only video {currentIndex + 1}</button></div></div></div> : <VideoPlayer ref={videoRef} src={playbackUrl ?? currentVideo?.video_url} onTimeUpdate={(time) => setCombinedTime((offsets.map.get(currentVideo?.id ?? "") ?? 0) + time)} onDurationChange={onVideoReady} onEnded={playNext} onPlayingChange={setIsPlaying} />}
          <div className="flex min-h-12 overflow-hidden rounded-lg border border-border bg-cardDeep" aria-label="Match video sequence">
            {videos.map((video, index) => (
              <button
                key={video.id}
                type="button"
                onClick={() => seekTo(offsets.map.get(video.id) ?? 0)}
                style={{ flexGrow: Math.max(1, video.duration ?? 0), flexBasis: 0 }}
                className={`min-w-[72px] border-r border-border px-2 py-1 text-center text-xs last:border-r-0 ${index === currentIndex ? "bg-accentDim text-textBright" : "text-textSecondary hover:bg-cardHover"}`}
                title={`${video.title || `Video ${index + 1}`} · ${formatTime(video.duration ?? 0)}`}
              >
                <span className="block truncate font-semibold">Video {index + 1}</span>
                <span className="block text-[10px] text-textMuted">{formatTime(video.duration ?? 0)}{isLocalVideoUrl(video.video_url) && !files[video.id] ? " · reconnect" : ""}</span>
              </button>
            ))}
          </div>
          <Timeline duration={offsets.total} currentTime={combinedTime} tags={displayTags} onSeek={seekTo} />
          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        </main>

        <aside className="w-96 bg-card p-4 border-l border-border overflow-y-auto space-y-4">
          <section className="min-h-0">
            <h3 className="mb-2 font-semibold text-textBright">Tagged clips</h3>
            <TagList tags={displayTags.filter((tag) => !isPeriodMarker(tag.name))} selectedTagIds={selectedTagIds} onToggleSelect={(id) => setSelectedTagIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onSeek={seekTo} onDelete={(id) => void deleteTag(id)} onUpdate={updateTag} onRename={renameTag} />
          </section>
          {videos[0] && <ClipBuilder videoId={videos[0].id} teamId={match?.team_a_id ?? null} selectedTagIds={selectedTagIds} tags={tags} players={players} extraPlayers={extraPlayers} localVideo localFile={files[videos[0].id] ?? null} localFilesByVideoId={files} localSourcesReady={localFilesReady} onClipCreated={() => setSelectedTagIds([])} />}
        </aside>
      </div>
      <ConfirmDialog open={confirmDeleteMatch} title="Delete match?" message="Delete this match, its exclusively linked videos, tags and clips? This cannot be undone." busy={deletingMatch} onCancel={() => setConfirmDeleteMatch(false)} onConfirm={() => void deleteMatch()} />
    </div>
  );
}
