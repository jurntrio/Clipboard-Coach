"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { inspectLocalVideo, type LocalVideoInfo } from "@/lib/media/local-clips";
import { localVideoFingerprint, rememberLocalVideo } from "@/lib/local-video-store";
import type { Match, Team, Video } from "@/types/database";

type Mode = "recent" | "all" | "create";
type SelectedVideo = { file: File; handle: FileSystemFileHandle | null; info: LocalVideoInfo };
type RecentItem =
  | { kind: "match"; id: string; title: string; date: string; openedAt: string; count: number }
  | { kind: "video"; id: string; title: string; date: string; openedAt: string; count: 1 };

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

export function MatchLauncher() {
  const router = useRouter();
  const supabase = createClient();
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSlotRef = useRef(0);
  const [mode, setMode] = useState<Mode>("recent");
  const [matches, setMatches] = useState<(Match & { match_videos: { video_id: string }[] })[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [slots, setSlots] = useState<(SelectedVideo | null)[]>([null, null, null, null]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [teamAId, setTeamAId] = useState("");
  const [teamAName, setTeamAName] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [teamBName, setTeamBName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { void loadData(); }, []);

  async function loadData() {
    const [matchResult, videoResult, teamResult] = await Promise.all([
      supabase.from("matches").select("*, match_videos(video_id)").order("last_opened_at", { ascending: false }),
      supabase.from("videos").select("*").eq("status", "active").order("created_at", { ascending: false }),
      supabase.from("teams").select("*").order("name")
    ]);
    if (matchResult.error && matchResult.error.code !== "42P01") setError(matchResult.error.message);
    setMatches((matchResult.data as (Match & { match_videos: { video_id: string }[] })[] | null) ?? []);
    setVideos(videoResult.data ?? []);
    setTeams(teamResult.data ?? []);
  }

  const matchedVideoIds = new Set(matches.flatMap((match) => match.match_videos.map((item) => item.video_id)));
  const recentItems: RecentItem[] = [
    ...matches.map((match): RecentItem => ({
      kind: "match",
      id: match.id,
      title: `${match.team_a_name || "Team A"} – ${match.team_b_name || "Team B"}`,
      date: match.match_date || "No date",
      openedAt: match.last_opened_at,
      count: match.match_videos.length
    })),
    ...videos.filter((video) => !matchedVideoIds.has(video.id)).map((video): RecentItem => ({
      kind: "video",
      id: video.id,
      title: video.title || "Untitled video",
      date: new Date(video.created_at).toLocaleDateString(),
      openedAt: video.created_at,
      count: 1
    }))
  ].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

  async function openItem(item: RecentItem) {
    if (item.kind === "video") {
      router.push(`/dashboard/videos/${item.id}`);
      return;
    }
    await supabase.from("matches").update({ last_opened_at: new Date().toISOString() }).eq("id", item.id);
    router.push(`/dashboard/matches/${item.id}`);
  }

  async function acceptFile(index: number, file: File, handle: FileSystemFileHandle | null) {
    setBusy(true);
    setStatus(`Checking video ${index + 1}…`);
    setError("");
    try {
      const info = await inspectLocalVideo(file);
      setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? { file, handle, info } : slot));
    } catch (fileError) {
      setError(getErrorMessage(fileError, "This video could not be opened."));
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
        setError(getErrorMessage(pickerError, "This video could not be opened."));
      }
    }
  }

  function resetDraft() {
    setSlots([null, null, null, null]);
    setDate(new Date().toISOString().slice(0, 10));
    setStartTime("");
    setTeamAId("");
    setTeamAName("");
    setTeamBId("");
    setTeamBName("");
    setError("");
  }

  async function createMatch(event: React.FormEvent) {
    event.preventDefault();
    const selected = slots.filter((slot): slot is SelectedVideo => !!slot);
    if (!selected.length) return;
    setBusy(true);
    setError("");

    let createdMatchId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired. Sign in again.");
      setStatus("Creating match…");
      const selectedTeamA = teams.find((team) => team.id === teamAId);
      const selectedTeamB = teams.find((team) => team.id === teamBId);
      const { data: match, error: matchError } = await supabase.from("matches").insert({
        coach_id: user.id,
        team_a_id: teamAId || null,
        team_b_id: teamBId || null,
        team_a_name: selectedTeamA?.name || teamAName.trim() || "Team A",
        team_b_name: selectedTeamB?.name || teamBName.trim() || "Team B",
        match_date: date || null,
        start_time: startTime || null,
        last_opened_at: new Date().toISOString()
      }).select("id").single();
      if (matchError) throw matchError;
      createdMatchId = match.id;

      for (let index = 0; index < selected.length; index += 1) {
        const selection = selected[index];
        setStatus(`Saving video ${index + 1} of ${selected.length}…`);
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

      router.push(`/dashboard/matches/${match.id}`);
    } catch (createError) {
      if (createdMatchId) await supabase.from("matches").delete().eq("id", createdMatchId);
      setError(getErrorMessage(createError, "The match could not be created."));
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
      <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-borderButton bg-cardAlt p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Video Viewer">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div><h1 className="text-xl font-bold text-textBright">{mode === "create" ? "New match" : mode === "all" ? "Older matches" : "Video Viewer"}</h1><p className="text-sm text-textMuted mt-1">Matches and tags are saved; full local videos stay on this computer.</p></div>
          <button type="button" onClick={() => router.push("/dashboard")} className="px-3 py-2 rounded-lg bg-button text-textPrimary">Close</button>
        </div>

        {mode === "recent" && (
          <>
            <button type="button" onClick={() => { resetDraft(); setMode("create"); }} className="w-full rounded-xl bg-accent px-5 py-3 font-bold text-page">Create new match</button>
            <div className="mt-5 space-y-2">
              <h2 className="text-sm font-semibold text-textSecondary">Last matches</h2>
              {[0, 1, 2, 3].map((index) => {
                const item = recentItems[index];
                return item ? (
                  <button key={`${item.kind}-${item.id}`} type="button" onClick={() => void openItem(item)} className="w-full flex items-center justify-between gap-4 rounded-xl border border-border bg-cardDeep px-4 py-3 text-left hover:border-accent hover:bg-cardHover">
                    <span><strong className="block text-textPrimary">{item.title}</strong><span className="text-xs text-textMuted">{item.date} · {item.count} video{item.count === 1 ? "" : "s"}</span></span>
                    <span className="text-accent">Open</span>
                  </button>
                ) : <div key={index} className="rounded-xl border border-border bg-cardDeep px-4 py-3 text-sm text-textMuted">No recent match</div>;
              })}
            </div>
            <button type="button" onClick={() => setMode("all")} className="mt-4 w-full rounded-lg bg-button px-4 py-2 text-textPrimary">View older matches and videos</button>
          </>
        )}

        {mode === "all" && (
          <div className="space-y-2">
            {recentItems.map((item) => <button key={`${item.kind}-${item.id}`} type="button" onClick={() => void openItem(item)} className="w-full flex justify-between rounded-lg border border-border bg-cardDeep px-4 py-3 text-left text-textPrimary hover:border-accent"><span>{item.title}</span><span className="text-sm text-textMuted">{item.date}</span></button>)}
            {!recentItems.length && <p className="text-textMuted">No saved matches yet.</p>}
            <button type="button" onClick={() => setMode("recent")} className="mt-3 w-full rounded-lg bg-button px-4 py-2 text-textPrimary">Back</button>
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={createMatch} className="space-y-5">
            <section className="rounded-xl border border-border bg-cardDeep p-4">
              <h2 className="font-semibold text-textBright mb-3">Match information</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-textSecondary">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" /></label>
                <label className="text-sm text-textSecondary">Start time<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" /></label>
                <label className="text-sm text-textSecondary">Team A<select value={teamAId} onChange={(event) => { setTeamAId(event.target.value); setTeamAName(""); }} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary"><option value="">Enter a name</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>{!teamAId && <input value={teamAName} onChange={(event) => setTeamAName(event.target.value)} placeholder="Team A" className="mt-2 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" />}</label>
                <label className="text-sm text-textSecondary">Team B<select value={teamBId} onChange={(event) => { setTeamBId(event.target.value); setTeamBName(""); }} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary"><option value="">Enter a name</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>{!teamBId && <input value={teamBName} onChange={(event) => setTeamBName(event.target.value)} placeholder="Team B" className="mt-2 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" />}</label>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-cardDeep p-4">
              <div className="flex items-center justify-between"><div><h2 className="font-semibold text-textBright">Match videos</h2><p className="text-xs text-textMuted mt-1">They play automatically in this order.</p></div><button type="button" onClick={() => setSlots((current) => [...current, null])} className="rounded-lg bg-button px-3 py-2 text-sm text-textPrimary">Add more</button></div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {slots.map((slot, index) => <button key={index} type="button" disabled={busy} onClick={() => void selectSlot(index)} className={`min-h-24 rounded-xl border p-3 text-center ${slot ? "border-accent bg-accentDim" : "border-dashed border-borderButton bg-cardAlt"}`}><strong className="block truncate text-textBright">{slot?.file.name || "+"}</strong><span className="mt-1 block text-xs text-textMuted">Video {index + 1}</span>{slot && <span className="mt-1 block text-xs text-textSecondary">{slot.info.videoCodec.toUpperCase()}</span>}</button>)}
              </div>
            </section>

            {status && <div className="rounded-lg border border-border bg-cardDeep p-3 text-sm text-textSecondary">{status}</div>}
            {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
            <div className="flex gap-3"><button type="button" disabled={busy} onClick={() => setMode("recent")} className="flex-1 rounded-lg bg-button px-4 py-2 text-textPrimary">Back</button><button type="submit" disabled={busy || !slots.some(Boolean)} className="flex-1 rounded-lg bg-accent px-4 py-2 font-bold text-page disabled:opacity-50">{busy ? "Working…" : "Create match"}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
