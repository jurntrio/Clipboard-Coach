"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ClubTeamsManager } from "./ClubTeamsManager";

type Club = { id: string; name: string; rbfa_registration_number: string | null };
type Team = {
  id: string;
  club_id: string;
  name: string;
  status: string;
  trainers_can_edit_roster: boolean;
  club_trainer_teams?: { trainer_id: string; role: string; status: string }[];
  teams?: { id: string; players: { id: string; first_name: string; last_name: string; date_of_birth: string | null; email: string | null; phone_numbers: string[]; role: "player" | "staff" }[] }[];
};
type Trainer = { id: string; club_id: string; profile_id: string | null; display_name: string; phone_number: string | null; invitation_status: string; profiles: { email: string } | null; club_trainer_teams: { club_team_id: string }[] };
type Membership = { club_id: string; profile_id: string; role: "trainer" | "club_admin" | "club_admin_viewer" | "analyst" };
type Match = { id: string; club_id: string; club_team_id: string | null; team_a_name: string; team_b_name: string; match_date: string | null; start_time: string | null; status: string; score_a: number | null; score_b: number | null; external_source: string | null };
type Assignment = { id: string; match_id: string; trainer_id: string; visible: boolean; assignment_source: string };
type MigrationIssue = { id: string; clubId: string; clubPlayerId: string; playerName: string; seasonId: string | null; candidates: { teamId: string; teamName: string; membershipType: string }[] };
type Overview = { clubs: Club[]; teams: Team[]; trainers: Trainer[]; matches: Match[]; assignments: Assignment[]; memberships: Membership[]; migrationIssues: MigrationIssue[] };

const roleLabels: Record<Membership["role"], string> = { club_admin: "Club Admin", club_admin_viewer: "Club Admin (viewer)", analyst: "Analyst", trainer: "Trainer" };
const roleBadgeClass: Record<Membership["role"], string> = { club_admin: "bg-blue-500/15 text-blue-300", club_admin_viewer: "bg-blue-500/10 text-blue-200", analyst: "bg-cyan-500/15 text-cyan-300", trainer: "bg-accent/15 text-accent" };

