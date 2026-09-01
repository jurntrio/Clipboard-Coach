"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Player, StandardTag, Tag, TagDrawing, Video } from "@/types/database";
import { VideoPlayer } from "@/components/video-player/VideoPlayer";
import { PlaybackControls } from "@/components/video-player/PlaybackControls";
import { Timeline } from "@/components/video-player/Timeline";
import { TagList } from "@/components/tags/TagList";
import { QuickTagCreator } from "@/components/tags/QuickTagCreator";
import { PhaseTagDialog } from "@/components/tags/PhaseTagDialog";
import { getTagColor, formatTime } from "@/lib/utils";
import { isPeriodMarker } from "@/lib/tags";
import { useI18n } from "@/i18n/client";
import { ActiveTagOverlay } from "@/components/video-player/ActiveTagOverlay";
import { captureVideoFrame } from "@/lib/media/capture-video-frame";
import type { WebDrawingShape } from "@/components/drawings/DesktopDrawingDialog";
import { ActiveDrawingOverlay } from "@/components/video-player/ActiveDrawingOverlay";
import { uploadBlobToR2 } from "@/lib/r2/browser-upload";
import {
  getRememberedLocalVideo,
  isLocalVideoUrl,
  localVideoFingerprint,
  rememberLocalVideo
} from "@/lib/local-video-store";

// Pulls in the canvas drawing tool only once the drawing dialog actually opens,
// instead of shipping it in this page's initial bundle.
const FrameDrawingDialog = dynamic(() => import("@/components/drawings/DesktopDrawingDialog").then((mod) => mod.FrameDrawingDialog), { ssr: false });
// Splits the clip-building UI into its own chunk so the video player, tags, and
// timeline can render and become interactive without waiting on it first.
const ClipBuilder = dynamic(() => import("@/components/clips/ClipBuilder").then((mod) => mod.ClipBuilder), { ssr: false });

