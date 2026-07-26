"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getRememberedLocalVideo, isLocalVideoUrl, localVideoFingerprint, rememberLocalVideo } from "@/lib/local-video-store";
import { formatTime, getTagColor } from "@/lib/utils";
import { isPeriodMarker } from "@/lib/tags";
import type { LiveMatchTag, Match, Player, StandardTag, Tag, TagDrawing, Video } from "@/types/database";
import { VideoPlayer } from "@/components/video-player/VideoPlayer";
import { PlaybackControls } from "@/components/video-player/PlaybackControls";
import { Timeline } from "@/components/video-player/Timeline";
import { TagList } from "@/components/tags/TagList";
import { QuickTagCreator } from "@/components/tags/QuickTagCreator";
import { ClipBuilder } from "@/components/clips/ClipBuilder";
import { MatchDetailsCard } from "@/components/matches/MatchDetailsCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { inspectLocalVideo } from "@/lib/media/local-clips";
import { ActiveTagOverlay } from "@/components/video-player/ActiveTagOverlay";
import { captureVideoFrame, FrameDrawingDialog, type WebDrawingShape } from "@/components/drawings/DesktopDrawingDialog";
import { ActiveDrawingOverlay } from "@/components/video-player/ActiveDrawingOverlay";
import { uploadBlobToR2 } from "@/lib/r2/browser-upload";
import { useI18n } from "@/i18n/client";
import { localMediaMessages } from "@/i18n/local-media";
import { getTagEventKind } from "@/lib/tag-events";
import { GoalTagDialog, type GoalTagDetails } from "@/components/tags/GoalTagDialog";
import { EXTERNAL_RECORDING_CAMERAS, externalRecordingUrl } from "@/lib/external-recording";

type MatchBlock = { id: string; sequence_order: number; label: string; is_primary: boolean; videos: Video | null };
type MatchWithBlocks = Match & { match_videos: MatchBlock[] };

const MAX_CLIP_SECONDS = 180;

function drawingsSeconds(drawings: TagDrawing[] | undefined) {
  return (drawings ?? []).reduce((sum, drawing) => sum + Math.max(1, drawing.duration_seconds), 0);
}

