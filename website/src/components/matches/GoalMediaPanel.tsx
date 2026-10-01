"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { goalMediaState, validateGoalRange, type GoalMedia, type ReportGoal } from "@/lib/goal-media";
import { formatTime } from "@/lib/utils";
import { parseClockTime } from "@/lib/clock-time";
import { remuxLocalSegment } from "@/lib/media/local-clips";
import { uploadBlobToR2 } from "@/lib/r2/browser-upload";
import { localMediaMessages } from "@/i18n/local-media";
import { useI18n } from "@/i18n/client";
import type { Tag } from "@/types/database";

type GoalTag = Pick<Tag, "id" | "video_id" | "name" | "start_time" | "end_time" | "event_type" | "event_metadata">;
export function GoalMediaPanel({ matchId, ownTeamIsHome, tags: viewerTags, files = {}, localVideoIds = [], onTimesSaved, focusTagId, reportGoal, refreshKey = 0 }: {
  matchId: string; ownTeamIsHome: boolean; tags?: Tag[]; files?: Record<string, File>; localVideoIds?: string[];
  onTimesSaved?: (tagId: string, start: number, end: number) => Promise<boolean | void>;
  focusTagId?: string | null; reportGoal?: ReportGoal; refreshKey?: number;
}) {
  const { t } = useI18n();
  const [goals, setGoals] = useState<ReportGoal[]>([]);
  const [media, setMedia] = useState<GoalMedia[]>([]);
  const [tags, setTags] = useState<GoalTag[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [tagId, setTagId] = useState("");
  const [goalId, setGoalId] = useState(reportGoal?.id ?? "");
  const [score, setScore] = useState("");
  const [team, setTeam] = useState<"home" | "away">("home");
  const [minute, setMinute] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState(!reportGoal);
  const selectedTag = tags.find(item => item.id === tagId);
  const selectedLink = media.find(item => item.tag_id === tagId);
  const selectedStart = selectedTag?.start_time;
  const selectedEnd = selectedTag?.end_time;
  const selectedEventType = selectedTag?.event_type;

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}/goal-media`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) { setNotice(body.error || "Doelpuntbeelden konden niet worden geladen."); return; }
      setGoals(body.goals); setMedia(body.media); setTags(body.tags); setCanEdit(body.canEdit);
    } catch { setNotice("Doelpuntbeelden konden niet worden geladen. Controleer je verbinding."); }
  }, [matchId]);
  useEffect(() => { void load(); }, [load, viewerTags, refreshKey]);
  useEffect(() => {
    const interval = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(interval);
  }, [load]);
  useEffect(() => { if (focusTagId) { setTagId(focusTagId); setExpanded(true); document.getElementById("doelpuntbeelden")?.scrollIntoView({ block: "nearest", behavior: "smooth" }); } }, [focusTagId]);
  useEffect(() => { setGoalId(reportGoal?.id ?? selectedLink?.goal_id ?? ""); }, [tagId, reportGoal?.id, selectedLink?.goal_id]);
  useEffect(() => {
    if (selectedStart == null || selectedEnd == null) return;
    setStart(formatTime(selectedStart)); setEnd(formatTime(selectedEnd));
  }, [tagId, selectedStart, selectedEnd]);
  useEffect(() => {
    const ownSide = ownTeamIsHome ? "home" : "away";
    setTeam(selectedEventType === "goal_against" ? (ownSide === "home" ? "away" : "home") : ownSide);
  }, [tagId, selectedEventType, ownTeamIsHome]);
  const displayedMedia = reportGoal ? media.filter(item => item.goal_id === reportGoal.id) : media;

  async function save(saveClip: boolean) {
    if (!selectedTag) return;
    setBusy(true); setNotice("");
    let clipId: string | null = null;
    try {
      if (reportGoal && !goals.some(goal => goal.id === reportGoal.id && goal.scoreAfter === reportGoal.scoreAfter)) throw new Error("Bewaar eerst het wedstrijdverslag, zodat het doelpunt kan worden gekoppeld.");
      const startTime = parseClockTime(start); const endTime = parseClockTime(end);
      if (saveClip) {
        validateGoalRange(startTime, endTime);
        if (localVideoIds.includes(selectedTag.video_id) && !files[selectedTag.video_id]) throw new Error("Koppel eerst het oorspronkelijke lokale videobestand opnieuw.");
        if (startTime !== selectedTag.start_time || endTime !== selectedTag.end_time) {
          if (!onTimesSaved) throw new Error("Pas de tagtijden eerst aan in de videoviewer.");
          const saved = await onTimesSaved(selectedTag.id, startTime!, endTime!);
          if (saved === false) throw new Error("De tagtijden konden niet worden opgeslagen.");
        }
      }
      const metadata = selectedTag.event_metadata as { scorer_id?: string; assist_id?: string } | null;
      const response = await fetch(`/api/matches/${matchId}/goal-media`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId, goalId: goalId || undefined, scoreAfter: score, team, minute: minute === "" ? null : Number(minute),
          scorerId: metadata?.scorer_id, assistId: metadata?.assist_id, saveClip, startTime, endTime }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      clipId = body.clipId;
      if (saveClip && clipId) {
        const supabase = createClient();
        const { data: clip, error: clipError } = await supabase.from("clips").select("render_status,coach_id").eq("id", clipId).single();
        if (clipError || !clip) throw new Error("De bewaarde clip kon niet worden geladen.");
        if (clip?.render_status !== "ready") {
          const { data: { user } } = await supabase.auth.getUser();
          if (clip.coach_id !== user?.id) throw new Error("Deze clip wordt al bewaard door een andere trainer. Wacht tot de verwerking klaar is.");
          const file = files[selectedTag.video_id];
          if (file && body.segmentId) {
            const { data: segment } = await supabase.from("clip_segments").select("rendered_segment").eq("id", body.segmentId).single();
            if (!segment?.rendered_segment) {
              setNotice("Fragment wordt gemaakt en geüpload…");
              const rendered = await remuxLocalSegment(file, startTime!, endTime!, () => undefined, localMediaMessages(t));
              try {
                const key = `clips/${clip.coach_id}/${clipId}/${crypto.randomUUID()}.mp4`;
                const url = await uploadBlobToR2(rendered.file, key, "video/mp4", () => undefined);
                const renderedSegment = { id: crypto.randomUUID(), clip_segment_id: body.segmentId, sequence_order: 0, url, key,
                  name: selectedTag.name, color: "#22c55e", duration: endTime! - rendered.actualStart,
                  play_start: startTime! - rendered.actualStart, source_start: startTime, source_end: endTime, file_size: rendered.file.size };
                const checkpoint = await supabase.from("clip_segments").update({ rendered_segment: renderedSegment, render_status: "pending" }).eq("id", body.segmentId);
                if (checkpoint.error) throw checkpoint.error;
              } finally { await rendered.cleanup(); }
            }
          }
          const process = await fetch(`/api/clips/${clipId}/process`, { method: "POST" });
          const result = await process.json();
          if (!process.ok) throw new Error(result.error || "Clipverwerking kon niet starten.");
        }
      }
      setNotice(saveClip ? "Fragment bevestigd. De clip blijft bewaard zodra ‘Clip bewaard’ verschijnt." : "Doelpunt gekoppeld. Bevestig de cliptijden in de videoviewer om het fragment te bewaren.");
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bewaren mislukt.";
      if (clipId) await createClient().from("clips").update({ render_status: "failed", render_error: message }).eq("id", clipId).neq("render_status", "ready");
      setNotice(message);
      await load();
    } finally { setBusy(false); }
  }

  return <section id={reportGoal ? undefined : "doelpuntbeelden"} className="my-3 rounded-xl border border-border bg-cardDeep p-3">
    <div className="flex items-center justify-between gap-2"><strong className="text-sm text-textBright">Doelpuntbeelden</strong>{canEdit && <button type="button" onClick={() => setExpanded(value => !value)} className="text-xs font-bold text-accent">{expanded ? "Sluiten" : "Tag koppelen"}</button>}</div>
    <div className="mt-2 space-y-2">{displayedMedia.map(item => {
      const goal = goals.find(goal => goal.id === item.goal_id);
      const tag = tags.find(tag => tag.id === item.tag_id);
      const ready = item.clips?.render_status === "ready" && !!item.clips.rendered_segments?.length;
      return <div key={item.id} className="flex flex-wrap items-center gap-2 text-xs text-textSecondary"><strong>{goal?.scoreAfter || "Doelpunt"}</strong><span>{goalMediaState(item, tag)}</span>
        {ready ? <Link href={`/dashboard/intradesk/clips/${item.clip_id}`} className="font-bold text-accent">▶ Bekijk doelpunt</Link>
          : item.tag_id && <Link href={`/dashboard/matches/${matchId}?tag=${item.tag_id}#doelpuntbeelden`} className="font-bold text-accent">Open tag in videoviewer</Link>}
        {item.clips?.render_status === "failed" && <span className="text-red-400">{item.clips.render_error}</span>}
      </div>;
    })}{!displayedMedia.length && <p className="text-xs text-textMuted">Nog geen vide tag gekoppeld.</p>}</div>
    {expanded && canEdit && <div className="mt-3 space-y-3 border-t border-border pt-3">
      <label className="block text-xs text-textSecondary">Doelpunttag<select disabled={busy} value={tagId} onChange={event => setTagId(event.target.value)} className={input}><option value="">Kies een tag</option>{tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name} · {formatTime(tag.start_time)}</option>)}</select></label>
      {!reportGoal && <label className="block text-xs text-textSecondary">Doelpunt in het verslag<select disabled={busy} value={goalId} onChange={event => setGoalId(event.target.value)} className={input}><option value="">Nieuw doelpunt</option>{goals.filter(goal => goal.scoreAfter).map(goal => <option key={goal.id} value={goal.id}>{goal.scoreAfter}{goal.minute != null ? ` · ${goal.minute}'` : ""}</option>)}</select></label>}
      {!goalId && <div className="grid grid-cols-2 gap-2"><label className="text-xs text-textSecondary">Stand na doelpunt<input placeholder="1-0" value={score} onChange={event => setScore(event.target.value)} className={input} /></label><label className="text-xs text-textSecondary">Wedstrijdminuut<input type="number" min={0} max={120} value={minute} onChange={event => setMinute(event.target.value)} className={input} /></label><label className="text-xs text-textSecondary">Scorende ploeg<select value={team} onChange={event => setTeam(event.target.value as "home" | "away")} className={input}><option value="home">Thuisploeg</option><option value="away">Uitploeg</option></select></label></div>}
      {onTimesSaved && selectedTag && <div className="grid grid-cols-2 gap-2"><label className="text-xs text-textSecondary">Begin clip<input disabled={busy} value={start} onChange={event => setStart(event.target.value)} className={input} /></label><label className="text-xs text-textSecondary">Einde clip<input disabled={busy} value={end} onChange={event => setEnd(event.target.value)} className={input} /></label></div>}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !tagId} onClick={() => void save(false)} className="rounded-lg border border-borderButton px-3 py-2 text-xs font-bold text-textPrimary disabled:opacity-40">Tag koppelen</button>{onTimesSaved && <button type="button" disabled={busy || !tagId} onClick={() => void save(true)} className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-page disabled:opacity-40">{busy ? "Bezig…" : "Tijden bevestigen en clip bewaren"}</button>}</div>
      {onTimesSaved && <p className="text-xs text-textMuted">De oorspronkelijke opname moet beschikbaar blijven tot ‘Clip bewaard’ verschijnt. Daarna opent het verslag het fragment uit onze eigen opslag.</p>}
      {!onTimesSaved && <><p className="text-xs text-textMuted">Bewaar eerst wijzigingen aan het verslag. Koppel daarna de tag aan het opgeslagen doelpunt.</p><Link href={`/dashboard/matches/${matchId}${tagId ? `?tag=${tagId}` : ""}#doelpuntbeelden`} className="block text-xs font-bold text-accent">Cliptijden controleren en bewaren in videoviewer →</Link></>}
    </div>}
    {notice && <p role="status" className="mt-2 text-xs text-textSecondary">{notice}</p>}
  </section>;
}
const input = "mt-1 block w-full rounded-lg border border-border bg-input px-2 py-2 text-sm text-textPrimary";
