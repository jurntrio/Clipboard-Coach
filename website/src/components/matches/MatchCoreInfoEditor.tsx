"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TeamOption = { id: string; name: string };
type MatchCore = {
  id: string; team_a_id: string | null; team_a_name: string; team_b_name: string;
  match_date: string | null; start_time: string | null; recording_start_time: string | null;
  status: "scheduled" | "live" | "finished"; score_a: number | null; score_b: number | null;
  is_home_match: boolean; player_ids: string[]; live_tag_names: string[];
};

export function MatchCoreInfoEditor({ match, teams, embedded = false }: { match: MatchCore; teams: TeamOption[]; embedded?: boolean }) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(match.team_a_id ?? "");
  const [teamName, setTeamName] = useState(match.team_a_name);
  const [opponent, setOpponent] = useState(match.team_b_name);
  const [date, setDate] = useState(match.match_date ?? "");
  const [time, setTime] = useState(match.start_time?.slice(0, 5) ?? "");
  const [recordingTime, setRecordingTime] = useState(match.recording_start_time?.slice(0, 8) ?? "");
  const [status, setStatus] = useState(match.status);
  const scoreA = match.score_a?.toString() ?? "";
  const scoreB = match.score_b?.toString() ?? "";
  const [isHome, setIsHome] = useState(match.is_home_match);
  const [notice, setNotice] = useState("");

  async function save() {
    setNotice("Bewaren…");
    const response = await fetch("/api/matches", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: match.id, team_a_id: teamId || null, team_a_name: teamName.trim(), team_b_name: opponent.trim(),
        match_date: date || null, start_time: time || null, recording_start_time: recordingTime || null,
        status, score_a: scoreA === "" ? null : Number(scoreA), score_b: scoreB === "" ? null : Number(scoreB),
        is_home_match: isHome, player_ids: match.player_ids, live_tag_names: match.live_tag_names
      })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return setNotice(body?.error || "Kon niet worden bewaard.");
    setNotice("Bewaard");
    router.refresh();
  }

  const content = <>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm text-textSecondary">Eigen ploeg<select value={teamId} onChange={event => {
        const id = event.target.value; setTeamId(id); const team = teams.find(item => item.id === id); if (team) setTeamName(team.name);
      }} className={inputClass}><option value="">Andere ploegnaam</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      {!teamId && <label className="text-sm text-textSecondary">Naam eigen ploeg<input value={teamName} onChange={event => setTeamName(event.target.value)} className={inputClass} /></label>}
      <label className="text-sm text-textSecondary">Tegenstander<input value={opponent} onChange={event => setOpponent(event.target.value)} className={inputClass} /></label>
      <label className="text-sm text-textSecondary">Datum<input type="date" value={date} onChange={event => setDate(event.target.value)} className={inputClass} /></label>
      <label className="text-sm text-textSecondary">Geplande aftrap<input type="time" value={time} onChange={event => setTime(event.target.value)} className={inputClass} /></label>
      <label className="text-sm text-textSecondary">Start van de opname<input type="time" step="1" value={recordingTime} onChange={event => setRecordingTime(event.target.value)} className={inputClass} /></label>
      <label className="text-sm text-textSecondary">Status<select value={status} onChange={event => setStatus(event.target.value as MatchCore["status"])} className={inputClass}><option value="scheduled">Gepland</option><option value="live">Live</option><option value="finished">Afgewerkt</option></select></label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm text-textPrimary"><input type="checkbox" checked={isHome} onChange={event => setIsHome(event.target.checked)} className="h-4 w-4 accent-accent" />Thuiswedstrijd</label>
    </div>
    <div className="mt-5 flex items-center gap-3"><button type="button" onClick={() => void save()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-page">Wedstrijdgegevens bewaren</button><span className="text-sm text-textMuted">{notice}</span></div>
  </>;

  if (embedded) return content;
  return <section className="rounded-2xl border border-accent bg-card p-5">
    <h2 className="mb-4 font-black text-textBright">Wedstrijdgegevens</h2>
    {content}
  </section>;
}

const inputClass = "mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-textPrimary";
