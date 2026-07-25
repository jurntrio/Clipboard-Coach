"use client";

import { useState } from "react";

type Team = { id: string; club_id: string; name: string; age_category: string | null; level_or_competition: string | null; status: string; club_trainer_teams?: { trainer_id: string; role: string; status: string }[] };
type Trainer = { id: string; profile_id: string | null; display_name: string };

const inputClass = "w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";

export function ClubTeamsManager({ clubId, teams, trainers, onChanged }: { clubId: string; teams: Team[]; trainers: Trainer[]; onChanged: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [level, setLevel] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function request(method: string, body: Record<string, unknown>) {
    setBusy(String(body.teamId ?? "create")); setError("");
    const response = await fetch("/api/club/teams", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    setBusy("");
    if (!response.ok) { setError(result.error || "Wijziging kon niet worden bewaard."); return false; }
    await onChanged();
    return true;
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (await request("POST", { clubId, name, ageCategory: age, levelOrCompetition: level })) {
      setName(""); setAge(""); setLevel("");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-xl font-semibold text-textBright">Teams</h2>
      <p className="mt-1 text-sm text-textMuted">Maak teams aan, keur aanvragen goed en beheer gebruikers per team.</p>
      <form onSubmit={create} className="mt-4 grid gap-3 rounded-xl border border-borderSubtle bg-cardDeep p-4 md:grid-cols-4">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Teamnaam" className={inputClass} />
        <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="Leeftijdscategorie" className={inputClass} />
        <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Niveau of reeks" className={inputClass} />
        <button disabled={busy === "create"} className="rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:opacity-50">{busy === "create" ? "Aanmaken…" : "Team aanmaken"}</button>
      </form>
      {error && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <div className="mt-4 space-y-3">
        {teams.map((team) => {
          const links = team.club_trainer_teams ?? [];
          return <details key={team.id} className="rounded-xl border border-borderSubtle bg-cardDeep p-4" open={team.status === "pending"}>
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><span className="font-semibold text-textPrimary">{team.name}</span><span className="ml-2 text-sm text-textMuted">{[team.age_category, team.level_or_competition].filter(Boolean).join(" · ")}</span></div>
                <span className={`rounded-full px-2 py-1 text-xs ${team.status === "active" ? "bg-green-500/15 text-green-300" : team.status === "pending" ? "bg-amber-500/15 text-amber-300" : "bg-slate-500/15 text-slate-300"}`}>{team.status}</span>
              </div>
            </summary>
            <TeamEditor team={team} teams={teams} trainers={trainers} links={links} busy={busy === team.id} request={request} />
          </details>;
        })}
        {!teams.length && <div className="rounded-xl border border-dashed border-border p-8 text-center text-textMuted">Deze club heeft nog geen teams.</div>}
      </div>
    </section>
  );
}

function TeamEditor({ team, teams, trainers, links, busy, request }: { team: Team; teams: Team[]; trainers: Trainer[]; links: NonNullable<Team["club_trainer_teams"]>; busy: boolean; request: (method: string, body: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState(team.name);
  const [age, setAge] = useState(team.age_category ?? "");
  const [level, setLevel] = useState(team.level_or_competition ?? "");
  const [mergeTarget, setMergeTarget] = useState("");
  return <div className="mt-4 space-y-4 border-t border-borderSubtle pt-4">
    <div className="grid gap-3 md:grid-cols-4">
      <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="Leeftijd" className={inputClass} />
      <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Niveau/reeks" className={inputClass} />
      <button disabled={busy || !name.trim()} onClick={() => void request("PATCH", { teamId: team.id, name, ageCategory: age, levelOrCompetition: level })} className="rounded-lg border border-borderButton px-3 py-2 text-sm text-textPrimary disabled:opacity-50">Opslaan</button>
    </div>
    <div className="flex flex-wrap gap-2">
      {team.status === "pending" && <button disabled={busy} onClick={() => void request("PATCH", { teamId: team.id, status: "active" })} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white">Bevestigen</button>}
      {team.status === "pending" && <button disabled={busy} onClick={() => void request("PATCH", { teamId: team.id, status: "rejected" })} className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300">Weigeren</button>}
      {team.status === "active" && <button disabled={busy} onClick={() => void request("PATCH", { teamId: team.id, status: "inactive" })} className="rounded-lg border border-borderButton px-3 py-2 text-sm text-textSecondary">Inactief maken</button>}
      {team.status === "inactive" && <button disabled={busy} onClick={() => void request("PATCH", { teamId: team.id, status: "active" })} className="rounded-lg border border-borderButton px-3 py-2 text-sm text-textPrimary">Activeren</button>}
    </div>
    <div>
      <h3 className="text-sm font-semibold text-textPrimary">Gebruikers</h3>
      <div className="mt-2 space-y-2">{trainers.map((trainer) => {
        const link = links.find((item) => item.trainer_id === trainer.id);
        return <div key={trainer.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-borderSubtle px-3 py-2">
          <span className="mr-auto text-sm text-textSecondary">{trainer.display_name}</span>
          <select value={link?.role ?? "coach"} disabled={!link || busy} onChange={(e) => void request("PUT", { teamId: team.id, profileId: trainer.profile_id, role: e.target.value })} className="rounded-lg border border-border bg-input px-2 py-1 text-sm">
            <option value="coach">Trainer</option><option value="assistant_coach">Assistent</option><option value="team_manager">Teammanager</option>
          </select>
          {link ? <button disabled={busy || !trainer.profile_id} onClick={() => void request("PUT", { teamId: team.id, profileId: trainer.profile_id, remove: true })} className="text-xs text-red-300">Verwijderen</button>
            : <button disabled={busy || !trainer.profile_id} onClick={() => void request("PUT", { teamId: team.id, profileId: trainer.profile_id, role: "coach" })} className="text-xs text-accent">Toewijzen</button>}
        </div>;
      })}</div>
    </div>
    <div className="flex flex-wrap gap-2 border-t border-borderSubtle pt-3">
      <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} className="min-w-52 rounded-lg border border-border bg-input px-3 py-2 text-sm"><option value="">Samenvoegen met…</option>{teams.filter((item) => item.id !== team.id && ["active", "pending"].includes(item.status)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <button disabled={busy || !mergeTarget} onClick={() => void request("PATCH", { teamId: team.id, action: "merge", targetTeamId: mergeTarget })} className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-300 disabled:opacity-50">Samenvoegen</button>
    </div>
  </div>;
}
