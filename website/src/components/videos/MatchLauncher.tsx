"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { inspectLocalVideo, type LocalVideoInfo } from "@/lib/media/local-clips";
import { getRememberedLocalVideo, localVideoFingerprint, rememberLocalVideo } from "@/lib/local-video-store";
import { EXTERNAL_RECORDING_CAMERAS, externalRecordingUrl } from "@/lib/external-recording";
import type { Match, Team, Video } from "@/types/database";
import { useI18n } from "@/i18n/client";
import { localMediaMessages } from "@/i18n/local-media";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { resolveVeoLink } from "@/lib/veo-browser";
import { useActiveClub } from "@/components/clubs/ActiveClubProvider";

type Mode = "recent" | "all" | "create";
type SelectedVideo = { file: File; handle: FileSystemFileHandle | null; info: LocalVideoInfo };
type RecentItem =
  | { kind: "match"; id: string; title: string; date: string; openedAt: string; count: number; videoIds: string[] }
  | { kind: "video"; id: string; title: string; date: string; openedAt: string; count: 1; videoIds: string[] };

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

export function MatchLauncher({ canCreateMatch = false }: { canCreateMatch?: boolean }) {
  const { t } = useI18n();
  const { activeClubId } = useActiveClub();
  const router = useRouter();
  const supabase = createClient();
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);
  const reconnectInputRef = useRef<HTMLInputElement | null>(null);
  const pendingRecentItemRef = useRef<RecentItem | null>(null);
  const pendingSlotRef = useRef(0);
  const [mode, setMode] = useState<Mode>("recent");
  const [matches, setMatches] = useState<(Match & { match_videos: { video_id: string }[] })[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [slots, setSlots] = useState<(SelectedVideo | null)[]>([null, null, null, null]);
  const [videoSource, setVideoSource] = useState<"file" | "external" | "veo">("file");
  const [recordingId, setRecordingId] = useState("");
  const [veoUrl, setVeoUrl] = useState("");
  const [selectedCameras, setSelectedCameras] = useState<number[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [teamAId, setTeamAId] = useState("");
  const [teamAName, setTeamAName] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [teamBName, setTeamBName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [supportsPersistentFileAccess, setSupportsPersistentFileAccess] = useState<boolean | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Extract<RecentItem, { kind: "match" }> | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setMatches([]);
    setTeams([]);
    void loadData();
    const supported = typeof (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker === "function";
    setSupportsPersistentFileAccess(supported);
  }, [activeClubId]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !activeClubId) return;
    const [matchResult, videoResult, teamResult] = await Promise.all([
      // Platform admins can read every club, so the active club must always be
      // an explicit query boundary instead of relying on row-level access alone.
      supabase.from("matches").select("*, match_videos(video_id)").eq("club_id", activeClubId).order("last_opened_at", { ascending: false }),
      supabase.from("videos").select("*").eq("coach_id", user.id).eq("status", "active").order("created_at", { ascending: false }),
      supabase.from("teams").select("*, club_teams!inner(club_id)").eq("club_teams.club_id", activeClubId).order("name")
    ]);
    if (matchResult.error && matchResult.error.code !== "42P01") setError(matchResult.error.message);
    setMatches((matchResult.data as (Match & { match_videos: { video_id: string }[] })[] | null) ?? []);
    setVideos(videoResult.data ?? []);
    setTeams(teamResult.data ?? []);
  }

  const today = new Date().toISOString().slice(0, 10);
  const recentItems: RecentItem[] = [
    ...matches.filter(match => !!match.match_date && match.match_date <= today).map((match): RecentItem => ({
      kind: "match",
      id: match.id,
      title: `${match.team_a_name || t("match.teamA")} – ${match.team_b_name || t("match.teamB")}`,
      date: match.match_date || t("match.noDate"),
      openedAt: `${match.match_date}T${match.start_time || "00:00:00"}`,
      count: match.match_videos.length,
      videoIds: match.match_videos.map((video) => video.video_id)
    })),
  ].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

  async function openItem(item: RecentItem) {
    setBusy(true);
    setError("");
    setStatus(t("match.checkingSaved"));
    const localVideos = videosForItem(item);
    const missing: Video[] = [];
    for (const video of localVideos) {
      if (!await getRememberedLocalVideo(video.id, true)) missing.push(video);
    }

    if (missing.length) {
      const picker = (window as unknown as { showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker;
      if (!picker) {
        pendingRecentItemRef.current = item;
        setStatus(t("match.selectOriginalBeforeOpen"));
        setBusy(false);
        reconnectInputRef.current?.click();
        return;
      }
      try {
        const handles = await picker({ multiple: missing.length > 1, types: [{ description: "Match videos", accept: { "video/mp4": [".mp4", ".m4v"], "video/quicktime": [".mov"] } }] });
        await rememberSelectedFiles(missing, await Promise.all(handles.map(async (handle) => ({ file: await handle.getFile(), handle }))));
      } catch (pickerError) {
        setBusy(false);
        setStatus("");
        if (!(pickerError instanceof DOMException && pickerError.name === "AbortError")) setError(getErrorMessage(pickerError, t("match.localReconnectFailed")));
        return;
      }
      if (!(await allVideosRemembered(missing))) {
        setBusy(false);
        setStatus("");
        setError(t("match.selectAllOriginals", { count: missing.length }));
        return;
      }
    }
    await navigateToItem(item);
  }

  function videosForItem(item: RecentItem) {
    return item.videoIds.map((id) => videos.find((video) => video.id === id)).filter((video): video is Video => !!video && video.video_url.startsWith("local://"));
  }

  async function rememberSelectedFiles(expected: Video[], selections: { file: File; handle: FileSystemFileHandle | null }[]) {
    for (const selection of selections) {
      const fingerprint = await localVideoFingerprint(selection.file);
      const video = expected.find((candidate) => candidate.video_key === `local/${fingerprint}`);
      if (video) await rememberLocalVideo(video.id, selection.file, selection.handle);
    }
  }

  async function allVideosRemembered(expected: Video[]) {
    for (const video of expected) if (!await getRememberedLocalVideo(video.id)) return false;
    return true;
  }

  async function handleRecentFiles(files: File[]) {
    const item = pendingRecentItemRef.current;
    if (!item) return;
    setBusy(true);
    setError("");
    const expected = videosForItem(item);
    await rememberSelectedFiles(expected, files.map((file) => ({ file, handle: null })));
    if (!(await allVideosRemembered(expected))) {
      setError(t("match.originalsMissing"));
      setStatus("");
      setBusy(false);
      return;
    }
    pendingRecentItemRef.current = null;
    await navigateToItem(item);
  }

  async function navigateToItem(item: RecentItem) {
    if (item.kind === "video") {
      router.push(`/dashboard/videos/${item.id}`);
      return;
    }
    await supabase.from("matches").update({ last_opened_at: new Date().toISOString() }).eq("id", item.id);
    router.push(`/dashboard/matches/${item.id}`);
  }

  async function deleteMatch() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    const response = await fetch(`/api/matches/${deleteTarget.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    setDeleting(false);
    if (!response.ok) { setError(body?.error || t("match.deleteFailed")); setDeleteTarget(null); return; }
    setDeleteTarget(null);
    await loadData();
  }

  async function acceptFile(index: number, file: File, handle: FileSystemFileHandle | null) {
    setBusy(true);
    setStatus(t("match.checkingVideo", { number: index + 1 }));
    setError("");
    try {
      const info = await inspectLocalVideo(file, localMediaMessages(t));
      setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? { file, handle, info } : slot));
    } catch (fileError) {
      setError(getErrorMessage(fileError, t("video.localOpenFailed")));
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function selectSlot(index: number) {
    pendingSlotRef.current = index;
    const picker = (window as unknown as {
      showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]>;
    }).showOpenFilePicker;
    if (!picker) {
      fallbackInputRef.current?.click();
      return;
    }
    try {
      const [handle] = await picker({
        multiple: false,
        types: [{ description: "Match video", accept: { "video/mp4": [".mp4", ".m4v"], "video/quicktime": [".mov"] } }]
      });
      if (handle) await acceptFile(index, await handle.getFile(), handle);
    } catch (pickerError) {
      if (!(pickerError instanceof DOMException && pickerError.name === "AbortError")) {
        setError(getErrorMessage(pickerError, t("video.localOpenFailed")));
      }
    }
  }

  function resetDraft() {
    setSlots([null, null, null, null]);
    setVideoSource("file");
    setRecordingId("");
    setVeoUrl("");
    setSelectedCameras([]);
    setDate(new Date().toISOString().slice(0, 10));
    setStartTime("");
    setTeamAId("");
    setTeamAName("");
    setTeamBId("");
    setTeamBName("");
    setError("");
  }

  function toggleCamera(cameraNumber: number) {
    setSelectedCameras((current) => current.includes(cameraNumber) ? current.filter((n) => n !== cameraNumber) : [...current, cameraNumber]);
  }

  async function createMatch(event: React.FormEvent) {
    event.preventDefault();
    const selected = slots.filter((slot): slot is SelectedVideo => !!slot);
    if (videoSource === "file" && !selected.length) return;
    if (videoSource === "external" && (!recordingId.trim() || !selectedCameras.length)) return;
    if (videoSource === "veo" && !veoUrl.trim()) return;
    setBusy(true);
    setError("");

    let createdMatchId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("errors.sessionExpired"));
      setStatus(t("match.creating"));
      const selectedTeamA = teams.find((team) => team.id === teamAId);
      const selectedTeamB = teams.find((team) => team.id === teamBId);
      const { data: match, error: matchError } = await supabase.from("matches").insert({
        coach_id: user.id,
        team_a_id: teamAId || null,
        team_b_id: teamBId || null,
        team_a_name: selectedTeamA?.name || teamAName.trim() || t("match.teamA"),
        team_b_name: selectedTeamB?.name || teamBName.trim() || t("match.teamB"),
        match_date: date || null,
        start_time: startTime || null,
        last_opened_at: new Date().toISOString()
      }).select("id").single();
      if (matchError) throw matchError;
      createdMatchId = match.id;

      if (videoSource === "veo") {
        setStatus(t("match.resolvingVeo"));
        const veo = await resolveVeoLink(veoUrl);
        const { data: video, error: videoError } = await supabase.from("videos").insert({
          coach_id: user.id,
          team_id: teamAId || null,
          video_url: veo.sourceUrl,
          video_key: `veo/${veo.matchSlug}/standard`,
          processing_status: "ready",
          title: t("match.veoFollowCam")
        }).select("id").single();
        if (videoError) throw videoError;
        const { error: linkError } = await supabase.from("match_videos").insert({
          match_id: match.id,
          video_id: video.id,
          sequence_order: 0,
          is_primary: true,
          label: t("match.veoFollowCam")
        });
        if (linkError) throw linkError;
      } else if (videoSource === "external") {
        const trimmedRecordingId = recordingId.trim();
        const cameras = [...selectedCameras].sort((a, b) => a - b);
        for (let index = 0; index < cameras.length; index += 1) {
          const cameraNumber = cameras[index];
          setStatus(t("match.savingVideo", { current: index + 1, total: cameras.length }));
          const { data: video, error: videoError } = await supabase.from("videos").insert({
            coach_id: user.id,
            team_id: teamAId || null,
            video_url: externalRecordingUrl(trimmedRecordingId, cameraNumber),
            video_key: `external/${trimmedRecordingId}/ch${cameraNumber}`,
            camera_number: cameraNumber,
            processing_status: "ready",
            title: t("match.cameraLabel", { number: cameraNumber })
          }).select("id").single();
          if (videoError) throw videoError;
          const { error: linkError } = await supabase.from("match_videos").insert({
            match_id: match.id,
            video_id: video.id,
            sequence_order: 0,
            is_primary: index === 0,
            label: t("match.cameraLabel", { number: cameraNumber })
          });
          if (linkError) throw linkError;
        }
      } else {
        for (let index = 0; index < selected.length; index += 1) {
          const selection = selected[index];
          setStatus(t("match.savingVideo", { current: index + 1, total: selected.length }));
          const fingerprint = await localVideoFingerprint(selection.file);
          const { data: existing } = await supabase.from("videos").select("id")
            .eq("coach_id", user.id).eq("video_key", `local/${fingerprint}`).eq("status", "active").maybeSingle();
          let videoId = existing?.id;
          if (!videoId) {
            const { data: video, error: videoError } = await supabase.from("videos").insert({
              coach_id: user.id,
              team_id: teamAId || null,
              video_url: `local://${fingerprint}`,
              video_key: `local/${fingerprint}`,
              file_size: selection.file.size,
              duration: Math.round(selection.info.duration),
              processing_status: "ready",
              title: selection.file.name.replace(/\.[^/.]+$/, "")
            }).select("id").single();
            if (videoError) throw videoError;
            videoId = video.id;
          }
          await rememberLocalVideo(videoId, selection.file, selection.handle);
          const { error: linkError } = await supabase.from("match_videos").insert({
            match_id: match.id,
            video_id: videoId,
            sequence_order: index,
            label: `Video ${index + 1}`
          });
          if (linkError) throw linkError;
        }
      }

      router.push(`/dashboard/matches/${match.id}`);
    } catch (createError) {
      if (createdMatchId) await supabase.from("matches").delete().eq("id", createdMatchId);
      setError(getErrorMessage(createError, t("match.createFailed")));
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/75 p-4">
      <input
        ref={fallbackInputRef}
        type="file"
        accept=".mp4,.mov,.m4v,video/mp4,video/quicktime"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void acceptFile(pendingSlotRef.current, file, null);
          event.target.value = "";
        }}
      />
      <input ref={reconnectInputRef} type="file" multiple accept=".mp4,.mov,.m4v,video/mp4,video/quicktime" className="hidden" onChange={(event) => { void handleRecentFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-borderButton bg-cardAlt p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label={t("common.videoViewer")}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div><h1 className="text-xl font-bold text-textBright">{mode === "create" ? t("match.new") : mode === "all" ? t("match.older") : t("common.videoViewer")}</h1><p className="text-sm text-textMuted mt-1">{t("match.localIntro")}</p></div>
          <button type="button" onClick={() => router.push("/dashboard")} className="px-3 py-2 rounded-lg bg-button text-textPrimary">{t("common.close")}</button>
        </div>

        {mode === "recent" && (
          <>
            {canCreateMatch && <button type="button" onClick={() => { resetDraft(); setMode("create"); }} className="w-full rounded-xl bg-accent px-5 py-3 font-bold text-page">{t("match.createNew")}</button>}
            <div className="mt-5 space-y-2">
              <h2 className="text-sm font-semibold text-textSecondary">{t("match.last")}</h2>
              {supportsPersistentFileAccess === false && (
                <div className="text-[11px] leading-tight text-amber-300">
                  {t("match.autoReconnectUnavailable")}
                </div>
              )}
              {[0, 1, 2, 3].map((index) => {
                const item = recentItems[index];
                return item ? (
                  <div key={`${item.kind}-${item.id}`} className="flex items-stretch overflow-hidden rounded-xl border border-border bg-cardDeep hover:border-accent"><button type="button" disabled={busy} onClick={() => void openItem(item)} className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3 text-left hover:bg-cardHover disabled:opacity-50">
                    <span><strong className="block text-textPrimary">{item.title}</strong><span className="text-xs text-textMuted">{item.date} · {item.count} video{item.count === 1 ? "" : "s"}</span></span>
                    <span className="text-accent">{t("match.open")}</span>
                  </button>{item.kind === "match" && <button type="button" disabled={busy} onClick={() => setDeleteTarget(item)} aria-label={t("match.deleteNamed", { name: item.title })} title={t("match.delete")} className="grid w-12 flex-shrink-0 place-items-center border-l border-border text-lg text-red-400 hover:bg-red-500/15 disabled:opacity-50">🗑</button>}</div>
                ) : <div key={index} className="rounded-xl border border-border bg-cardDeep px-4 py-3 text-sm text-textMuted">{t("match.noRecent")}</div>;
              })}
            </div>
            {status && <div className="mt-3 rounded-lg border border-border bg-cardDeep p-3 text-sm text-textSecondary">{status}</div>}
            {error && <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
            <button type="button" onClick={() => setMode("all")} className="mt-4 w-full rounded-lg bg-button px-4 py-2 text-textPrimary">{t("match.viewOlder")}</button>
          </>
        )}

        {mode === "all" && (
          <div className="space-y-2">
            {recentItems.map((item) => <div key={`${item.kind}-${item.id}`} className="flex items-stretch overflow-hidden rounded-lg border border-border bg-cardDeep hover:border-accent"><button type="button" disabled={busy} onClick={() => void openItem(item)} className="flex min-w-0 flex-1 justify-between gap-3 px-4 py-3 text-left text-textPrimary hover:bg-cardHover disabled:opacity-50"><span className="truncate">{item.title}</span><span className="flex-shrink-0 text-sm text-textMuted">{item.date}</span></button>{item.kind === "match" && <button type="button" disabled={busy} onClick={() => setDeleteTarget(item)} aria-label={t("match.deleteNamed", { name: item.title })} title={t("match.delete")} className="grid w-12 flex-shrink-0 place-items-center border-l border-border text-lg text-red-400 hover:bg-red-500/15 disabled:opacity-50">🗑</button>}</div>)}
            {!recentItems.length && <p className="text-textMuted">{t("match.noneSaved")}</p>}
            {status && <div className="rounded-lg border border-border bg-cardDeep p-3 text-sm text-textSecondary">{status}</div>}
            {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
            <button type="button" onClick={() => setMode("recent")} className="mt-3 w-full rounded-lg bg-button px-4 py-2 text-textPrimary">{t("common.back")}</button>
          </div>
        )}

        {mode === "create" && canCreateMatch && (
          <form onSubmit={createMatch} className="space-y-5">
            {supportsPersistentFileAccess === false && (
              <div className="text-[11px] leading-tight text-amber-300">
                {t("match.browserCannotRemember")}
              </div>
            )}
            <section className="rounded-xl border border-border bg-cardDeep p-4">
              <h2 className="font-semibold text-textBright mb-3">{t("match.information")}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-textSecondary">{t("match.date")}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" /></label>
                <label className="text-sm text-textSecondary">{t("match.startTime")}<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" /></label>
                <label className="text-sm text-textSecondary">{t("match.teamA")}<select value={teamAId} onChange={(event) => { setTeamAId(event.target.value); setTeamAName(""); }} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary"><option value="">{t("match.enterName")}</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>{!teamAId && <input value={teamAName} onChange={(event) => setTeamAName(event.target.value)} placeholder={t("match.teamA")} className="mt-2 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" />}</label>
                <label className="text-sm text-textSecondary">{t("match.teamB")}<select value={teamBId} onChange={(event) => { setTeamBId(event.target.value); setTeamBName(""); }} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary"><option value="">{t("match.enterName")}</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>{!teamBId && <input value={teamBName} onChange={(event) => setTeamBName(event.target.value)} placeholder={t("match.teamB")} className="mt-2 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" />}</label>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-cardDeep p-4">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-textBright">{t("match.videos")}</h2>
                <div className="flex overflow-hidden rounded-lg border border-borderButton text-xs font-semibold">
                  <button type="button" onClick={() => setVideoSource("file")} className={`px-3 py-1.5 ${videoSource === "file" ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>{t("match.sourceFile")}</button>
                  <button type="button" onClick={() => setVideoSource("external")} className={`px-3 py-1.5 ${videoSource === "external" ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>{t("match.sourceExternal")}</button>
                  <button type="button" onClick={() => setVideoSource("veo")} className={`px-3 py-1.5 ${videoSource === "veo" ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>{t("match.sourceVeo")}</button>
                </div>
              </div>

              {videoSource === "file" ? (
                <>
                  <div className="mt-1 flex items-center justify-between"><p className="text-xs text-textMuted">{t("match.playOrder")}</p><button type="button" onClick={() => setSlots((current) => [...current, null])} className="rounded-lg bg-button px-3 py-2 text-sm text-textPrimary">{t("match.addMore")}</button></div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {slots.map((slot, index) => <button key={index} type="button" disabled={busy} onClick={() => void selectSlot(index)} className={`min-h-24 rounded-xl border p-3 text-center ${slot ? "border-accent bg-accentDim" : "border-dashed border-borderButton bg-cardAlt"}`}><strong className="block truncate text-textBright">{slot?.file.name || "+"}</strong><span className="mt-1 block text-xs text-textMuted">{t("match.videoNumber", { number: index + 1 })}</span>{slot && <span className="mt-1 block text-xs text-textSecondary">{slot.info.videoCodec.toUpperCase()}</span>}</button>)}
                  </div>
                </>
              ) : videoSource === "external" ? (
                <>
                  <p className="mt-1 text-xs text-textMuted">{t("match.recordingIdHelp")}</p>
                  <label className="mt-3 block text-sm text-textSecondary">{t("match.recordingId")}
                    <input type="text" inputMode="numeric" value={recordingId} onChange={(event) => setRecordingId(event.target.value)} placeholder="1391450" className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" />
                  </label>
                  <div className="mt-3">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-textMuted">{t("match.camerasUsed")}</span>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {EXTERNAL_RECORDING_CAMERAS.map((cameraNumber) => {
                        const checked = selectedCameras.includes(cameraNumber);
                        return <button key={cameraNumber} type="button" onClick={() => toggleCamera(cameraNumber)} className={`rounded-lg border py-2 text-center text-sm font-semibold ${checked ? "border-accent bg-accentDim text-textBright" : "border-borderButton bg-cardAlt text-textSecondary"}`}>{cameraNumber}</button>;
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-3">
                  <p className="text-xs text-textMuted">{t("match.veoLinkHelp")}</p>
                  <label className="mt-3 block text-sm text-textSecondary">{t("match.veoLink")}
                    <input type="url" value={veoUrl} onChange={(event) => setVeoUrl(event.target.value)} placeholder="https://app.veo.co/matches/..." className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" />
                  </label>
                </div>
              )}
            </section>

            {status && <div className="rounded-lg border border-border bg-cardDeep p-3 text-sm text-textSecondary">{status}</div>}
            {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
            <div className="flex gap-3"><button type="button" disabled={busy} onClick={() => setMode("recent")} className="flex-1 rounded-lg bg-button px-4 py-2 text-textPrimary">{t("match.back")}</button><button type="submit" disabled={busy || (videoSource === "file" ? !slots.some(Boolean) : videoSource === "external" ? !recordingId.trim() || !selectedCameras.length : !veoUrl.trim())} className="flex-1 rounded-lg bg-accent px-4 py-2 font-bold text-page disabled:opacity-50">{busy ? t("match.working") : t("match.createAction")}</button></div>
          </form>
        )}
      </div>
      <ConfirmDialog open={!!deleteTarget} title={t("match.deleteTitle")} message={t("match.deleteNamedMessage", { name: deleteTarget?.title ?? t("video.match") })} busy={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteMatch()} />
    </div>
  );
}