export function ClubDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const supabase = createClient();

  async function load() {
    await fetch("/api/club/overview").then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Clubgegevens konden niet geladen worden.");
      setData(body);
      setSelectedClubId((current) => current || body.clubs?.[0]?.id || "");
    }).catch((reason) => setError(reason.message));
  }

  useEffect(() => {
    void load();
    void supabase.auth.getUser().then(({ data: authData }) => setCurrentUserId(authData.user?.id ?? ""));
  }, []);

  const club = data?.clubs.find((item) => item.id === selectedClubId);
  const teams = useMemo(() => data?.teams.filter((item) => item.club_id === selectedClubId) ?? [], [data, selectedClubId]);
  const trainers = useMemo(() => data?.trainers.filter((item) => item.club_id === selectedClubId) ?? [], [data, selectedClubId]);
  const migrationIssues = useMemo(() => data?.migrationIssues.filter((item) => item.clubId === selectedClubId) ?? [], [data, selectedClubId]);
  const matches = useMemo(() => data?.matches.filter((item) => item.club_id === selectedClubId) ?? [], [data, selectedClubId]);
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const myMembership = data?.memberships.find((item) => item.club_id === selectedClubId && item.profile_id === currentUserId);
  const readOnly = myMembership?.role === "club_admin_viewer";

  function isAssigned(match: Match, trainer: Trainer) {
    const explicit = data?.assignments.find((item) => item.match_id === match.id && item.trainer_id === trainer.id);
    if (explicit) return explicit.visible;
    return !!match.club_team_id && trainer.club_trainer_teams.some((item) => item.club_team_id === match.club_team_id);
  }

  async function toggle(match: Match, trainer: Trainer) {
    const key = `${match.id}:${trainer.id}`;
    const visible = !isAssigned(match, trainer);
    setSaving(key);
    const response = await fetch("/api/club/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: match.id, trainerId: trainer.id, visible })
    });
    const body = await response.json();
    setSaving("");
    if (!response.ok) return setError(body.error || "Toewijzing kon niet worden bewaard.");
    setData((current) => current ? {
      ...current,
      assignments: [...current.assignments.filter((item) => !(item.match_id === match.id && item.trainer_id === trainer.id)), body.assignment]
    } : current);
  }

  if (error) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>;
  if (!data) return <div className="text-textMuted">Clubgegevens laden…</div>;
  if (!data.clubs.length) return <div className="text-textMuted">Je bent nog niet aan een club gekoppeld.</div>;

  return (
    <div className="space-y-6">
      {data.clubs.length > 1 && (
        <select value={selectedClubId} onChange={(event) => setSelectedClubId(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2">
          {data.clubs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-semibold text-textBright">{club?.name}</h2><p className="text-sm text-textMuted">Clubtrainers en hun standaardploegen</p></div>
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">
            RBFA {club?.rbfa_registration_number ? `stamnummer ${club.rbfa_registration_number}` : "nog te configureren"}
          </span>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-borderSubtle">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-cardDeep text-xs uppercase text-textMuted"><tr><th className="px-3 py-3 text-left">Naam</th><th className="px-3 py-3 text-left">Team(s)</th><th className="px-3 py-3 text-left">Gsm</th><th className="px-3 py-3 text-left">E-mail</th><th className="px-3 py-3 text-left">Rol</th></tr></thead>
            <tbody>{trainers.map((trainer) => {
              const membership = data.memberships.find((item) => item.club_id === trainer.club_id && item.profile_id === trainer.profile_id);
              const role = membership?.role ?? "trainer";
              return <tr key={trainer.id} className="border-t border-borderSubtle bg-card"><td className="px-3 py-3 font-medium text-textPrimary">{trainer.display_name}{trainer.invitation_status !== "linked" && <span className="ml-2 text-xs text-amber-300">Nog te koppelen</span>}</td><td className="px-3 py-3 text-textSecondary">{trainer.club_trainer_teams.map((link) => teamNames.get(link.club_team_id)).filter(Boolean).join(", ") || "—"}</td><td className="px-3 py-3 text-textSecondary">{trainer.phone_number || "—"}</td><td className="px-3 py-3 text-textSecondary">{trainer.profiles?.email || "—"}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${roleBadgeClass[role]}`}>{roleLabels[role]}</span></td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>

      <ClubTeamsManager clubId={selectedClubId} teams={teams} trainers={trainers} migrationIssues={migrationIssues} onChanged={load} readOnly={readOnly} />

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold text-textBright">Wedstrijden toewijzen</h2>
        <p className="mt-1 text-sm text-textMuted">De ploegtoewijzing wordt automatisch aangevinkt. Elke wijziging hieronder is een handmatige override.</p>
        {matches.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-max min-w-full table-fixed text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-textMuted">
                  <th className="sticky left-0 z-20 w-[260px] min-w-[260px] bg-card px-3 py-3">Wedstrijd</th>
                  <th className="sticky left-[260px] z-20 w-[120px] min-w-[120px] bg-card px-3 py-3">Ploeg</th>
                  {trainers.map((trainer) => (
                    <th key={trainer.id} className="h-32 w-11 min-w-11 align-bottom">
                      <div className="relative h-full w-full">
                        <span
                          className="absolute bottom-2 left-5 block w-36 origin-bottom-left whitespace-nowrap text-left text-[11px] normal-case"
                          style={{ transform: "rotate(-45deg)" }}
                          title={trainer.display_name}
                        >
                          {trainer.display_name}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{matches.map((match) => (
                <tr key={match.id} className="border-t border-borderSubtle">
                  <td className="sticky left-0 z-10 bg-card px-3 py-3"><div className="font-medium text-textPrimary">{match.team_a_name} – {match.team_b_name}</div><div className="text-xs text-textMuted">{match.match_date || "Datum onbekend"} {match.start_time?.slice(0, 5) || ""}{match.external_source ? ` · ${match.external_source.toUpperCase()}` : ""}</div></td>
                  <td className="sticky left-[260px] z-10 bg-card px-3 py-3 text-textSecondary">{match.club_team_id ? teamNames.get(match.club_team_id) || "–" : "Nog te koppelen"}</td>
                  {trainers.map((trainer) => {
                    const key = `${match.id}:${trainer.id}`;
                    return <td key={trainer.id} className="w-11 min-w-11 px-1 py-3 text-center"><input aria-label={`${trainer.display_name} toegang tot ${match.team_a_name} - ${match.team_b_name}`} type="checkbox" checked={isAssigned(match, trainer)} disabled={saving === key || readOnly} onChange={() => void toggle(match, trainer)} className="h-5 w-5 accent-accent disabled:opacity-60" /></td>;
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-textMuted">Nog geen clubwedstrijden gekoppeld. De structuur staat klaar voor RBFA-import en handmatig gekoppelde wedstrijden.</div>}
      </section>
    </div>
  );
}
