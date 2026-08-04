"use client";

import { FormEvent, useEffect, useState } from "react";
import { PlayerAdvancementManager } from "./PlayerAdvancementManager";
import { SeasonResourcesManager } from "./SeasonResourcesManager";
import { SeasonArchive } from "./SeasonArchive";
import { SeasonScheduleManager } from "./SeasonScheduleManager";

type Check = { level: "ERROR" | "WARNING"; code: string; message: string };
type Season = { id: string; name: string; starts_on: string; ends_on: string; status: "PREPARATION" | "ACTIVE" | "ARCHIVED";
  trainers_visible_from: string | null; teams: { id: string; name: string }[];
  metrics: { teams: number; assigned: number; undecided: number; leaving: number; staffedTeams: number } };

export function SeasonManager() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [name, setName] = useState(""); const [startsOn, setStartsOn] = useState(""); const [endsOn, setEndsOn] = useState("");
  const [checks, setChecks] = useState<Record<string, Check[]>>({}); const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  const [advancementSeasonId, setAdvancementSeasonId] = useState(""); const [resourcesSeasonId, setResourcesSeasonId] = useState("");
  const [archiveSeasonId, setArchiveSeasonId] = useState(""); const [scheduleSeasonId, setScheduleSeasonId] = useState("");
  const [teamDrafts, setTeamDrafts] = useState<Record<string, string>>({});
  const [editingTeamId, setEditingTeamId] = useState(""); const [editingTeamName, setEditingTeamName] = useState("");

  async function load() { const response = await fetch("/api/club/seasons"); const body = await response.json(); if (!response.ok) throw new Error(body.error); setSeasons(body.seasons); }
  useEffect(() => { void load().catch(reason => setError(reason.message)); }, []);
  async function action(actionName: string, payload: Record<string, unknown>) {
    setBusy(`${actionName}:${payload.seasonId ?? "new"}`); setError("");
    const response = await fetch("/api/club/seasons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, ...payload }) });
    const body = await response.json(); setBusy(""); if (!response.ok) { setError(body.error || "Actie mislukt."); return false; }
    if (actionName === "preflight") setChecks(current => ({ ...current, [payload.seasonId as string]: body.checks }));
    await load(); return true;
  }
  const active = seasons.find(season => season.status === "ACTIVE");

  async function createSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await action("prepare", { name, startsOn, endsOn, sourceSeasonId: null, copyGroups: false })) { setName(""); setStartsOn(""); setEndsOn(""); }
  }
  async function addTeam(event: FormEvent<HTMLFormElement>, seasonId: string) {
    event.preventDefault(); const teamName = teamDrafts[seasonId]?.trim(); if (!teamName) return;
    if (await action("addTeam", { seasonId, name: teamName })) setTeamDrafts(current => ({ ...current, [seasonId]: "" }));
  }

  return <div className="space-y-5">
    <div><h2 className="text-xl font-semibold text-textBright">Seizoenen</h2><p className="mt-1 text-sm text-textMuted">Maak eerst het seizoen en stel daarna de teams voor dat nieuwe seizoen samen.</p></div>
    {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="grid gap-3 lg:grid-cols-2">{seasons.map(season => <article key={season.id} className="rounded-xl border border-border bg-cardDeep p-4">
      <div className="flex items-start justify-between gap-3"><div><strong className="text-textBright">{season.name}</strong><p className="text-xs text-textMuted">{season.starts_on} → {season.ends_on}</p></div>
        <span className={`rounded-full px-2.5 py-1 text-xs ${season.status === "ACTIVE" ? "bg-green-500/15 text-green-300" : season.status === "PREPARATION" ? "bg-amber-500/15 text-amber-300" : "bg-slate-500/15 text-textMuted"}`}>{season.status === "ACTIVE" ? "Actief" : season.status === "PREPARATION" ? "In voorbereiding" : "Archief"}</span></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-textSecondary"><span>Teams: {season.metrics.teams}</span><span>Staf: {season.metrics.staffedTeams}/{season.metrics.teams}</span><span>Toegewezen: {season.metrics.assigned}</span><span>Nog te verdelen: {season.metrics.undecided}</span></div>
      {checks[season.id]?.map(check => <p key={check.code} className={`mt-2 text-xs ${check.level === "ERROR" ? "text-red-300" : "text-amber-300"}`}>{check.level === "ERROR" ? "✕" : "⚠"} {check.message}</p>)}
      {season.status === "PREPARATION" && <div className="mt-4 rounded-lg border border-borderSubtle bg-input/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-textBright">Teams voor {season.name}</strong>{active && active.id !== season.id && <button onClick={() => void action("copyTeams", { seasonId: season.id, sourceSeasonId: active.id })} disabled={!!busy} className="rounded-lg border border-border px-3 py-1.5 text-xs text-textPrimary disabled:opacity-50">Alle teamnamen kopiëren</button>}</div>
        <div className="mt-2 space-y-1.5">{season.teams.length === 0 ? <p className="text-xs text-textMuted">Nog geen teams. Kopieer de huidige teamnamen of voeg een team toe.</p> : season.teams.map(team => <div key={team.id} className="flex items-center justify-between gap-2 rounded-md border border-borderSubtle px-2.5 py-1.5 text-sm text-textPrimary">{editingTeamId === team.id ? <form className="flex min-w-0 flex-1 gap-2" onSubmit={event => { event.preventDefault(); void action("renameTeam", { seasonId: season.id, teamId: team.id, name: editingTeamName }).then(saved => { if (saved) setEditingTeamId(""); }); }}><input required autoFocus value={editingTeamName} onChange={event => setEditingTeamName(event.target.value)} className="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-sm"/><button disabled={!!busy} className="text-xs text-accent">Opslaan</button><button type="button" onClick={() => setEditingTeamId("")} className="text-xs text-textMuted">Annuleren</button></form> : <><span className="min-w-0 flex-1 truncate">{team.name}</span><div className="flex gap-3"><button onClick={() => { setEditingTeamId(team.id); setEditingTeamName(team.name); }} disabled={!!busy} className="text-xs text-textSecondary disabled:opacity-50">Bewerken</button><button onClick={() => { if (window.confirm(`${team.name} verwijderen uit ${season.name}?`)) void action("deleteTeam", { seasonId: season.id, teamId: team.id }); }} disabled={!!busy} className="text-xs text-red-300 disabled:opacity-50">Wissen</button></div></>}</div>)}</div>
        <form className="mt-2 flex gap-2" onSubmit={event => void addTeam(event, season.id)}><input required value={teamDrafts[season.id] ?? ""} onChange={event => setTeamDrafts(current => ({ ...current, [season.id]: event.target.value }))} placeholder="Nieuwe teamnaam" className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary"/><button disabled={!!busy} className="rounded-lg border border-border px-3 py-2 text-xs text-textPrimary disabled:opacity-50">Team toevoegen</button></form>
      </div>}
      {season.status === "PREPARATION" && <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void action("preflight", { seasonId: season.id })} disabled={!!busy} className="rounded-lg border border-border px-3 py-2 text-xs text-textPrimary disabled:opacity-50">Controle uitvoeren</button>
        <button onClick={() => setAdvancementSeasonId(current => current === season.id ? "" : season.id)} disabled={!!busy} className="rounded-lg border border-border px-3 py-2 text-xs text-textPrimary disabled:opacity-50">Spelers doorschuiven</button>
        <button onClick={() => setResourcesSeasonId(current => current === season.id ? "" : season.id)} disabled={!!busy} className="rounded-lg border border-border px-3 py-2 text-xs text-textPrimary disabled:opacity-50">Staf & Extra groepen</button>
        <button onClick={() => setScheduleSeasonId(current => current === season.id ? "" : season.id)} disabled={!!busy} className="rounded-lg border border-border px-3 py-2 text-xs text-textPrimary disabled:opacity-50">Livegang plannen</button>
        <button onClick={() => { if (window.confirm(`${season.name} activeren? Het huidige seizoen wordt read-only archief.`)) void action("activate", { seasonId: season.id }); }} disabled={!!busy} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-page disabled:opacity-50">Nu activeren</button>
        <button onClick={() => { if (window.confirm(`De volledige seizoensovergang ${season.name} wissen? Alle voorbereide teams en toewijzingen verdwijnen.`)) { setAdvancementSeasonId(""); setResourcesSeasonId(""); setScheduleSeasonId(""); void action("delete", { seasonId: season.id }); } }} disabled={!!busy} className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-300 disabled:opacity-50">Overgang wissen</button></div>}
      {season.status === "ARCHIVED" && <button onClick={() => setArchiveSeasonId(current => current === season.id ? "" : season.id)} className="mt-4 rounded-lg border border-border px-3 py-2 text-xs text-textPrimary">Archief bekijken</button>}
    </article>)}</div>
    {active && advancementSeasonId && <PlayerAdvancementManager sourceSeasonId={active.id} sourceSeasonName={active.name} targetSeasonId={advancementSeasonId} targetSeasonName={seasons.find(season => season.id === advancementSeasonId)?.name ?? ""} onChanged={load} />}
    {resourcesSeasonId && <SeasonResourcesManager seasonId={resourcesSeasonId} seasonName={seasons.find(season => season.id === resourcesSeasonId)?.name ?? ""} onChanged={load} />}
    {archiveSeasonId && <SeasonArchive seasonId={archiveSeasonId} />}
    {scheduleSeasonId && <SeasonScheduleManager seasonId={scheduleSeasonId} seasonName={seasons.find(season => season.id === scheduleSeasonId)?.name ?? ""} onChanged={load}/>} 
    <form className="rounded-xl border border-border bg-cardDeep p-4" onSubmit={createSeason}>
      <h3 className="font-semibold text-textBright">Nieuw seizoen aanmaken</h3><p className="mt-1 text-xs text-textMuted">Het seizoen start leeg. Daarna bepaal je eerst de nieuwe teams en kun je alle huidige teamnamen kopiëren.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-xs text-textMuted">Naam<input required value={name} onChange={e => setName(e.target.value)} placeholder="2027-2028 of 2027" className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" /></label>
        <label className="text-xs text-textMuted">Begindatum<input required type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" /></label>
        <label className="text-xs text-textMuted">Einddatum<input required type="date" value={endsOn} onChange={e => setEndsOn(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" /></label></div>
      <button disabled={!!busy} className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page disabled:opacity-50">Seizoen aanmaken</button>
    </form>
  </div>;
}