export default function VideoViewerPage() {
  const { t } = useI18n();
  const { videoId } = useParams<{ videoId: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reconnectInputRef = useRef<HTMLInputElement | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [standardTags, setStandardTags] = useState<StandardTag[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [activePhaseTag, setActivePhaseTag] = useState<{ startTime: number } | null>(null);
  const [pendingPhaseTags, setPendingPhaseTags] = useState<{ id: string; startTime: number; endTime: number }[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [drawingFrame, setDrawingFrame] = useState<{ image: string; time: number; tagId: string | null; drawingId: string | null; key?: string; initialShapes?: WebDrawingShape[]; durationSeconds?: number } | null>(null);
  const [playingDrawing, setPlayingDrawing] = useState<TagDrawing | null>(null);
  const lastPlaybackTimeRef = useRef(0);
  const handledDrawingIdsRef = useRef(new Set<string>());
  const drawingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  useEffect(() => () => { if (drawingTimerRef.current) clearTimeout(drawingTimerRef.current); }, []);

  function handleViewerTimeUpdate(time: number) {
    setCurrentTime(time);
    const previousTime = lastPlaybackTimeRef.current;
    if (time < previousTime - 0.25) handledDrawingIdsRef.current.clear();
    lastPlaybackTimeRef.current = time;
    if (playingDrawing) return;
    const candidate = tags.flatMap((tag) => tag.drawings ?? []).sort((a, b) => a.video_time - b.video_time)
      .find((drawing) => !handledDrawingIdsRef.current.has(drawing.id) && previousTime <= drawing.video_time && time >= drawing.video_time);
    const player = videoRef.current;
    if (!candidate || !player) return;
    const resumeAfterFreeze = !player.paused;
    handledDrawingIdsRef.current.add(candidate.id);
    player.pause();
    player.currentTime = candidate.video_time;
    lastPlaybackTimeRef.current = candidate.video_time;
    setCurrentTime(candidate.video_time);
    setPlayingDrawing(candidate);
    drawingTimerRef.current = setTimeout(() => {
      setPlayingDrawing(null);
      drawingTimerRef.current = null;
      if (resumeAfterFreeze) void player.play();
    }, candidate.duration_seconds * 1000);
  }

  function drawOnCurrentFrame(requestedTag?: Tag) {
    const player = videoRef.current;
    if (!player) return;
    const activeTag = requestedTag ?? tags.find((tag) => !isPeriodMarker(tag.name) && currentTime >= tag.start_time && currentTime <= tag.end_time);
    if (!activeTag) { setLocalError("Draw is available while the timeline is inside a tag."); return; }
    player.pause();
    try {
      setDrawingFrame({ image: captureVideoFrame(player, t("drawing.frameNotReady")), time: player.currentTime, tagId: activeTag.id, drawingId: null });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Could not capture this video frame.");
    }
  }

  function drawDownloadOnly() {
    const player = videoRef.current;
    if (!player) return;
    player.pause();
    try {
      setDrawingFrame({ image: captureVideoFrame(player, t("drawing.frameNotReady")), time: player.currentTime, tagId: null, drawingId: null });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Could not capture this video frame.");
    }
  }

  async function saveDrawing(blob: Blob, durationSeconds: number, shapes: WebDrawingShape[]) {
    if (!drawingFrame?.tagId) return;
    const tag = tags.find((item) => item.id === drawingFrame.tagId);
    if (!tag) throw new Error(t("tag.noLongerExists"));
    const id = drawingFrame.drawingId ?? crypto.randomUUID();
    const key = drawingFrame.key ?? `drawings/${video?.coach_id}/${tag.id}/${id}.png`;
    const url = await uploadBlobToR2(blob, key, "image/png", () => undefined);
    let baseFrameUrl = drawingFrame.image;
    if (!drawingFrame.drawingId) {
      const baseBlob = await fetch(drawingFrame.image).then((response) => response.blob());
      baseFrameUrl = await uploadBlobToR2(baseBlob, `drawings/${video?.coach_id}/${tag.id}/${id}-base.png`, "image/png", () => undefined);
    }
    const savedDrawing = { id, key, url, video_time: drawingFrame.time, duration_seconds: durationSeconds, base_frame_url: baseFrameUrl, shapes, created_at: new Date().toISOString() };
    const drawings = drawingFrame.drawingId ? (tag.drawings ?? []).map((drawing) => drawing.id === id ? savedDrawing : drawing) : [...(tag.drawings ?? []), savedDrawing];
    const { error } = await supabase.from("tags").update({ drawings }).eq("id", tag.id);
    if (error) throw error;
    setTags((items) => items.map((item) => item.id === tag.id ? { ...item, drawings } : item));
    setDrawingFrame(null);
  }

  function openSavedDrawing(tag: Tag, drawing: TagDrawing) {
    setDrawingFrame({ image: drawing.base_frame_url ?? drawing.url, time: drawing.video_time, tagId: tag.id, drawingId: drawing.id, key: drawing.key, initialShapes: (drawing.shapes ?? []) as WebDrawingShape[], durationSeconds: drawing.duration_seconds });
  }

  async function changeDrawingDuration(tag: Tag, drawingId: string, durationSeconds: number) {
    const drawings = (tag.drawings ?? []).map((drawing) => drawing.id === drawingId ? { ...drawing, duration_seconds: durationSeconds } : drawing);
    setTags((items) => items.map((item) => item.id === tag.id ? { ...item, drawings } : item));
    const { error } = await supabase.from("tags").update({ drawings }).eq("id", tag.id);
    if (error) setLocalError(error.message);
  }

  useEffect(() => {
    // Guards against a slow response for a previously viewed video overwriting
    // the state of the video the user has since navigated to.
    let cancelled = false;

    async function loadVideo() {
      const { data } = await supabase.from("videos").select("*").eq("id", videoId).single();
      if (!cancelled) setVideo(data);
    }

    async function loadTags() {
      const { data } = await supabase
        .from("tags")
        .select("*")
        .eq("video_id", videoId)
        .order("start_time", { ascending: true });
      if (!cancelled) setTags(data ?? []);
    }

    async function loadStandardTags() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase.from("standard_tags").select("*").eq("coach_id", user.id).order("created_at");
      if (!cancelled) setStandardTags(data ?? []);
    }

    void loadVideo();
    void loadTags();
    void loadStandardTags();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    if (!video?.team_id) { setPlayers([]); return; }
    let cancelled = false;
    const teamId = video.team_id;

    async function loadPlayers() {
      const { data } = await supabase.from("players").select("*").eq("team_id", teamId).neq("role", "staff").order("last_name");
      if (!cancelled) setPlayers(data ?? []);
    }

    void loadPlayers();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function addTag(label: string, profile?: StandardTag) {
    if (!label.trim() || !video) return;

    const startTime = currentTime;
    const marker = isPeriodMarker(label);
    const { data, error } = await supabase
      .from("tags")
      .insert({
        video_id: video.id,
        name: label.trim(),
        occurred_at_seconds: startTime,
        start_time: marker ? startTime : Math.max(0, startTime + (profile?.video_start_offset_seconds ?? 0)),
        end_time: marker ? startTime : Math.min(duration || Number.POSITIVE_INFINITY, Math.max(0, startTime + (profile?.video_end_offset_seconds ?? 5))),
        color: getTagColor(label),
        player_ids: video.active_player_ids
      })
      .select()
      .single();

    if (!error && data) {
      setTags((current) => [...current, data].sort((a, b) => a.start_time - b.start_time));
    }
  }

  function togglePhaseTag() {
    if (activePhaseTag) {
      setPendingPhaseTags((current) => [...current, { id: crypto.randomUUID(), startTime: activePhaseTag.startTime, endTime: currentTime }]);
      setActivePhaseTag(null);
      videoRef.current?.pause();
    } else {
      setActivePhaseTag({ startTime: currentTime });
    }
  }

  function cancelPhaseTag(id: string) {
    setPendingPhaseTags((current) => current.filter((item) => item.id !== id));
  }

  async function savePhaseTag(id: string, name: string) {
    const phase = pendingPhaseTags.find((item) => item.id === id);
    if (!phase || !video) { cancelPhaseTag(id); return; }
    const startTime = Math.min(phase.startTime, phase.endTime);
    const endTime = Math.max(phase.startTime, phase.endTime);
    const { data, error } = await supabase
      .from("tags")
      .insert({
        video_id: video.id,
        name,
        occurred_at_seconds: startTime,
        start_time: startTime,
        end_time: endTime,
        color: getTagColor(name),
        player_ids: video.active_player_ids
      })
      .select()
      .single();
    if (!error && data) setTags((current) => [...current, data].sort((a, b) => a.start_time - b.start_time));
    cancelPhaseTag(id);
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
    if (drawingTimerRef.current) clearTimeout(drawingTimerRef.current);
    drawingTimerRef.current = null;
    setPlayingDrawing(null);
    handledDrawingIdsRef.current.clear();
    lastPlaybackTimeRef.current = time;
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
        <p className="min-w-0 truncate text-sm font-semibold text-textBright">{video?.title || t("video.untitled")}</p>
        <PlaybackControls isPlaying={isPlaying} playbackRate={playbackRate} onBack={() => seekTo(Math.max(0, currentTime - 5))} onTogglePlay={togglePlayback} onCycleSpeed={cyclePlaybackRate} />
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-textBright">{t("video.phaseTags")}</h3>
          <button
            type="button"
            onClick={togglePhaseTag}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${activePhaseTag ? "border-red-500 bg-red-500/10 text-red-400 hover:bg-red-500/20" : "border-dashed border-accent bg-accentDim text-accent hover:bg-cardHover"}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${activePhaseTag ? "animate-pulse bg-red-500" : "bg-accent"}`} />
            {activePhaseTag ? `${t("phaseTag.stop")} · ${formatTime(Math.max(0, currentTime - activePhaseTag.startTime))}` : t("phaseTag.start")}
          </button>
        </div>
        <div className="space-y-2"><h3 className="text-sm font-semibold text-textBright">{t("video.periodMarkers")}</h3>{(["Start", "End"] as const).map((name) => <button key={name} type="button" onClick={() => void addTag(name)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-borderButton bg-button py-2 text-textPrimary hover:bg-cardHover"><span className={`relative inline-block h-4 w-4 border-l-2 ${name === "End" ? "border-white" : "border-accent"}`}><span className={`absolute left-0 top-0 h-2.5 w-3 rounded-r-sm ${name === "End" ? "border border-white" : "bg-accent"}`} style={name === "End" ? { backgroundImage: "conic-gradient(#fff 25%, #111 0 50%, #fff 0 75%, #111 0)", backgroundSize: "5px 5px" } : undefined} /></span>{name}</button>)}</div>
        {tags.some((tag) => isPeriodMarker(tag.name)) && (
          <details className="rounded-lg border border-border bg-cardDeep px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-textBright">{t("video.periodTimes")}</summary>
            <div className="mt-2">
            <TagList tags={tags.filter((tag) => isPeriodMarker(tag.name))} selectedTagIds={[]} onToggleSelect={() => undefined} onSeek={seekTo} onDelete={deleteTag} onUpdate={updateTag} />
            </div>
          </details>
        )}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-textBright">{t("video.addClipTag")}</h3>
          <div className="grid grid-cols-1 gap-2">
            {standardTags.filter((tag) => !isPeriodMarker(tag.name)).map((tag) => <button key={tag.id} onClick={() => void addTag(tag.name, tag)} className="rounded-lg border border-borderButton bg-button px-2 py-2 text-sm text-textPrimary hover:bg-cardHover">{tag.name}</button>)}
          </div>
          <div className="mt-2"><QuickTagCreator onCreated={async (name) => { await addTag(name); }} /></div>
        </div>
        <button type="button" onClick={drawDownloadOnly} className="mt-auto w-full rounded-lg bg-accent px-4 py-2 font-semibold text-page">{t("video.draw")}</button>
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
              <h2 className="text-textBright text-lg font-semibold">{t("video.reconnectTitle")}</h2>
              <p className="text-textMuted text-sm mt-2 max-w-md">{t("video.reconnectHelp")}</p>
              <button onClick={() => void reconnectLocalVideo()} className="mt-4 px-4 py-2 rounded-lg bg-accent text-page font-semibold">{t("video.selectOriginal")}</button>
              {localError && <p className="mt-3 text-sm text-red-300">{localError}</p>}
            </div>
          </div>
        ) : (
          <div className="relative flex min-h-0 flex-1">
            <VideoPlayer
              ref={videoRef}
              src={localVideoUrl ?? video?.video_url}
              onTimeUpdate={handleViewerTimeUpdate}
              onDurationChange={(value) => { setDuration(value); if (videoRef.current) videoRef.current.playbackRate = playbackRate; }}
              onPlayingChange={setIsPlaying}
            />
            <ActiveTagOverlay tags={tags} currentTime={currentTime} />
            <ActiveDrawingOverlay drawing={playingDrawing} />
          </div>
        )}
        <Timeline duration={duration} currentTime={currentTime} tags={tags} onSeek={seekTo} />
      </div>

      <div className="w-96 bg-card p-4 border-l border-border overflow-y-auto space-y-4">
        <section>
          <h3 className="mb-2 font-semibold text-textBright">{t("video.taggedClips")}</h3>
          <TagList tags={tags.filter((tag) => !isPeriodMarker(tag.name))} selectedTagIds={selectedTagIds} onToggleSelect={toggleTagSelected} onSeek={seekTo} onDelete={deleteTag} onUpdate={updateTag} onRename={renameTag} onDraw={drawOnCurrentFrame} currentTime={currentTime} onDrawingDurationChange={changeDrawingDuration} onOpenDrawing={openSavedDrawing} />
        </section>
        <ClipBuilder
          videoId={videoId}
          teamId={video?.team_id ?? null}
          selectedTagIds={selectedTagIds}
          tags={tags}
          players={players}
          localVideo={isLocalVideoUrl(video?.video_url)}
          localFile={localFile}
          matchLabel={video?.home_team && video?.away_team ? `${video.home_team} - ${video.away_team}` : video?.title || t("video.match")}
          onClipCreated={() => setSelectedTagIds([])}
        />
      </div>
      {drawingFrame && <FrameDrawingDialog frame={drawingFrame.image} time={drawingFrame.time} initialShapes={drawingFrame.initialShapes} initialDurationSeconds={drawingFrame.durationSeconds} onClose={() => setDrawingFrame(null)} onSave={drawingFrame.tagId ? saveDrawing : undefined} />}
      {pendingPhaseTags[0] && <PhaseTagDialog onCancel={() => cancelPhaseTag(pendingPhaseTags[0].id)} onConfirm={(name) => savePhaseTag(pendingPhaseTags[0].id, name)} />}
      </div>
    </div>
  );
}