function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseClockTime(value: string): number | null {
  const parts = value.trim().split(":").map(Number);
  if (!value.trim() || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2 && parts[1] < 60) return parts[0] * 60 + parts[1];
  if (parts.length === 3 && parts[1] < 60 && parts[2] < 60) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function LiveTagRow({ liveTag, materializedTag, elapsed, reviewed, onToggleReviewed, onSeek, onCalibrate, onUpdateTimes, t }: {
  liveTag: LiveMatchTag;
  materializedTag: Tag | undefined;
  elapsed: number | null;
  reviewed: boolean;
  onToggleReviewed: () => void;
  onSeek: (time: number) => void;
  onCalibrate: () => void;
  onUpdateTimes: (startTime: number, endTime: number) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const [startDraft, setStartDraft] = useState(materializedTag ? formatTime(materializedTag.start_time) : "");
  const [endDraft, setEndDraft] = useState(materializedTag ? formatTime(materializedTag.end_time) : "");

  useEffect(() => { if (materializedTag) setStartDraft(formatTime(materializedTag.start_time)); }, [materializedTag?.start_time]);
  useEffect(() => { if (materializedTag) setEndDraft(formatTime(materializedTag.end_time)); }, [materializedTag?.end_time]);

  function saveTimes() {
    if (!materializedTag) return;
    const parsedStart = parseClockTime(startDraft);
    const parsedEnd = parseClockTime(endDraft);
    if (parsedStart === null || parsedEnd === null) {
      setStartDraft(formatTime(materializedTag.start_time));
      setEndDraft(formatTime(materializedTag.end_time));
      return;
    }
    const safeEnd = Math.max(parsedStart, parsedEnd);
    setStartDraft(formatTime(parsedStart));
    setEndDraft(formatTime(safeEnd));
    onUpdateTimes(parsedStart, safeEnd);
  }

  const timeInput = "w-[58px] rounded border border-border bg-input px-1.5 py-1 text-center text-[11px] text-textPrimary focus:border-accent focus:outline-none";

  return (
    <div className={`rounded-lg border border-border bg-cardDeep px-3 py-2 ${reviewed ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={reviewed} onChange={onToggleReviewed} title={t("liveTags.reviewed")} className="h-4 w-4 flex-shrink-0 accent-accent" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-textPrimary">{liveTag.tag_name}</p>
          <p className="truncate text-xs text-textMuted">{liveTag.tagger_name ? t("liveTags.by", { name: liveTag.tagger_name }) : t("liveTags.byUnknown")}</p>
        </div>
        <button type="button" onClick={onCalibrate} title={t("liveTags.calibrate")} aria-label={t("liveTags.calibrate")} className="flex-shrink-0 rounded-lg border border-borderButton bg-button px-2 py-1.5 text-xs font-semibold text-textPrimary hover:bg-cardHover">🎯</button>
        {elapsed !== null && <button type="button" onClick={() => onSeek(elapsed)} className="flex-shrink-0 rounded-lg border border-borderButton bg-button px-2 py-1.5 text-xs font-semibold text-textPrimary hover:bg-cardHover">{t("liveTags.goTo")}</button>}
      </div>
      {materializedTag ? (
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-textMuted">
          <label className="flex items-center gap-1">
            <span>{t("tag.start")}</span>
            <input value={startDraft} onChange={(event) => setStartDraft(event.target.value)} onBlur={saveTimes} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className={timeInput} inputMode="numeric" />
          </label>
          <label className="flex items-center gap-1">
            <span>{t("tag.end")}</span>
            <input value={endDraft} onChange={(event) => setEndDraft(event.target.value)} onBlur={saveTimes} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className={timeInput} inputMode="numeric" />
          </label>
        </div>
      ) : elapsed !== null && (
        <p className="mt-1 text-right text-[10px] text-textMuted">{formatClock(elapsed)}</p>
      )}
    </div>
  );
}

function messageFrom(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

export default function MatchViewerPage() {
  const { t } = useI18n();
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reconnectInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const reconnectVideoRef = useRef<Video | null>(null);
  const reconnectAllRef = useRef(false);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const autoPlayRef = useRef(false);
  const [match, setMatch] = useState<MatchWithBlocks | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [liveTags, setLiveTags] = useState<LiveMatchTag[]>([]);
  const [standardTags, setStandardTags] = useState<StandardTag[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [extraPlayers, setExtraPlayers] = useState<Player[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [combinedTime, setCombinedTime] = useState(0);
  const [error, setError] = useState("");
  const [supportsPersistentFileAccess, setSupportsPersistentFileAccess] = useState<boolean | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [drawingFrame, setDrawingFrame] = useState<{ image: string; time: number; tagId: string | null; drawingId: string | null; key?: string; initialShapes?: WebDrawingShape[]; durationSeconds?: number } | null>(null);
  const [playingDrawing, setPlayingDrawing] = useState<TagDrawing | null>(null);
  const [pendingGoal, setPendingGoal] = useState<{ video: Video; label: string; localTime: number } | null>(null);
  const [attachSource, setAttachSource] = useState<"file" | "external">("external");
  const [attachRecordingId, setAttachRecordingId] = useState("");
  const [attachCameras, setAttachCameras] = useState<number[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [calibratingLiveTagId, setCalibratingLiveTagId] = useState<string | null>(null);
  const lastPlaybackTimeRef = useRef(0);
  const handledDrawingIdsRef = useRef(new Set<string>());
  const drawingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const materializingLiveTagIdsRef = useRef(new Set<string>());

  useEffect(() => () => { if (drawingTimerRef.current) clearTimeout(drawingTimerRef.current); }, []);

  function handleViewerTimeUpdate(localTime: number) {
    const offset = offsets.map.get(currentVideo?.id ?? "") ?? 0;
    const time = offset + localTime;
    setCombinedTime(time);
    const previousTime = lastPlaybackTimeRef.current;
    if (time < previousTime - 0.25) handledDrawingIdsRef.current.clear();
    lastPlaybackTimeRef.current = time;
    if (playingDrawing) return;
    const candidate = tags.flatMap((tag) => (tag.drawings ?? []).map((drawing) => ({ drawing, at: drawing.video_time + (offsets.map.get(tag.video_id) ?? 0) })))
      .sort((a, b) => a.at - b.at)
      .find(({ drawing, at }) => !handledDrawingIdsRef.current.has(drawing.id) && previousTime <= at && time >= at);
    const player = videoRef.current;
    if (!candidate || !player) return;
    const resumeAfterFreeze = !player.paused;
    handledDrawingIdsRef.current.add(candidate.drawing.id);
    player.pause();
    player.currentTime = candidate.drawing.video_time;
    lastPlaybackTimeRef.current = candidate.at;
    setCombinedTime(candidate.at);
    setPlayingDrawing(candidate.drawing);
    drawingTimerRef.current = setTimeout(() => {
      setPlayingDrawing(null);
      drawingTimerRef.current = null;
      if (resumeAfterFreeze) void player.play();
    }, candidate.drawing.duration_seconds * 1000);
  }

  function drawOnCurrentFrame(requestedTag?: Tag) {
    const player = videoRef.current;
    if (!player) return;
    const activeTag = requestedTag ?? displayTags.find((tag) => !isPeriodMarker(tag.name) && combinedTime >= tag.start_time && combinedTime <= tag.end_time);
    if (!activeTag) { setError(t("match.drawInsideTag")); return; }
    player.pause();
    try {
      setDrawingFrame({ image: captureVideoFrame(player, t("drawing.frameNotReady")), time: player.currentTime, tagId: activeTag.id, drawingId: null });
    } catch (captureError) {
      setError(messageFrom(captureError, "Could not capture this video frame."));
    }
  }

  function drawDownloadOnly() {
    const player = videoRef.current;
    if (!player) return;
    player.pause();
    try {
      setDrawingFrame({ image: captureVideoFrame(player, t("drawing.frameNotReady")), time: combinedTime, tagId: null, drawingId: null });
    } catch (captureError) {
      setError(messageFrom(captureError, "Could not capture this video frame."));
    }
  }

  async function saveDrawing(blob: Blob, durationSeconds: number, shapes: WebDrawingShape[]) {
    if (!drawingFrame?.tagId) return;
    const tag = tags.find((item) => item.id === drawingFrame.tagId);
    if (!tag) throw new Error(t("tag.noLongerExists"));
    const id = drawingFrame.drawingId ?? crypto.randomUUID();
    const key = drawingFrame.key ?? `drawings/${match?.coach_id}/${tag.id}/${id}.png`;
    const url = await uploadBlobToR2(blob, key, "image/png", () => undefined);
    let baseFrameUrl = drawingFrame.image;
    if (!drawingFrame.drawingId) {
      const baseBlob = await fetch(drawingFrame.image).then((response) => response.blob());
      baseFrameUrl = await uploadBlobToR2(baseBlob, `drawings/${match?.coach_id}/${tag.id}/${id}-base.png`, "image/png", () => undefined);
    }
    const savedDrawing = { id, key, url, video_time: drawingFrame.time, duration_seconds: durationSeconds, base_frame_url: baseFrameUrl, shapes, created_at: new Date().toISOString() };
    const drawings = drawingFrame.drawingId ? (tag.drawings ?? []).map((drawing) => drawing.id === id ? savedDrawing : drawing) : [...(tag.drawings ?? []), savedDrawing];
    if (tag.end_time - tag.start_time + drawingsSeconds(drawings) > MAX_CLIP_SECONDS) throw new Error(t("tag.tooLong"));
    const { error: saveError } = await supabase.from("tags").update({ drawings }).eq("id", tag.id);
    if (saveError) throw saveError.message.includes("CLIP_TOO_LONG") ? new Error(t("tag.tooLong")) : saveError;
    setTags((items) => items.map((item) => item.id === tag.id ? { ...item, drawings } : item));
    setDrawingFrame(null);
  }

  function openSavedDrawing(displayTag: Tag, drawing: TagDrawing) {
    const tag = tags.find((item) => item.id === displayTag.id);
    if (!tag) return;
    setDrawingFrame({ image: drawing.base_frame_url ?? drawing.url, time: drawing.video_time, tagId: tag.id, drawingId: drawing.id, key: drawing.key, initialShapes: (drawing.shapes ?? []) as WebDrawingShape[], durationSeconds: drawing.duration_seconds });
  }

  async function changeDrawingDuration(displayTag: Tag, drawingId: string, durationSeconds: number) {
    const tag = tags.find((item) => item.id === displayTag.id);
    if (!tag) return;
    const drawings = (tag.drawings ?? []).map((drawing) => drawing.id === drawingId ? { ...drawing, duration_seconds: durationSeconds } : drawing);
    if (tag.end_time - tag.start_time + drawingsSeconds(drawings) > MAX_CLIP_SECONDS) { setError(t("tag.tooLong")); return; }
    const { error: updateError } = await supabase.from("tags").update({ drawings }).eq("id", tag.id);
    if (updateError) { setError(updateError.message.includes("CLIP_TOO_LONG") ? t("tag.tooLong") : updateError.message); return; }
    setTags((items) => items.map((item) => item.id === tag.id ? { ...item, drawings } : item));
  }
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [canEditMatch, setCanEditMatch] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [confirmDeleteMatch, setConfirmDeleteMatch] = useState(false);
  const [deletingMatch, setDeletingMatch] = useState(false);

  const blocks = useMemo(() => [...(match?.match_videos ?? [])].sort((a, b) => a.sequence_order - b.sequence_order), [match]);
  const primaryBlocks = useMemo(() => blocks.filter((block) => block.is_primary), [blocks]);
  const videos = useMemo(() => primaryBlocks.map((block) => block.videos).filter((video): video is Video => !!video), [primaryBlocks]);
  const videoById = useMemo(() => {
    const map = new Map<string, Video>();
    for (const block of blocks) if (block.videos) map.set(block.videos.id, block.videos);
    return map;
  }, [blocks]);
  const camerasByBlockOrder = useMemo(() => {
    const map = new Map<number, MatchBlock[]>();
    for (const block of blocks) {
      if (!block.videos) continue;
      const list = map.get(block.sequence_order) ?? [];
      list.push(block);
      map.set(block.sequence_order, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.videos?.camera_number ?? 0) - (b.videos?.camera_number ?? 0));
    return map;
  }, [blocks]);
  const offsets = useMemo(() => {
    const map = new Map<string, number>();
    let offset = 0;
    for (const block of primaryBlocks) {
      if (!block.videos) continue;
      const cameras = camerasByBlockOrder.get(block.sequence_order) ?? [block];
      for (const cameraBlock of cameras) if (cameraBlock.videos) map.set(cameraBlock.videos.id, offset);
      offset += block.videos.duration ?? 0;
    }
    return { map, total: offset };
  }, [primaryBlocks, camerasByBlockOrder]);
  const siblingCamerasByVideoId = useMemo(() => {
    const map: Record<string, { id: string; camera_number: number | null; label: string }[]> = {};
    for (const cameras of camerasByBlockOrder.values()) {
      if (cameras.length < 2) continue;
      const entries = cameras.filter((block): block is MatchBlock & { videos: Video } => !!block.videos)
        .map((block) => ({ id: block.videos.id, camera_number: block.videos.camera_number, label: block.label }));
      for (const block of cameras) if (block.videos) map[block.videos.id] = entries;
    }
    return map;
  }, [camerasByBlockOrder]);
  const [preferredCameraNumber, setPreferredCameraNumber] = useState<number | null>(null);
  const currentBlockCameras = camerasByBlockOrder.get(primaryBlocks[currentIndex]?.sequence_order ?? -1) ?? [];
  const activeCameraBlock = currentBlockCameras.find((block) => block.videos?.camera_number === preferredCameraNumber) ?? primaryBlocks[currentIndex] ?? null;
  const currentVideo = activeCameraBlock?.videos ?? videos[currentIndex] ?? null;
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
    void fetch("/api/admin/status").then((response) => response.json()).then((body) => setIsPlatformAdmin(body.isAdmin === true)).catch(() => undefined);
    setSupportsPersistentFileAccess(typeof (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker === "function");
    void supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ""));
  }, [matchId]);

  useEffect(() => {
    if (!match?.team_a_id) { setPlayers([]); return; }
    void supabase.from("players").select("*").eq("team_id", match.team_a_id).neq("role", "staff").order("last_name").then(({ data }) => {
      const teamPlayers = data ?? [];
      setPlayers(match.player_ids?.length ? teamPlayers.filter((player) => match.player_ids.includes(player.id)) : teamPlayers);
    });
  }, [match?.team_a_id, match?.player_ids]);

  useEffect(() => {
    if (!currentFile) { setPlaybackUrl(null); return; }
    const url = URL.createObjectURL(currentFile);
    setPlaybackUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [currentFile]);

  async function loadMatch() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: loadError } = await supabase.from("matches")
      .select("*, match_videos(id, sequence_order, label, is_primary, videos(*))")
      .eq("id", matchId).single();
    if (loadError || !data) { setError(loadError?.message || t("match.notFound")); return; }
    const loaded = data as unknown as MatchWithBlocks;
    if (!user) { router.replace("/dashboard/clips"); return; }
    const { data: profile } = await supabase.from("profiles").select("account_role").eq("id", user.id).maybeSingle();
    setCanEditMatch(loaded.coach_id === user.id || profile?.account_role === "club_admin");
    setMatch(loaded);
    const { data: liveTagData } = await supabase.from("live_match_tags").select("*").eq("match_id", matchId).order("occurred_at");
    setLiveTags(liveTagData ?? []);
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
      if (video.video_key !== `local/${fingerprint}`) throw new Error(t("match.wrongOriginal"));
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
        const [info, fingerprint] = await Promise.all([inspectLocalVideo(selection.file, localMediaMessages(t)), localVideoFingerprint(selection.file)]);
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

  function toggleAttachCamera(cameraNumber: number) {
    setAttachCameras((current) => current.includes(cameraNumber) ? current.filter((n) => n !== cameraNumber) : [...current, cameraNumber]);
  }

  async function attachExternalRecording() {
    const trimmedRecordingId = attachRecordingId.trim();
    if (!trimmedRecordingId || !attachCameras.length || !currentUserId) return;
    setAttaching(true);
    setError("");
    try {
      const cameras = [...attachCameras].sort((a, b) => a - b);
      for (let index = 0; index < cameras.length; index += 1) {
        const cameraNumber = cameras[index];
        const { data: video, error: videoError } = await supabase.from("videos").insert({
          coach_id: currentUserId,
          team_id: match?.team_a_id ?? null,
          video_url: externalRecordingUrl(trimmedRecordingId, cameraNumber),
          video_key: `external/${trimmedRecordingId}/ch${cameraNumber}`,
          camera_number: cameraNumber,
          processing_status: "ready",
          title: t("match.cameraLabel", { number: cameraNumber })
        }).select("id").single();
        if (videoError) throw videoError;
        const { error: linkError } = await supabase.from("match_videos").insert({
          match_id: matchId,
          video_id: video.id,
          sequence_order: 0,
          is_primary: index === 0,
          label: t("match.cameraLabel", { number: cameraNumber })
        });
        if (linkError) throw linkError;
      }
      setAttachRecordingId("");
      setAttachCameras([]);
      await loadMatch();
    } catch (attachError) {
      setError(messageFrom(attachError, t("match.createFailed")));
    } finally {
      setAttaching(false);
    }
  }

  async function attachLocalFiles(selections: { file: File; handle: FileSystemFileHandle | null }[]) {
    if (!selections.length || !currentUserId) return;
    setAttaching(true);
    setError("");
    try {
      for (let index = 0; index < selections.length; index += 1) {
        const selection = selections[index];
        const [info, fingerprint] = await Promise.all([inspectLocalVideo(selection.file, localMediaMessages(t)), localVideoFingerprint(selection.file)]);
        const { data: video, error: videoError } = await supabase.from("videos").insert({
          coach_id: currentUserId,
          team_id: match?.team_a_id ?? null,
          video_url: `local://${fingerprint}`,
          video_key: `local/${fingerprint}`,
          file_size: selection.file.size,
          duration: Math.round(info.duration),
          processing_status: "ready",
          title: selection.file.name.replace(/\.[^/.]+$/, "")
        }).select("id").single();
        if (videoError) throw videoError;
        await rememberLocalVideo(video.id, selection.file, selection.handle);
        const { error: linkError } = await supabase.from("match_videos").insert({
          match_id: matchId,
          video_id: video.id,
          sequence_order: index,
          label: `Video ${index + 1}`
        });
        if (linkError) throw linkError;
      }
      await loadMatch();
    } catch (attachError) {
      setError(messageFrom(attachError, t("match.createFailed")));
    } finally {
      setAttaching(false);
    }
  }

  async function chooseLocalFilesToAttach() {
    const picker = (window as unknown as { showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker;
    if (!picker) { attachInputRef.current?.click(); return; }
    try {
      const handles = await picker({ multiple: true, types: [{ description: "Match videos", accept: { "video/mp4": [".mp4", ".m4v"], "video/quicktime": [".mov"] } }] });
      await attachLocalFiles(await Promise.all(handles.map(async (handle) => ({ file: await handle.getFile(), handle }))));
    } catch (pickerError) {
      if (!(pickerError instanceof DOMException && pickerError.name === "AbortError")) setError(messageFrom(pickerError, "The local videos could not be opened."));
    }
  }

  async function deleteMatch() {
    setDeletingMatch(true);
    const response = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) { setError(body?.error || t("match.deleteFailed")); setDeletingMatch(false); setConfirmDeleteMatch(false); return; }
    router.push("/dashboard");
  }

  async function persistProfiledTag(video: Video, label: string, localTime: number, goal?: GoalTagDetails) {
    const selectedPlayers = match?.player_ids?.length ? match.player_ids : players.map((player) => player.id);
    const { data, error: tagError } = await supabase.rpc("create_profiled_tag", {
      target_video_id: video.id,
      target_match_id: matchId,
      tag_name: label.trim(),
      tag_moment: localTime,
      tag_color: getTagColor(label),
      selected_player_ids: selectedPlayers,
      tag_event_type: goal?.eventType ?? null,
      scorer_id: goal?.scorerId ?? null,
      assist_id: goal?.assistId ?? null
    });
    if (tagError) {
      setError(tagError.message.includes("FREE_CLIP_LIMIT_REACHED") ? t("clip.freeLimit") : tagError.message.includes("CLIP_TOO_LONG") ? t("tag.tooLong") : tagError.message);
      return;
    }
    const created = (Array.isArray(data) ? data[0] : data) as Tag | null;
    if (created) setTags((current) => [...current, created].sort((a, b) => (offsets.map.get(a.video_id) ?? 0) + a.start_time - ((offsets.map.get(b.video_id) ?? 0) + b.start_time)));
  }

  async function addTag(label: string) {
    if (!currentVideo || !label.trim()) return;
    const localTime = videoRef.current?.currentTime ?? Math.max(0, combinedTime - (offsets.map.get(currentVideo.id) ?? 0));
    const marker = isPeriodMarker(label);
    if (!marker && getTagEventKind(label) === "goal") {
      setPendingGoal({ video: currentVideo, label, localTime });
      return;
    }
    if (!marker) {
      await persistProfiledTag(currentVideo, label, localTime);
      return;
    }
    const { data, error: tagError } = await supabase.from("tags").insert({
      video_id: currentVideo.id,
      name: label.trim(),
      occurred_at_seconds: localTime,
      start_time: localTime,
      end_time: localTime,
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
    if (endTime - startTime + drawingsSeconds(tag.drawings) > MAX_CLIP_SECONDS) { setError(t("tag.tooLong")); return; }
    const { error: updateError } = await supabase.from("tags").update({ start_time: startTime, end_time: endTime }).eq("id", tagId);
    if (updateError) { setError(updateError.message.includes("CLIP_TOO_LONG") ? t("tag.tooLong") : updateError.message); return; }
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

  async function toggleLiveTagReviewed(liveTag: LiveMatchTag) {
    const reviewedAt = liveTag.reviewed_at ? null : new Date().toISOString();
    setLiveTags((current) => current.map((item) => item.id === liveTag.id ? { ...item, reviewed_at: reviewedAt } : item));
    const { error: updateError } = await supabase.from("live_match_tags").update({ reviewed_at: reviewedAt }).eq("id", liveTag.id);
    if (updateError) setLiveTags((current) => current.map((item) => item.id === liveTag.id ? { ...item, reviewed_at: liveTag.reviewed_at } : item));
  }

  function liveTagElapsedSeconds(liveTag: LiveMatchTag) {
    if (!match?.match_date || !match.recording_start_time) return null;
    const recordingStart = new Date(`${match.match_date}T${match.recording_start_time}`);
    if (Number.isNaN(recordingStart.getTime())) return null;
    // The recording's real start time is the true anchor for a live tag's timestamp - the
    // scheduled kickoff time is only an estimate and the camera is rarely started at that exact
    // instant. live_tag_offset_seconds is a small fine-tune (e.g. average phone-grab delay).
    const secondsSinceRecordingStart = (new Date(liveTag.occurred_at).getTime() - recordingStart.getTime()) / 1000;
    return Math.max(0, secondsSinceRecordingStart + (match.live_tag_offset_seconds ?? 0));
  }

  async function confirmLiveTagCalibration() {
    const liveTag = liveTags.find((item) => item.id === calibratingLiveTagId);
    setCalibratingLiveTagId(null);
    if (!liveTag || !match) return;
    const currentComputed = liveTagElapsedSeconds(liveTag);
    if (currentComputed === null) return;
    const delta = combinedTime - currentComputed;
    if (Math.abs(delta) < 0.01) return;
    const newOffset = (match.live_tag_offset_seconds ?? 0) + delta;
    setError("");
    const { error: matchError } = await supabase.from("matches").update({ live_tag_offset_seconds: newOffset }).eq("id", matchId);
    if (matchError) { setError(matchError.message); return; }
    setMatch((current) => current ? { ...current, live_tag_offset_seconds: newOffset } : current);

    const materializedTagIds = new Set(liveTags.filter((item) => item.tag_id).map((item) => item.tag_id as string));
    for (const tag of tags.filter((item) => materializedTagIds.has(item.id))) {
      const sourceVideo = videos.find((video) => video.id === tag.video_id);
      const maximum = sourceVideo?.duration ?? Number.POSITIVE_INFINITY;
      const newStart = Math.min(maximum, Math.max(0, tag.start_time + delta));
      const newEnd = Math.min(maximum, Math.max(newStart, tag.end_time + delta));
      const newOccurred = Math.min(maximum, Math.max(0, tag.occurred_at_seconds + delta));
      await supabase.from("tags").update({ start_time: newStart, end_time: newEnd, occurred_at_seconds: newOccurred }).eq("id", tag.id);
    }
    await loadMatch();
  }

  useEffect(() => {
    if (!match || match.coach_id !== currentUserId || !videos.length) return;
    const pending = liveTags.filter((liveTag) => !liveTag.tag_id && !materializingLiveTagIdsRef.current.has(liveTag.id));
    if (!pending.length) return;
    void materializeLiveTags(pending);
  }, [match, currentUserId, videos, liveTags]);

  async function materializeLiveTags(pending: LiveMatchTag[]) {
    for (const liveTag of pending) {
      materializingLiveTagIdsRef.current.add(liveTag.id);
      try {
        const elapsed = liveTagElapsedSeconds(liveTag);
        if (elapsed === null) continue;
        let targetIndex = videos.length - 1;
        for (let index = 0; index < videos.length; index += 1) {
          const start = offsets.map.get(videos[index].id) ?? 0;
          const end = start + (videos[index].duration ?? 0);
          if (elapsed < end || index === videos.length - 1) { targetIndex = index; break; }
        }
        const targetVideo = videos[targetIndex];
        const localTime = Math.max(0, elapsed - (offsets.map.get(targetVideo.id) ?? 0));
        const profile = standardTags.find((item) => item.name.trim().toLowerCase() === liveTag.tag_name.trim().toLowerCase());
        const startOffset = profile?.start_offset_seconds ?? -5;
        const endOffset = profile?.end_offset_seconds ?? 5;
        const maxDuration = targetVideo.duration ?? Number.POSITIVE_INFINITY;
        const startTime = Math.max(0, localTime + startOffset);
        const endTime = Math.min(maxDuration, Math.max(startTime, localTime + endOffset));
        const playerIds = liveTag.player_ids?.length ? liveTag.player_ids : targetVideo.active_player_ids;
        const { data: createdTag, error: tagError } = await supabase.from("tags").insert({
          video_id: targetVideo.id,
          name: liveTag.tag_name,
          occurred_at_seconds: localTime,
          start_time: startTime,
          end_time: endTime,
          color: getTagColor(liveTag.tag_name),
          player_ids: playerIds
        }).select().single();
        if (tagError || !createdTag) { setError(messageFrom(tagError, "Could not create tag from live tag.")); continue; }
        const { error: linkError } = await supabase.from("live_match_tags").update({ tag_id: createdTag.id }).eq("id", liveTag.id);
        if (linkError) { setError(messageFrom(linkError, "Could not link live tag to its new tag.")); continue; }
        setTags((current) => [...current, createdTag].sort((a, b) => (offsets.map.get(a.video_id) ?? 0) + a.start_time - ((offsets.map.get(b.video_id) ?? 0) + b.start_time)));
        setLiveTags((current) => current.map((item) => item.id === liveTag.id ? { ...item, tag_id: createdTag.id } : item));
      } finally {
        materializingLiveTagIdsRef.current.delete(liveTag.id);
      }
    }
  }

  function seekTo(time: number) {
    if (drawingTimerRef.current) clearTimeout(drawingTimerRef.current);
    drawingTimerRef.current = null;
    setPlayingDrawing(null);
    handledDrawingIdsRef.current.clear();
    lastPlaybackTimeRef.current = time;
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

  function onVideoReady(duration?: number) {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
    if (pendingSeekRef.current !== null && videoRef.current) {
      videoRef.current.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;
    }
    if (autoPlayRef.current) {
      autoPlayRef.current = false;
      void videoRef.current?.play().catch(() => undefined);
    }
    if (currentVideo && currentVideo.duration == null && Number.isFinite(duration) && (duration ?? 0) > 0) {
      const roundedDuration = Math.round(duration!);
      const videoId = currentVideo.id;
      void supabase.from("videos").update({ duration: roundedDuration }).eq("id", videoId);
      setMatch((current) => current ? {
        ...current,
        match_videos: current.match_videos.map((block) => block.videos?.id === videoId ? { ...block, videos: block.videos ? { ...block.videos, duration: roundedDuration } : block.videos } : block)
      } : current);
    }
  }

  function playNext() {
    if (currentIndex >= videos.length - 1) return;
    pendingSeekRef.current = 0;
    autoPlayRef.current = true;
    setCurrentIndex((index) => index + 1);
  }

  function switchCamera(cameraNumber: number | null) {
    const player = videoRef.current;
    pendingSeekRef.current = player?.currentTime ?? 0;
    autoPlayRef.current = !!player && !player.paused;
    setPreferredCameraNumber(cameraNumber);
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
      <input ref={attachInputRef} type="file" multiple accept=".mp4,.mov,.m4v,video/mp4,video/quicktime" className="hidden" onChange={(event) => { void attachLocalFiles(Array.from(event.target.files ?? []).map((file) => ({ file, handle: null }))); event.target.value = ""; }} />
      <div className="flex flex-1 min-h-0">
        <aside className="w-64 bg-card p-4 flex flex-col gap-4 overflow-y-auto border-r border-border">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" title={t("nav.home")} aria-label={t("nav.home")} className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg border border-borderButton bg-button hover:border-accent"><Image src="/branding/home.png" alt={t("nav.home")} width={28} height={28} /></Link>
            <span className="font-mono text-sm font-semibold text-textPrimary" aria-label={t("match.currentPosition")}>{formatClock(combinedTime)}</span>
          </div>
          {match && <MatchDetailsCard match={match} videoCount={blocks.length} onSaved={(updated) => setMatch((current) => current ? { ...current, ...updated } : current)} onReplaceVideos={match.coach_id === currentUserId && videos.every((video) => isLocalVideoUrl(video.video_url)) ? () => void chooseReplacementVideos() : undefined} onDeleteMatch={match.coach_id === currentUserId || isPlatformAdmin ? () => setConfirmDeleteMatch(true) : undefined} replacing={replacing} editable={canEditMatch} />}
          <PlaybackControls isPlaying={isPlaying} playbackRate={playbackRate} onBack={() => seekTo(Math.max(0, combinedTime - 5))} onTogglePlay={togglePlayback} onCycleSpeed={cyclePlaybackRate} />
          <div><h3 className="mb-2 text-sm font-semibold text-textBright">{t("video.periodMarkers")}</h3><div className="space-y-2">{markerTags.map((name) => <button key={name} type="button" onClick={() => void addTag(name)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-borderButton bg-button py-2 text-textPrimary hover:bg-cardHover"><span className={`relative inline-block h-4 w-4 border-l-2 ${name === "End" ? "border-white" : "border-accent"}`}><span className={`absolute left-0 top-0 h-2.5 w-3 rounded-r-sm ${name === "End" ? "border border-white" : "bg-accent"}`} style={name === "End" ? { backgroundImage: "conic-gradient(#fff 25%, #111 0 50%, #fff 0 75%, #111 0)", backgroundSize: "5px 5px" } : undefined} /></span>{name}</button>)}</div></div>
          {displayTags.some((tag) => isPeriodMarker(tag.name)) && (
            <details className="rounded-lg border border-border bg-cardDeep px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-textBright">{t("video.periodTimes")}</summary>
              <div className="mt-2">
              <TagList tags={displayTags.filter((tag) => isPeriodMarker(tag.name))} selectedTagIds={[]} onToggleSelect={() => undefined} onSeek={seekTo} onDelete={(id) => void deleteTag(id)} onUpdate={updateTag} />
              </div>
            </details>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-textBright">{t("video.addClipTag")}</h3>
            <div className="grid grid-cols-1 gap-2">
              {clipTags.map((tag) => <button key={tag.id} onClick={() => void addTag(tag.name)} className="rounded-lg border border-borderButton bg-button px-2 py-2 text-sm text-textPrimary hover:bg-cardHover">{tag.name}</button>)}
            </div>
            <div className="mt-2"><QuickTagCreator onCreated={async (tag) => { setStandardTags((current) => [...current, tag]); await addTag(tag.name); }} /></div>
          </div>
          <button type="button" onClick={drawDownloadOnly} className="mt-auto w-full rounded-lg bg-accent px-4 py-2 font-semibold text-page">{t("tag.draw")}</button>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 flex flex-col p-4 gap-3">
          {!videos.length ? (
            <div className="flex-1 grid place-items-center bg-black rounded-lg border border-border p-8 text-center">
              {match?.coach_id === currentUserId ? (
                <div className="w-full max-w-md text-left">
                  <h2 className="text-textBright text-lg font-semibold text-center">{t("match.attachVideos")}</h2>
                  <p className="text-textMuted text-sm mt-2 text-center">{t("match.attachVideosHelp")}</p>
                  <div className="mt-4 flex justify-center overflow-hidden rounded-lg border border-borderButton text-xs font-semibold">
                    <button type="button" onClick={() => setAttachSource("external")} className={`px-3 py-1.5 ${attachSource === "external" ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>{t("match.sourceExternal")}</button>
                    <button type="button" onClick={() => setAttachSource("file")} className={`px-3 py-1.5 ${attachSource === "file" ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>{t("match.sourceFile")}</button>
                  </div>
                  {attachSource === "external" ? (
                    <div className="mt-4">
                      <label className="block text-sm text-textSecondary">{t("match.recordingId")}
                        <input type="text" inputMode="numeric" value={attachRecordingId} onChange={(event) => setAttachRecordingId(event.target.value)} placeholder="1391450" className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" />
                      </label>
                      <div className="mt-3">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-textMuted">{t("match.camerasUsed")}</span>
                        <div className="grid grid-cols-7 gap-2">
                          {EXTERNAL_RECORDING_CAMERAS.map((cameraNumber) => {
                            const checked = attachCameras.includes(cameraNumber);
                            return <button key={cameraNumber} type="button" onClick={() => toggleAttachCamera(cameraNumber)} className={`rounded-lg border py-2 text-center text-sm font-semibold ${checked ? "border-accent bg-accentDim text-textBright" : "border-borderButton bg-cardAlt text-textSecondary"}`}>{cameraNumber}</button>;
                          })}
                        </div>
                      </div>
                      <button type="button" disabled={attaching || !attachRecordingId.trim() || !attachCameras.length} onClick={() => void attachExternalRecording()} className="mt-4 w-full rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:opacity-50">{attaching ? t("match.working") : t("match.attachAction")}</button>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <button type="button" disabled={attaching} onClick={() => void chooseLocalFilesToAttach()} className="w-full rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:opacity-50">{attaching ? t("match.working") : t("match.attachAction")}</button>
                    </div>
                  )}
                </div>
              ) : <p className="text-textMuted">{t("video.noVideo")}</p>}
            </div>
          ) : currentVideo && isLocalVideoUrl(currentVideo.video_url) && !currentFile ? <div className="flex-1 grid place-items-center bg-black rounded-lg border border-border p-8 text-center"><div><h2 className="text-textBright text-lg font-semibold">{t("match.reconnect", { number: currentIndex + 1 })}</h2><p className="text-textMuted text-sm mt-2">{t("match.reconnectHelp")}</p>{supportsPersistentFileAccess === false && <p className="mt-2 text-xs text-amber-300">{t("match.browserReconnect")}</p>}<div className="mt-4 flex flex-wrap justify-center gap-2"><button onClick={() => void reconnectAllVideos()} className="px-4 py-2 rounded-lg bg-accent text-page font-semibold">{t("match.reconnectAll")}</button><button onClick={() => void reconnect(currentVideo)} className="px-4 py-2 rounded-lg bg-button text-textPrimary">{t("match.onlyVideo", { number: currentIndex + 1 })}</button></div></div></div> : <div className="relative flex min-h-0 flex-1"><VideoPlayer ref={videoRef} src={playbackUrl ?? currentVideo?.video_url} onTimeUpdate={handleViewerTimeUpdate} onDurationChange={onVideoReady} onEnded={playNext} onPlayingChange={setIsPlaying} /><ActiveTagOverlay tags={displayTags} currentTime={combinedTime} /><ActiveDrawingOverlay drawing={playingDrawing} /></div>}
          <div className="flex min-h-12 overflow-hidden rounded-lg border border-border bg-cardDeep" aria-label={t("match.videoSequence")}>
            {videos.map((video, index) => (
              <button
                key={video.id}
                type="button"
                onClick={() => seekTo(offsets.map.get(video.id) ?? 0)}
                style={{ flexGrow: Math.max(1, video.duration ?? 0), flexBasis: 0 }}
                className={`min-w-[72px] border-r border-border px-2 py-1 text-center text-xs last:border-r-0 ${index === currentIndex ? "bg-accentDim text-textBright" : "text-textSecondary hover:bg-cardHover"}`}
                title={`${video.title || `Video ${index + 1}`} · ${formatTime(video.duration ?? 0)}`}
              >
                <span className="block truncate font-semibold">{t("match.videoNumber", { number: index + 1 })}</span>
                <span className="block text-[10px] text-textMuted">{formatTime(video.duration ?? 0)}{isLocalVideoUrl(video.video_url) && !files[video.id] ? ` · ${t("match.reconnectShort")}` : ""}</span>
              </button>
            ))}
          </div>
          {currentBlockCameras.length > 1 && (
            <div className="flex min-h-10 items-center gap-1 overflow-x-auto rounded-lg border border-border bg-cardDeep px-2 py-1.5" aria-label={t("match.cameraSwitch")}>
              <span className="mr-1 flex-shrink-0 text-xs font-semibold text-textMuted">{t("match.camera")}</span>
              {currentBlockCameras.map((block) => {
                const cameraNumber = block.videos?.camera_number ?? null;
                const active = activeCameraBlock?.id === block.id;
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => switchCamera(cameraNumber)}
                    className={`flex-shrink-0 rounded-lg border px-3 py-1 text-xs font-semibold ${active ? "border-accent bg-accentDim text-textBright" : "border-borderButton bg-button text-textSecondary hover:bg-cardHover"}`}
                  >
                    {cameraNumber ?? "?"}
                  </button>
                );
              })}
            </div>
          )}
          <Timeline duration={offsets.total} currentTime={combinedTime} tags={displayTags} onSeek={seekTo} />
          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        </main>

        <aside className="w-96 bg-card p-4 border-l border-border overflow-y-auto space-y-4">
          {!!liveTags.length && <section className="min-h-0">
            <h3 className="mb-1 font-semibold text-textBright">{t("liveTags.title")}</h3>
            <p className="mb-2 text-xs text-textMuted">{t("liveTags.subtitle")}</p>
            {calibratingLiveTagId && (
              <div className="mb-2 rounded-lg border border-accent bg-accentDim p-2.5">
                <p className="text-xs font-semibold text-textBright">{t("liveTags.calibrateHelp", { name: liveTags.find((item) => item.id === calibratingLiveTagId)?.tag_name ?? "" })}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => setCalibratingLiveTagId(null)} className="flex-1 rounded-lg bg-button px-2 py-1.5 text-xs font-semibold text-textPrimary">{t("common.cancel")}</button>
                  <button type="button" onClick={() => void confirmLiveTagCalibration()} className="flex-1 rounded-lg bg-accent px-2 py-1.5 text-xs font-semibold text-page">{t("liveTags.calibrateConfirm")}</button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {liveTags.map((liveTag) => {
                const elapsed = liveTagElapsedSeconds(liveTag);
                const materializedTag = liveTag.tag_id ? displayTags.find((tag) => tag.id === liveTag.tag_id) : undefined;
                return <LiveTagRow
                  key={liveTag.id}
                  liveTag={liveTag}
                  materializedTag={materializedTag}
                  elapsed={elapsed}
                  reviewed={!!liveTag.reviewed_at}
                  onToggleReviewed={() => void toggleLiveTagReviewed(liveTag)}
                  onSeek={seekTo}
                  onCalibrate={() => setCalibratingLiveTagId(liveTag.id)}
                  onUpdateTimes={(startTime, endTime) => { if (liveTag.tag_id) void updateTag(liveTag.tag_id, startTime, endTime); }}
                  t={t}
                />;
              })}
            </div>
          </section>}
          <section className="min-h-0">
            <h3 className="mb-2 font-semibold text-textBright">{t("video.taggedClips")}</h3>
            <TagList tags={displayTags.filter((tag) => !isPeriodMarker(tag.name))} selectedTagIds={selectedTagIds} onToggleSelect={(id) => setSelectedTagIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onSeek={seekTo} onDelete={(id) => void deleteTag(id)} onUpdate={updateTag} onRename={renameTag} onDraw={drawOnCurrentFrame} currentTime={combinedTime} onDrawingDurationChange={changeDrawingDuration} onOpenDrawing={openSavedDrawing} />
          </section>
          {videos[0] && <ClipBuilder videoId={videos[0].id} teamId={match?.team_a_id ?? null} selectedTagIds={selectedTagIds} tags={tags} players={players} extraPlayers={extraPlayers} localVideo={isLocalVideoUrl(videos[0].video_url)} localFile={files[videos[0].id] ?? null} localFilesByVideoId={files} localSourcesReady={localFilesReady} siblingCamerasByVideoId={siblingCamerasByVideoId} matchLabel={`${match?.team_a_name || t("match.teamA")} - ${match?.team_b_name || t("match.teamB")}`} onClipCreated={() => setSelectedTagIds([])} />}
        </aside>
      </div>
      {drawingFrame && <FrameDrawingDialog frame={drawingFrame.image} time={drawingFrame.time} initialShapes={drawingFrame.initialShapes} initialDurationSeconds={drawingFrame.durationSeconds} onClose={() => setDrawingFrame(null)} onSave={drawingFrame.tagId ? saveDrawing : undefined} />}
      {pendingGoal && <GoalTagDialog players={players} onCancel={() => setPendingGoal(null)} onConfirm={async (details) => { const pending = pendingGoal; setPendingGoal(null); await persistProfiledTag(pending.video, pending.label, pending.localTime, details); }} />}
      <ConfirmDialog open={confirmDeleteMatch} title={t("match.deleteTitle")} message={t("match.deleteMessage")} busy={deletingMatch} onCancel={() => setConfirmDeleteMatch(false)} onConfirm={() => void deleteMatch()} />
    </div>
  );
}
