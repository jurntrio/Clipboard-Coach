"use client";

import { useEffect, useMemo, useState } from "react";

type Membership = { season_id: string; club_team_id: string; show_home_matches_commercially: boolean };
type Scope = { id: string; name: string; is_clubwide: boolean; active: boolean; sponsor_scope_teams: Membership[] };
type Season = { id: string; name: string; status: string };
type Team = { id: string; name: string; season_id: string; status: string };

export function SponsorScopeManager() {
  const [scopes, setScopes] = useState<Scope[]>([]); const [seasons, setSeasons] = useState<Season[]>([]); const [teams, setTeams] = useState<Team[]>([]);
  const [seasonId, setSeasonId] = useState(""); const [name, setName] = useState(""); const [clubwide, setClubwide] = useState(false);
  const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [canManage, setCanManage] = useState(false);
  async function load() { const response = await fetch("/api/club/sponsor-scopes", { cache: "no-store" }); const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Sponsorbereiken konden niet worden geladen.");
    setScopes(body.scopes ?? []); setSeasons(body.seasons ?? []); setTeams(body.teams ?? []); setCanManage(body.canManage === true);
    setSeasonId(current => current || body.seasons?.find((season: Season) => season.status === "ACTIVE")?.id || body.seasons?.[0]?.id || ""); }
  useEffect(() => { void load().catch(reason => setError(reason.message)); }, []);
  const selectedSeason = seasons.find(season => season.id === seasonId); const seasonTeams = useMemo(() => teams.filter(team => team.season_id === seasonId), [teams, seasonId]);
  async function action(payload: Record<string, unknown>, key: string) { setBusy(key); setError(""); try { const response = await fetch("/api/club/sponsor-scopes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || "Wijziging kon niet worden bewaard."); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Wijziging kon niet worden bewaard."); } finally { setBusy(""); } }
  function toggleTeam(scope: Scope, teamId: string, auto = false) { const memberships = scope.sponsor_scope_teams.filter(item => item.season_id === seasonId);
    const selected = new Set(memberships.map(item => item.club_team_id)); const autoIds = new Set(memberships.filter(item => item.show_home_matches_commercially).map(item => item.club_team_id));
    if (auto) {
      if (!selected.has(teamId)) selected.add(teamId);
      if (autoIds.has(teamId)) autoIds.delete(teamId); else autoIds.add(teamId);
    } else if (selected.has(teamId)) {
      selected.delete(teamId); autoIds.delete(teamId);
    } else selected.add(teamId);
    void action({ action: "setTeams", scopeId: scope.id, seasonId, teamIds: [...selected], autoCommercialTeamIds: [...autoIds] }, `teams:${scope.id}`); }
  return <section className="mb-6 rounded-2xl border border-border bg-card p-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Sponsorbereiken</p>
    <h2 className="mt-1 text-xl font-black text-textBright">Herbruikbare sponsorcontext</h2><p className="mt-1 text-sm text-textMuted">Configureer bijvoorbeeld Jeugd of Eerste ploeg één keer; teamkoppelingen blijven per seizoen bewaard.</p></div>
    {canManage && <form className="mt-4 flex flex-wrap gap-3 rounded-xl border border-borderSubtle bg-cardDeep p-4" onSubmit={event => { event.preventDefault(); void action({ action: "create", name, isClubwide: clubwide }, "create").then(() => { setName(""); setClubwide(false); }); }}>
      <input required value={name} onChange={event => setName(event.target.value)} placeholder="Naam Sponsorbereik" className={inputClass}/><label className="flex items-center gap-2 text-sm text-textSecondary"><input type="checkbox" checked={clubwide} onChange={event => setClubwide(event.target.checked)}/> Clubbreed</label>
      <button disabled={!!busy} className="rounded-lg bg-accent px-4 py-2 font-bold text-page disabled:opacity-50">Bereik toevoegen</button></form>}
    <div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm text-textSecondary">Seizoen <select value={seasonId} onChange={event => setSeasonId(event.target.value)} className={inputClass}>{seasons.map(season => <option key={season.id} value={season.id}>{season.name} · {season.status}</option>)}</select></label></div>
    <div className="mt-4 grid gap-3">{scopes.map(scope => <article key={scope.id} className="rounded-xl border border-borderSubtle bg-cardDeep p-4"><div className="flex items-center gap-2"><h3 className="font-bold text-textBright">{scope.name}</h3>{scope.is_clubwide && <span className="rounded-full border border-accent/30 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">Clubbreed</span>}</div>
      {scope.is_clubwide ? <p className="mt-2 text-xs text-textMuted">Automatisch geldig in alle relevante clubcontexten; geen teamselectie nodig.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{seasonTeams.map(team => { const member = scope.sponsor_scope_teams.find(item => item.season_id === seasonId && item.club_team_id === team.id); return <div key={team.id} className="rounded-lg border border-border bg-card p-3"><label className="flex items-center gap-2 text-sm text-textPrimary"><input type="checkbox" checked={!!member} disabled={!canManage || !!busy || selectedSeason?.status === "ARCHIVED"} onChange={() => toggleTeam(scope, team.id)}/>{team.name}</label>
        <label className="mt-2 flex items-center gap-2 text-xs text-textMuted"><input type="checkbox" checked={member?.show_home_matches_commercially === true} disabled={!canManage || !!busy || selectedSeason?.status === "ARCHIVED"} onChange={() => toggleTeam(scope, team.id, true)}/>Alle thuiswedstrijden automatisch in commercieel overzicht</label></div>; })}</div>}</article>)}</div>
    {!scopes.length && !error && <p className="mt-4 text-sm text-textMuted">Nog geen Sponsorbereiken ingesteld.</p>}{error && <p className="mt-3 text-sm text-red-300">{error}</p>}</section>;
}
const inputClass = "rounded-lg border border-borderButton bg-card px-3 py-2 text-sm text-textPrimary outline-none focus:border-accent";
