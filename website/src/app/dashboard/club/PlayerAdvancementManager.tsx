"use client";

import { useEffect, useState } from "react";

type Team = { id: string; name: string; season_id: string; copied_from_team_id: string | null; teams: { id: string }[] };
type Player = { id: string; name: string; decision: "TEAM" | "UNDECIDED" | "LEAVING"; futureTeamName: string | null };
type Props = { sourceSeasonId: string; sourceSeasonName: string; targetSeasonId: string; targetSeasonName: string; onChanged: () => Promise<void> };

export function PlayerAdvancementManager(props: Props) {
  const [teams, setTeams] = useState<Team[]>([]); const [players, setPlayers] = useState<Player[]>([]); const [pathways, setPathways] = useState<{ source_team_id: string; target_team_id: string; priority: number }[]>([]);
  const [sourceTeamId, setSourceTeamId] = useState(""); const [filter, setFilter] = useState<"UNDECIDED" | "TEAM" | "ALL">("UNDECIDED");
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [destination, setDestination] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const sourceTeams = teams.filter(team => team.season_id === props.sourceSeasonId); const targetTeams = teams.filter(team => team.season_id === props.targetSeasonId);
  const source = sourceTeams.find(team => team.id === sourceTeamId); const operationalSourceId = source?.teams?.[0]?.id;
  async function load(selectedSource = sourceTeamId) {
    const sourceOperational = teams.find(team => team.id === selectedSource)?.teams?.[0]?.id ?? (selectedSource === sourceTeamId ? operationalSourceId : undefined);
    const query = new URLSearchParams({ sourceSeasonId: props.sourceSeasonId, targetSeasonId: props.targetSeasonId }); if (sourceOperational) query.set("sourceTeamId", sourceOperational);
    const response = await fetch(`/api/club/season-transition?${query}`); const body = await response.json(); if (!response.ok) throw new Error(body.error);
    setTeams(body.teams); setPlayers(body.players); setPathways(body.pathways); setSelected(new Set());
  }
  useEffect(() => { void load("").catch(reason => setError(reason.message)); }, [props.sourceSeasonId, props.targetSeasonId]);
  async function seedAndLoad(teamId: string) {
    setSourceTeamId(teamId); setBusy(true); setError("");
    const seed = await fetch("/api/club/season-transition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "seed", sourceSeasonId: props.sourceSeasonId, targetSeasonId: props.targetSeasonId }) });
    const seedBody = await seed.json(); if (!seed.ok) { setBusy(false); return setError(seedBody.error); }
    try { await load(teamId); } catch (reason) { setError(reason instanceof Error ? reason.message : "Spelers konden niet geladen worden."); } finally { setBusy(false); }
  }
  async function assign(decision: "TEAM" | "UNDECIDED" | "LEAVING", ids = Array.from(selected), targetTeamId = destination) {
    if (!ids.length || (decision === "TEAM" && !targetTeamId)) return; setBusy(true); setError("");
    const response = await fetch("/api/club/season-transition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetSeasonId: props.targetSeasonId, playerIds: ids, decision, targetTeamId }) });
    const body = await response.json(); if (!response.ok) { setBusy(false); return setError(body.error || "Toewijzing mislukt."); }
    await load(sourceTeamId); await props.onChanged(); setBusy(false);
  }
  const recommendedIds = new Set(pathways.filter(path => path.source_team_id === sourceTeamId).map(path => path.target_team_id));
  const copiedSuccessor = targetTeams.find(team => team.copied_from_team_id === sourceTeamId); if (copiedSuccessor) recommendedIds.add(copiedSuccessor.id);
  const recommended = targetTeams.filter(team => recommendedIds.has(team.id)); const others = targetTeams.filter(team => !recommendedIds.has(team.id));
  const visible = players.filter(player => filter === "ALL" || player.decision === filter); const assigned = players.filter(player => player.decision === "TEAM").length;
  const allVisibleSelected = visible.length > 0 && visible.every(player => selected.has(player.id));
  return <section className="rounded-xl border border-border bg-cardDeep p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-textBright">Spelers doorschuiven</h3><p className="text-xs text-textMuted">Van {props.sourceSeasonName} naar {props.targetSeasonName}</p></div>
      <select value={sourceTeamId} disabled={busy} onChange={event => void seedAndLoad(event.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary"><option value="">Selecteer huidig team</option>{sourceTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></div>
    {error && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    {sourceTeamId && <><div className="mt-4 flex flex-wrap items-center gap-2"><strong className="mr-auto text-sm text-textPrimary">{source?.name} — {players.length} spelers · {assigned} toegewezen · {players.length - assigned} nog te verdelen</strong>
      {(["ALL", "UNDECIDED", "TEAM"] as const).map(value => <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-1 text-xs ${filter === value ? "bg-accent text-page" : "border border-border text-textSecondary"}`}>{value === "ALL" ? "Alle" : value === "UNDECIDED" ? "Nog te verdelen" : "Toegewezen"}</button>)}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-borderSubtle bg-card p-3"><label className="flex items-center gap-2 text-xs text-textSecondary"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map(player => player.id)))} /> Selecteer zichtbare spelers</label>
        <select value={destination} onChange={event => setDestination(event.target.value)} className="min-w-48 rounded-lg border border-border bg-input px-3 py-2 text-xs text-textPrimary"><option value="">Toewijzen aan…</option>{recommended.length > 0 && <optgroup label="Aanbevolen">{recommended.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</optgroup>}<optgroup label="Andere teams">{others.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</optgroup></select>
        <button disabled={busy || !selected.size || !destination} onClick={() => void assign("TEAM")} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-page disabled:cursor-not-allowed disabled:opacity-40">Bulk toewijzen</button>
        <button disabled={busy || !selected.size} onClick={() => void assign("UNDECIDED")} className="rounded-lg border border-border px-3 py-2 text-xs text-textPrimary disabled:cursor-not-allowed disabled:opacity-40">Nog te bepalen</button>
        <button disabled={busy || !selected.size} onClick={() => void assign("LEAVING")} className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300 disabled:cursor-not-allowed disabled:opacity-40">Verlaat club</button></div>
      <div className="mt-3 max-h-[40rem] space-y-1 overflow-y-auto">{visible.map(player => <div key={player.id} className={`flex items-center gap-3 rounded-lg border border-border px-3 py-1.5 ${player.decision === "TEAM" ? "bg-card/50 opacity-60 italic" : "bg-card"}`}>
        <input type="checkbox" checked={selected.has(player.id)} onChange={() => setSelected(current => { const next = new Set(current); if (next.has(player.id)) next.delete(player.id); else next.add(player.id); return next; })} />
        <span className="flex min-w-0 flex-1 items-center gap-3"><strong className="min-w-0 flex-1 truncate text-sm text-textPrimary">{player.name}</strong><span className="w-32 shrink-0 truncate text-xs text-textMuted">{player.decision === "TEAM" ? `→ ${player.futureTeamName}` : player.decision === "LEAVING" ? "Verlaat club" : "Nog te bepalen"}</span></span>
        <select aria-label={`Volgend seizoen voor ${player.name}`} value="" disabled={busy} onChange={event => void assign("TEAM", [player.id], event.target.value)} className="max-w-48 rounded-lg border border-border bg-input px-2 py-1.5 text-xs text-textPrimary"><option value="">{player.decision === "TEAM" ? "Wijzig toewijzing…" : "Kies team…"}</option>{recommended.map(team => <option key={team.id} value={team.id}>★ {team.name}</option>)}{others.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
      </div>)}</div></>}
  </section>;
}
