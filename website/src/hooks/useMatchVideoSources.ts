"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRememberedLocalVideo, isLocalVideoUrl, localVideoFingerprint, matchesLocalVideo, rememberLocalVideo } from "@/lib/local-video-store";
import { inferRecordingStartMs, inspectLocalVideo, sortLocalVideosByRecordingTime } from "@/lib/media/local-clips";
import { localMediaMessages } from "@/i18n/local-media";
import { useI18n } from "@/i18n/client";
import { externalRecordingUrl, type ExternalRecordingConfig } from "@/lib/external-recording";
import { resolveVeoLink } from "@/lib/veo-browser";
import type { Video } from "@/types/database";

export type MatchBlock = { id: string; sequence_order: number; label: string; is_primary: boolean; recording_started_at: string | null; videos: Video | null };

function messageFrom(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

function primarySequenceOrderAfter(blocks: MatchBlock[]) {
  const primaryOrders = blocks.filter((block) => block.is_primary).map((block) => block.sequence_order);
  if (!primaryOrders.length) return 0;
  return Math.max(...primaryOrders) + 1;
}

/**
 * Owns every way a coach can attach, reconnect, replace, edit, or remove a match's
 * video sources (local files, 360SI external recordings, Veo links, 360 links).
 * `loadMatch`/`setError`/`setCurrentIndex`/`setCombinedTime` are the page's shared
 * state setters, since a successful mutation here also needs to refresh match data
 * or reset playback position.
 */
export function useMatchVideoSources({
  matchId,
  videos,
  allVideos,
  blocks,
  externalRecordingGroups,
  currentUserId,
  loadMatch,
  setError,
  setCurrentIndex,
  setCombinedTime
}: {
  matchId: string;
  videos: Video[];
  allVideos: Video[];
  blocks: MatchBlock[];
  externalRecordingGroups: Map<string, Array<MatchBlock & { videos: Video }>>;
  currentUserId: string;
  loadMatch: () => Promise<void>;
  setError: (message: string) => void;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setCombinedTime: Dispatch<SetStateAction<number>>;
}) {
  const { t } = useI18n();
  const supabase = createClient();
  const reconnectInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const reconnectVideoRef = useRef<Video | null>(null);
  const reconnectAllRef = useRef(false);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [recordingConfig, setRecordingConfig] = useState<ExternalRecordingConfig | null>(null);
  const [attachSource, setAttachSource] = useState<"file" | "external" | "360" | "veo">("file");
  const [attachRecordingId, setAttachRecordingId] = useState("");
  const [attach360Url, setAttach360Url] = useState("");
  const [attachVeoUrl, setAttachVeoUrl] = useState("");
  const [attachCameras, setAttachCameras] = useState<number[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingRecordingId, setEditingRecordingId] = useState<string | null>(null);
  const [sourceDraft, setSourceDraft] = useState({ label: "", url: "", cameraNumber: "" });
  const [replacing, setReplacing] = useState(false);
  const [removingVideoId, setRemovingVideoId] = useState<string | null>(null);

  async function attachFile(video: Video, file: File, handle?: FileSystemFileHandle | null) {
    try {
      const info = await inspectLocalVideo(file, localMediaMessages(t));
      if (!await matchesLocalVideo(file, video, info.duration)) throw new Error(t("match.wrongOriginal"));
      await rememberLocalVideo(video.id, file, handle);
      await saveLocalRecordingStart(video, file, info.duration);
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
      const unmatched = [...missing];
      for (const handle of handles) {
        const file = await handle.getFile();
        const info = await inspectLocalVideo(file, localMediaMessages(t));
        let matchIndex = -1;
        for (let index = 0; index < unmatched.length; index += 1) {
          if (await matchesLocalVideo(file, unmatched[index], info.duration)) { matchIndex = index; break; }
        }
        if (matchIndex >= 0) {
          const [video] = unmatched.splice(matchIndex, 1);
          await rememberLocalVideo(video.id, file, handle);
          await saveLocalRecordingStart(video, file, info.duration);
          setFiles((current) => ({ ...current, [video.id]: file }));
        }
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
    const unmatched = videos.filter((video) => isLocalVideoUrl(video.video_url) && !files[video.id]);
    for (const file of selectedFiles) {
      const info = await inspectLocalVideo(file, localMediaMessages(t));
      let matchIndex = -1;
      for (let index = 0; index < unmatched.length; index += 1) {
        if (await matchesLocalVideo(file, unmatched[index], info.duration)) { matchIndex = index; break; }
      }
      if (matchIndex >= 0) {
        const [video] = unmatched.splice(matchIndex, 1);
        await rememberLocalVideo(video.id, file);
        await saveLocalRecordingStart(video, file, info.duration);
        setFiles((current) => ({ ...current, [video.id]: file }));
      }
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

  function beginEditVideoSource(block: MatchBlock & { videos: Video }) {
    setEditingVideoId(block.videos.id);
    setSourceDraft({
      label: block.label || block.videos.title || "",
      url: isLocalVideoUrl(block.videos.video_url) ? "" : block.videos.video_url,
      cameraNumber: block.videos.camera_number ? String(block.videos.camera_number) : ""
    });
  }

  function beginEditExternalRecording(recordingId: string) {
    const group = externalRecordingGroups.get(recordingId) ?? [];
    setEditingRecordingId(recordingId);
    setAttachSource("external");
    setAttachRecordingId(recordingId);
    setAttachCameras(group.map((block) => block.videos.camera_number).filter((camera): camera is number => camera !== null));
  }

  async function saveExternalRecording() {
    const nextRecordingId = attachRecordingId.trim();
    if (!recordingConfig || !editingRecordingId || !nextRecordingId || !attachCameras.length) return;
    const group = externalRecordingGroups.get(editingRecordingId) ?? [];
    const existingByCamera = new Map(group.map((block) => [block.videos.camera_number, block]));
    const sequenceOrder = group[0]?.sequence_order ?? 0;
    setAttaching(true);
    setError("");
    try {
      for (const cameraNumber of [...attachCameras].sort((a, b) => a - b)) {
        const existing = existingByCamera.get(cameraNumber);
        const source = {
          video_url: externalRecordingUrl(recordingConfig, nextRecordingId, cameraNumber),
          video_key: `external/${nextRecordingId}/ch${cameraNumber}`,
          camera_number: cameraNumber,
          title: t("match.cameraLabel", { number: cameraNumber }),
          label: t("match.cameraLabel", { number: cameraNumber })
        };
        if (existing) {
          const response = await fetch(`/api/matches/${matchId}/videos/${existing.videos.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(source)
          });
          const body = await response.json().catch(() => null) as { error?: string } | null;
          if (!response.ok) throw new Error(body?.error || t("match.updateSourceFailed"));
        } else {
          await createMatchVideoSource({ ...source, sequence_order: sequenceOrder, is_primary: false });
        }
      }
      for (const block of group.filter((item) => item.videos.camera_number === null || !attachCameras.includes(item.videos.camera_number))) {
        const response = await fetch(`/api/matches/${matchId}/videos/${block.videos.id}`, { method: "DELETE" });
        const body = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) throw new Error(body?.error || t("match.removeVideoFailed"));
      }
      setEditingRecordingId(null);
      setAttachRecordingId("");
      setAttachCameras([]);
      await loadMatch();
    } catch (updateError) {
      setError(messageFrom(updateError, t("match.updateSourceFailed")));
    } finally {
      setAttaching(false);
    }
  }

  async function saveVideoSource(video: Video) {
    const label = sourceDraft.label.trim();
    if (!label) return;
    setAttaching(true);
    setError("");
    try {
      const response = await fetch(`/api/matches/${matchId}/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: label,
          label,
          ...(isLocalVideoUrl(video.video_url) ? {} : { video_url: sourceDraft.url.trim() }),
          camera_number: sourceDraft.cameraNumber ? Number(sourceDraft.cameraNumber) : null
        })
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || t("match.updateSourceFailed"));
      setEditingVideoId(null);
      await loadMatch();
    } catch (updateError) {
      setError(messageFrom(updateError, t("match.updateSourceFailed")));
    } finally {
      setAttaching(false);
    }
  }

  async function createMatchVideoSource(source: {
    video_url: string;
    video_key: string;
    title: string;
    camera_number?: number | null;
    file_size?: number | null;
    duration?: number | null;
    sequence_order: number;
    is_primary: boolean;
    label: string;
    recording_started_at?: string | null;
  }): Promise<Video> {
    const response = await fetch(`/api/matches/${matchId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(source)
    });
    const body = await response.json().catch(() => null) as { video?: Video; error?: string } | null;
    if (!response.ok || !body?.video) throw new Error(body?.error || t("match.createFailed"));
    return body.video;
  }

  async function attachExternalRecording() {
    const trimmedRecordingId = attachRecordingId.trim();
    if (!recordingConfig || !trimmedRecordingId || !attachCameras.length || !currentUserId) return;
    setAttaching(true);
    setError("");
    try {
      const existingCameraNumbers = new Set(allVideos.map((video) => video.camera_number).filter((number): number is number => number !== null));
      const cameras = [...attachCameras].filter((number) => !existingCameraNumbers.has(number)).sort((a, b) => a - b);
      if (!cameras.length) throw new Error(t("match.camerasAlreadyAdded"));
      for (let index = 0; index < cameras.length; index += 1) {
        const cameraNumber = cameras[index];
        await createMatchVideoSource({
          video_url: externalRecordingUrl(recordingConfig, trimmedRecordingId, cameraNumber),
          video_key: `external/${trimmedRecordingId}/ch${cameraNumber}`,
          camera_number: cameraNumber,
          title: t("match.cameraLabel", { number: cameraNumber }),
          sequence_order: 0,
          is_primary: !blocks.length && index === 0,
          label: t("match.cameraLabel", { number: cameraNumber })
        });
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

  async function attachVeoRecording() {
    if (!attachVeoUrl.trim() || !currentUserId) return;
    setAttaching(true);
    setError("");
    try {
      const veo = await resolveVeoLink(attachVeoUrl);
      await createMatchVideoSource({
        video_url: veo.sourceUrl,
        video_key: `veo/${veo.matchSlug}/standard`,
        title: t("match.veoFollowCam"),
        sequence_order: 0,
        is_primary: !blocks.length,
        label: t("match.veoFollowCam")
      });
      setAttachVeoUrl("");
      await loadMatch();
    } catch (attachError) {
      setError(messageFrom(attachError, t("match.veoResolveFailed")));
    } finally {
      setAttaching(false);
    }
  }

  async function attach360Recording() {
    if (!attach360Url.trim() || !currentUserId) return;
    setAttaching(true);
    setError("");
    try {
      const source = new URL(attach360Url.trim());
      if (source.protocol !== "https:") throw new Error(t("match.360Invalid"));
      await createMatchVideoSource({
        video_url: source.toString(),
        video_key: `external-link/${crypto.randomUUID()}`,
        title: t("match.360Video"),
        sequence_order: 0,
        is_primary: !blocks.length,
        label: t("match.360Video")
      });
      setAttach360Url("");
      await loadMatch();
    } catch (attachError) {
      setError(messageFrom(attachError, t("match.360Invalid")));
    } finally {
      setAttaching(false);
    }
  }

  async function attachLocalFiles(selections: { file: File; handle: FileSystemFileHandle | null }[]) {
    if (!selections.length || !currentUserId) return;
    setAttaching(true);
    setError("");
    try {
      const inspected = [];
      for (const selection of selections) {
        const [info, fingerprint] = await Promise.all([inspectLocalVideo(selection.file, localMediaMessages(t)), localVideoFingerprint(selection.file)]);
        inspected.push({ ...selection, info, fingerprint });
      }
      const orderedSelections = sortLocalVideosByRecordingTime(inspected);
      const nextSequenceOrder = primarySequenceOrderAfter(blocks);
      for (let index = 0; index < orderedSelections.length; index += 1) {
        const selection = orderedSelections[index];
        const video = await createMatchVideoSource({
          video_url: `local://${selection.fingerprint}`,
          video_key: `local/${selection.fingerprint}`,
          file_size: selection.file.size,
          duration: Math.round(selection.info.duration),
          title: selection.file.name.replace(/\.[^/.]+$/, ""),
          sequence_order: nextSequenceOrder + index,
          is_primary: true,
          label: `Video ${index + 1}`,
          recording_started_at: recordingStartedAt(selection.file, selection.info.duration)
        });
        await rememberLocalVideo(video.id, selection.file, selection.handle);
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

  async function removeVideoSource(video: Video) {
    if (!window.confirm(t("match.removeVideoConfirm", { name: video.title || t("video.match") }))) return;
    setRemovingVideoId(video.id);
    setError("");
    const response = await fetch(`/api/matches/${matchId}/videos/${video.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    setRemovingVideoId(null);
    if (!response.ok) { setError(body?.error || t("match.removeVideoFailed")); return; }
    setCurrentIndex(0);
    await loadMatch();
  }

  async function saveLocalRecordingStart(video: Video, file: File, durationSeconds: number) {
    const block = blocks.find((item) => item.videos?.id === video.id);
    if (!block || block.recording_started_at) return;
    const recording_started_at = recordingStartedAt(file, durationSeconds);
    if (!recording_started_at) return;
    await fetch(`/api/matches/${matchId}/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recording_started_at })
    });
  }

  return {
    files, setFiles,
    recordingConfig, setRecordingConfig,
    attachSource, setAttachSource,
    attachRecordingId, setAttachRecordingId,
    attach360Url, setAttach360Url,
    attachVeoUrl, setAttachVeoUrl,
    attachCameras, setAttachCameras,
    attaching,
    editingVideoId, setEditingVideoId,
    editingRecordingId, setEditingRecordingId,
    sourceDraft, setSourceDraft,
    replacing,
    removingVideoId,
    reconnectInputRef, replaceInputRef, attachInputRef,
    reconnect, reconnectAllVideos, handleFallbackSelection,
    replaceSelectedVideos, chooseReplacementVideos,
    toggleAttachCamera, beginEditVideoSource, beginEditExternalRecording,
    saveExternalRecording, saveVideoSource,
    attachExternalRecording, attachVeoRecording, attach360Recording,
    attachLocalFiles, chooseLocalFilesToAttach, removeVideoSource
  };
}

function recordingStartedAt(file: File, durationSeconds: number) {
  const startMs = inferRecordingStartMs(file, durationSeconds);
  return startMs === null ? null : new Date(startMs).toISOString();
}
