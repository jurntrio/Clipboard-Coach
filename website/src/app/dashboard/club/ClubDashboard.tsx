"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ClubTeamsManager } from "./ClubTeamsManager";
import { ClubLogoUploader } from "@/components/clubs/ClubLogoUploader";
import { ClubSponsorManager } from "@/components/clubs/ClubSponsorManager";
import { useActiveClub } from "@/components/clubs/ActiveClubProvider";
import { ClubMemberAccessManager } from "./ClubMemberAccessManager";
import { ClubInvitationCreator } from "./ClubInvitationCreator";
import { ClubPeopleManager } from "./ClubPeopleManager";
import { ClubMatchOptionsManager, type ClubMatchOption } from "@/components/clubs/ClubMatchOptionsManager";
import { ClubMatchCsvImporter } from "./ClubMatchCsvImporter";

type Club = { id: string; name: string; rbfa_registration_number: string | null; clip_advertising_enabled: boolean; clip_view_count_roles?: string[]; logo_url?: string | null; general_sponsor_url?: string | null; use_general_sponsor?: boolean };
type Team = {
  id: string;
  club_id: string;
  name: string;
  status: string;
  sponsor_url?: string | null;
  sponsor_enabled?: boolean;
  sponsor_source?: "team" | "club" | "none";
  trainers_can_edit_roster: boolean;
  trainers_can_manage_matches: boolean;
  club_trainer_teams?: { trainer_id: string; role: string; status: string }[];
  teams?: { id: string; players: { id: string; first_name: string; last_name: string; date_of_birth: string | null; email: string | null; phone_numbers: string[]; role: "player" | "staff" }[] }[];
};
type Trainer = { id: string; club_id: string; profile_id: string | null; display_name: string; phone_number: string | null; invitation_status: string; profiles: { email: string } | null; club_trainer_teams: { club_team_id: string }[] };
type Membership = { club_id: string; profile_id: string; role: "trainer" | "club_admin" | "club_admin_viewer" | "analyst"; function_role?: string; custom_role_name?: string | null; team_scope?: "none" | "assigned" | "all" };
type Match = { id: string; club_id: string; club_team_id: string | null; team_a_name: string; team_b_name: string; match_date: string | null; start_time: string | null; status: string; score_a: number | null; score_b: number | null; external_source: string | null };
type Assignment = { id: string; match_id: string; trainer_id: string; visible: boolean; assignment_source: string };
type MigrationIssue = { id: string; clubId: string; clubPlayerId: string; playerName: string; seasonId: string | null; candidates: { teamId: string; teamName: string; membershipType: string }[] };
type ModuleEntitlement = { club_id: string; module_key: string; enabled: boolean };
type TrainingSettings = {
  club_id: string; new_training_policy: "automatic" | "approval_required" | "personal_only";
  new_version_policy: "automatic" | "approval_required"; trainers_can_create_versions: boolean;
  trainers_can_download: boolean; age_category_required: boolean; change_note_required: boolean;
};
type Overview = { clubs: Club[]; teams: Team[]; trainers: Trainer[]; matches: Match[]; assignments: Assignment[]; memberships: Membership[]; moduleEntitlements: ModuleEntitlement[]; trainingSettings: TrainingSettings[]; memberPermissions: { club_id: string; profile_id: string; permission_key: string; enabled: boolean }[]; memberTeamAccess: { club_id: string; profile_id: string; club_team_id: string }[]; rolePermissionDefaults: { club_id: string; function_role: string; permission_key: string; enabled: boolean }[]; matchOptions: ClubMatchOption[]; migrationIssues: MigrationIssue[] };

const roleLabels: Record<Membership["role"], string> = { club_admin: "Club Admin", club_admin_viewer: "Club Admin (viewer)", analyst: "Analyst", trainer: "Trainer" };
const roleBadgeClass: Record<Membership["role"], string> = { club_admin: "bg-blue-500/15 text-blue-300", club_admin_viewer: "bg-blue-500/10 text-blue-200", analyst: "bg-cyan-500/15 text-cyan-300", trainer: "bg-accent/15 text-accent" };

export function ClubDashboard() {
  const { activeClubId } = useActiveClub();
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
      setSelectedClubId(activeClubId || body.clubs?.[0]?.id || "");
    }).catch((reason) => setError(reason.message));
  }

  useEffect(() => {
    void load();
    void supabase.auth.getUser().then(({ data: authData }) => setCurrentUserId(authData.user?.id ?? ""));
  }, []);
  useEffect(() => {
    if (activeClubId) setSelectedClubId(activeClubId);
  }, [activeClubId]);

  const club = data?.clubs.find((item) => item.id === selectedClubId);
  const teams = useMemo(() => data?.teams.filter((item) => item.club_id === selectedClubId) ?? [], [data, selectedClubId]);
  const trainers = useMemo(() => data?.trainers.filter((item) => item.club_id === selectedClubId) ?? [], [data, selectedClubId]);
  const migrationIssues = useMemo(() => data?.migrationIssues.filter((item) => item.clubId === selectedClubId) ?? [], [data, selectedClubId]);
  const matches = useMemo(() => data?.matches.filter((item) => item.club_id === selectedClubId) ?? [], [data, selectedClubId]);
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const myMembership = data?.memberships.find((item) => item.club_id === selectedClubId && item.profile_id === currentUserId);
  const readOnly = myMembership?.role === "club_admin_viewer";
  const moduleEnabled = (key: string) => data?.moduleEntitlements.find((item) => item.club_id === selectedClubId && item.module_key === key)?.enabled !== false;
  const trainingSettings = data?.trainingSettings.find((item) => item.club_id === selectedClubId);
  const youthCoordinatorTrainerIds = trainers.filter(trainer => data?.memberships.some(membership =>
    membership.club_id === selectedClubId && membership.profile_id === trainer.profile_id
      && ["youth_coordinator", "head_youth_development"].includes(membership.function_role ?? "")
  )).map(trainer => trainer.id);

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

  async function changeMatchDetails(match: Match, clubTeamId: string, matchDate: string, startTime: string) {
    setSaving(`match-team:${match.id}`);
    setError("");
    const response = await fetch("/api/club/assignments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: match.id, clubTeamId, matchDate: matchDate || null, startTime: startTime || null })
    });
    const body = await response.json();
    setSaving("");
    if (!response.ok) return setError(body.error || "De ploegtoewijzing kon niet worden gewijzigd.");
    await load();
  }

  async function removeTrainer(trainer: Trainer) {
    if (!window.confirm(`${trainer.display_name} uit ${club?.name ?? "de club"} verwijderen? Het loginaccount zelf blijft bestaan.`)) return;
    setSaving(`remove-trainer:${trainer.id}`);
    setError("");
    const response = await fetch("/api/club/trainers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId: selectedClubId, trainerId: trainer.id })
    });
    const body = await response.json();
    setSaving("");
    if (!response.ok) return setError(body.error || "De persoon kon niet worden verwijderd.");
    await load();
  }

  async function setClipViewRole(role: string, enabled: boolean) {
    if (!club || readOnly || role === "club_admin") return;
    const current = club.clip_view_count_roles ?? ["club_admin"];
    const roles = enabled ? [...new Set([...current, role])] : current.filter((item) => item !== role);
    setSaving("clip-view-roles");
    setError("");
    const response = await fetch("/api/club/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId: club.id, clipViewCountRoles: roles })
    });
    const body = await response.json();
    setSaving("");
    if (!response.ok) return setError(body.error || "Rechten voor kijkcijfers konden niet worden bewaard.");
    setData((currentData) => currentData ? {
      ...currentData,
      clubs: currentData.clubs.map((item) => item.id === club.id
        ? { ...item, clip_view_count_roles: body.club.clip_view_count_roles }
        : item)
    } : currentData);
  }

  async function saveTrainingSettings(next: TrainingSettings) {
    if (readOnly) return;
    setSaving("training-settings");
    setError("");
    const response = await fetch("/api/club/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clubId: selectedClubId,
        trainingSettings: {
          newTrainingPolicy: next.new_training_policy,
          newVersionPolicy: next.new_version_policy,
          trainersCanCreateVersions: next.trainers_can_create_versions,
          trainersCanDownload: next.trainers_can_download,
          ageCategoryRequired: next.age_category_required,
          changeNoteRequired: next.change_note_required
        }
      })
    });
    const body = await response.json();
    setSaving("");
    if (!response.ok) return setError(body.error || "Traininginstellingen konden niet worden bewaard.");
    setData((current) => current ? {
      ...current,
      trainingSettings: [...current.trainingSettings.filter((item) => item.club_id !== selectedClubId), body.trainingSettings]
    } : current);
  }

  if (error) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>;
  if (!data) return <div className="text-textMuted">Clubgegevens laden…</div>;
  if (!data.clubs.length) return <div className="text-textMuted">Je bent nog niet aan een club gekoppeld.</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          {club && <ClubLogoUploader compact clubId={club.id} clubName={club.name} logoUrl={club.logo_url ?? null} readOnly={readOnly}
            onChanged={logoUrl => setData(current => current ? { ...current, clubs: current.clubs.map(item => item.id === club.id ? { ...item, logo_url: logoUrl } : item) } : current)} />}
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg uppercase text-textBright">Clubbeheer</p>
            <h2 className="text-xl font-semibold text-textBright">{club?.name}</h2>
            <p className="text-sm text-textMuted">Clubinstellingen, modules en toegangsbeheer</p>
          </div>
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">
            RBFA {club?.rbfa_registration_number ? `stamnummer ${club.rbfa_registration_number}` : "nog te configureren"}
          </span>
        </div>
      </section>

      <ModuleAccordion title="Clubgegevens & infrastructuur" icon="/branding/clubadmin.png">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-textBright">Locaties en wedstrijdopties</h2>
          <p className="mt-1 text-sm text-textMuted">Beheer de vaste velden, kleedkamers, verzamelplaatsen en andere infrastructuur van de club.</p>
        </div>
        <ClubMatchOptionsManager clubId={selectedClubId} options={data.matchOptions.filter(option => option.club_id === selectedClubId)} readOnly={readOnly} onChanged={load} />
      </ModuleAccordion>

      {moduleEnabled("teams") && <ModuleAccordion title="Teams & spelers" icon="/branding/teams.png">
        <ClubTeamsManager clubId={selectedClubId} teams={teams} trainers={trainers} coordinatorTrainerIds={youthCoordinatorTrainerIds} options={data.matchOptions.filter(option => option.club_id === selectedClubId)} migrationIssues={migrationIssues} onChanged={load}
          readOnly={readOnly || !moduleEnabled("teams_manage")} allowImport={moduleEnabled("teams_import")} />
      </ModuleAccordion>}

      {moduleEnabled("matches") && <ModuleAccordion title="Imports & koppelingen" icon="/branding/games.png">
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-textBright">Wedstrijdkalenders</h2>
            <p className="mt-1 text-sm text-textMuted">Importeer of synchroniseer wedstrijdgegevens hier. De pagina Wedstrijden blijft zo gericht op de dagelijkse werking.</p>
          </div>
          <ClubMatchCsvImporter teams={teams.filter(team => team.status === "active").map(team => ({ id: team.id, name: team.name }))} readOnly={readOnly} onImported={load} />
          <p className="rounded-lg border border-borderSubtle bg-cardDeep p-4 text-sm text-textSecondary">Automatische kalenderkoppelingen worden per ploeg ingesteld bij Teams & spelers.</p>
        </div>
      </ModuleAccordion>}

      {(moduleEnabled("training") || moduleEnabled("intradesk")) && trainingSettings && (
        <ModuleAccordion title="Modules & beleid" icon="/branding/training.png">
          <div className="space-y-5">
          {moduleEnabled("training") && <div>
            <TrainingModuleSettings settings={trainingSettings} saving={saving === "training-settings"} readOnly={readOnly} onSave={saveTrainingSettings} />
          </div>}
          </div>
        </ModuleAccordion>
      )}

      {moduleEnabled("clips") && <ModuleAccordion title="Media & sponsoring" icon="/branding/clip-sponsors.png">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-xl font-semibold text-textBright">Media & sponsoring</h2>
          <p className="mt-1 text-sm text-textMuted">Beheer de algemene sponsor, de keuze per ploeg en de zichtbaarheid van clipstatistieken.</p>
          {club && <div className="mt-4">
            <ClubSponsorManager
              clubId={club.id}
              generalUrl={club.general_sponsor_url ?? "/branding/clip-sponsors.png"}
              teams={teams}
              readOnly={readOnly}
              onChanged={load}
            />
          </div>}
        <div className="mt-4 rounded-lg border border-borderSubtle bg-cardDeep p-4">
          <h3 className="font-semibold text-textPrimary">Wie mag kijkcijfers van clips zien?</h3>
          <p className="mt-1 text-sm text-textMuted">Bepaal welke rollen het aantal geopende gedeelde clips bij Wedstrijden zien. Clubadmins behouden altijd toegang.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {([
              ["club_admin", "Clubadmins"],
              ["club_admin_viewer", "Clubadmin-viewers"],
              ["analyst", "Analisten"],
              ["trainer", "Trainers en assistenten"]
            ] as const).map(([role, label]) => (
              <label key={role} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-textPrimary">
                <input type="checkbox"
                  checked={role === "club_admin" || (club?.clip_view_count_roles ?? ["club_admin"]).includes(role)}
                  disabled={readOnly || role === "club_admin" || saving === "clip-view-roles"}
                  onChange={(event) => void setClipViewRole(role, event.target.checked)}
                  className="h-4 w-4 accent-accent disabled:opacity-60" />
                <span>{label}{role === "club_admin" && <span className="ml-1 text-xs text-textMuted">· altijd</span>}</span>
              </label>
            ))}
          </div>
        </div>
        </section>
      </ModuleAccordion>}

      {moduleEnabled("matches") && <ModuleAccordion title="Wedstrijdtoegang" icon="/branding/games.png">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold text-textBright">Wedstrijden toewijzen</h2>
        <p className="mt-1 text-sm text-textMuted">Wijzig de ploeg van een wedstrijd en bepaal welke gebruikers toegang krijgen.</p>
        <MatchAssignmentManager matches={matches} trainers={trainers} teamNames={teamNames}
          activeTeams={teams.filter(team => team.status === "active")}
          assignments={data.assignments} saving={saving} readOnly={readOnly}
          onToggle={toggle} onChangeDetails={changeMatchDetails} onRemoveTrainer={removeTrainer} />
      </section>
      </ModuleAccordion>}

      <ModuleAccordion title="Personen & toegang" icon="/branding/clubadmin.png">
        <div className="space-y-6">
        <ClubPeopleManager clubId={selectedClubId}
          teams={teams.map((team) => ({ id: team.id, name: team.name }))}
          readOnly={readOnly} />
        <ClubInvitationCreator
          clubId={selectedClubId}
          readOnly={readOnly}
          teams={teams.map((team) => ({
            id: team.id,
            name: team.name,
            players: (team.teams ?? []).flatMap((operationalTeam) => operationalTeam.players)
              .filter((player) => player.role === "player")
              .map((player) => ({ id: player.id, name: `${player.first_name} ${player.last_name}`.trim() }))
          }))}
        />
        <ClubMemberAccessManager clubId={selectedClubId}
          members={data.memberships.filter((item) => item.club_id === selectedClubId)}
          trainers={trainers} teams={teams}
          permissions={data.memberPermissions.filter((item) => item.club_id === selectedClubId)}
          teamAccess={data.memberTeamAccess.filter((item) => item.club_id === selectedClubId)}
          roleDefaults={data.rolePermissionDefaults.filter((item) => item.club_id === selectedClubId)}
          readOnly={readOnly} onChanged={load} />
        </div>
      </ModuleAccordion>
    </div>
  );
}

function MatchAssignmentManager({ matches, trainers, teamNames, activeTeams, assignments, saving, readOnly, onToggle, onChangeDetails, onRemoveTrainer }: {
  matches: Match[];
  trainers: Trainer[];
  teamNames: Map<string, string>;
  activeTeams: Team[];
  assignments: Assignment[];
  saving: string;
  readOnly: boolean;
  onToggle: (match: Match, trainer: Trainer) => Promise<void>;
  onChangeDetails: (match: Match, clubTeamId: string, matchDate: string, startTime: string) => Promise<void>;
  onRemoveTrainer: (trainer: Trainer) => Promise<void>;
}) {
  const [matchQuery, setMatchQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedMatchDate, setSelectedMatchDate] = useState("");
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [personQuery, setPersonQuery] = useState("");
  const [accessFilter, setAccessFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const normalizedMatchQuery = matchQuery.trim().toLocaleLowerCase("nl");
  const filteredMatches = matches.filter(match => {
    const haystack = `${match.team_a_name} ${match.team_b_name} ${match.club_team_id ? teamNames.get(match.club_team_id) ?? "" : ""} ${match.external_source ?? ""}`.toLocaleLowerCase("nl");
    return (!normalizedMatchQuery || haystack.includes(normalizedMatchQuery))
      && (!teamFilter || match.club_team_id === teamFilter)
      && (!dateFrom || (match.match_date ?? "") >= dateFrom)
      && (!dateTo || (match.match_date ?? "") <= dateTo);
  }).slice(0, 50);
  const selectedMatch = matches.find(match => match.id === selectedMatchId) ?? null;
  useEffect(() => {
    setSelectedTeamId(selectedMatch?.club_team_id ?? "");
    setSelectedMatchDate(selectedMatch?.match_date ?? "");
    setSelectedStartTime(selectedMatch?.start_time?.slice(0, 5) ?? "");
  }, [selectedMatchId, selectedMatch?.club_team_id, selectedMatch?.match_date, selectedMatch?.start_time]);

  function assignmentState(match: Match, trainer: Trainer) {
    const explicit = assignments.find(item => item.match_id === match.id && item.trainer_id === trainer.id);
    const automatic = !!match.club_team_id && trainer.club_trainer_teams.some(item => item.club_team_id === match.club_team_id);
    return {
      visible: explicit?.visible ?? automatic,
      source: explicit?.assignment_source === "manual" ? "Handmatige override" : automatic ? "Automatisch via ploeg" : "Niet toegewezen"
    };
  }

  const normalizedPersonQuery = personQuery.trim().toLocaleLowerCase("nl");
  const people = selectedMatch ? trainers.filter(trainer => {
    const state = assignmentState(selectedMatch, trainer);
    const haystack = `${trainer.display_name} ${trainer.profiles?.email ?? ""}`.toLocaleLowerCase("nl");
    return (!normalizedPersonQuery || haystack.includes(normalizedPersonQuery))
      && (accessFilter === "all" || (accessFilter === "assigned" ? state.visible : !state.visible));
  }).slice(0, 50) : [];

  if (!matches.length) return <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-textMuted">Nog geen clubwedstrijden gekoppeld.</div>;

  return <div className="mt-4 grid gap-4 lg:grid-cols-2">
    <div className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
      <h3 className="font-semibold text-textPrimary">1. Zoek een wedstrijd</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input value={matchQuery} onChange={event => setMatchQuery(event.target.value)}
          placeholder="Ploeg, tegenstander of bron…" className="sm:col-span-2 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
        <select value={teamFilter} onChange={event => setTeamFilter(event.target.value)}
          className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary">
          <option value="">Alle ploegen</option>
          {Array.from(teamNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-textMuted">Van
            <input type="date" aria-label="Datum vanaf" value={dateFrom} onChange={event => setDateFrom(event.target.value)}
              className="mt-1 w-full min-w-0 rounded-lg border border-border bg-input px-2 py-2 text-xs text-textPrimary" />
          </label>
          <label className="text-xs font-semibold text-textMuted">Tot
            <input type="date" aria-label="Datum tot" value={dateTo} onChange={event => setDateTo(event.target.value)}
              className="mt-1 w-full min-w-0 rounded-lg border border-border bg-input px-2 py-2 text-xs text-textPrimary" />
          </label>
        </div>
      </div>
      <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
        {filteredMatches.map(match => <button key={match.id} type="button" onClick={() => setSelectedMatchId(match.id)}
          className={`w-full rounded-lg border p-3 text-left ${selectedMatchId === match.id ? "border-accent bg-accent/10" : "border-border bg-card hover:border-borderButton"}`}>
          <span className="block text-sm font-semibold text-textPrimary">{match.team_a_name} – {match.team_b_name}</span>
          <span className="mt-1 block text-xs text-textMuted">{match.match_date || "Datum onbekend"}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""} · {match.club_team_id ? teamNames.get(match.club_team_id) ?? "Ploeg onbekend" : "Nog niet gekoppeld"}</span>
        </button>)}
        {!filteredMatches.length && <p className="py-6 text-center text-sm text-textMuted">Geen wedstrijden gevonden.</p>}
      </div>
      {filteredMatches.length === 50 && <p className="mt-2 text-xs text-textMuted">De eerste 50 resultaten worden getoond. Verfijn je zoekopdracht.</p>}
    </div>

    <div className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
      <h3 className="font-semibold text-textPrimary">2. Controleer de ploeg en wijs gebruikers toe</h3>
      {!selectedMatch ? <p className="mt-4 text-sm text-textMuted">Selecteer eerst links een wedstrijd.</p> : <>
        <p className="mt-1 text-xs text-textMuted">{selectedMatch.team_a_name} – {selectedMatch.team_b_name}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-textSecondary sm:col-span-2">Toegewezen ploeg
            <select value={selectedTeamId}
              onChange={event => setSelectedTeamId(event.target.value)}
              disabled={readOnly || saving === `match-team:${selectedMatch.id}`}
              className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary disabled:opacity-50">
              <option value="" disabled>Kies een ploeg</option>
              {activeTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-textSecondary">Wedstrijddatum
            <input type="date" value={selectedMatchDate} onChange={event => setSelectedMatchDate(event.target.value)} disabled={readOnly || saving === `match-team:${selectedMatch.id}`}
              className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary disabled:opacity-50" />
          </label>
          <label className="text-sm text-textSecondary">Aanvangsuur
            <input type="time" value={selectedStartTime} onChange={event => setSelectedStartTime(event.target.value)} disabled={readOnly || saving === `match-team:${selectedMatch.id}`}
              className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary disabled:opacity-50" />
          </label>
          <button type="button"
            disabled={readOnly || !selectedTeamId || saving === `match-team:${selectedMatch.id}` || (selectedTeamId === selectedMatch.club_team_id && selectedMatchDate === (selectedMatch.match_date ?? "") && selectedStartTime === (selectedMatch.start_time?.slice(0, 5) ?? ""))}
            onClick={() => void onChangeDetails(selectedMatch, selectedTeamId, selectedMatchDate, selectedStartTime)}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-page disabled:opacity-50 sm:col-span-2">
            {saving === `match-team:${selectedMatch.id}` ? "Opslaan…" : "Wedstrijd opslaan"}
          </button>
        </div>
        <h4 className="mt-4 text-sm font-semibold text-textPrimary">3. Zoek een gebruiker</h4>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input value={personQuery} onChange={event => setPersonQuery(event.target.value)}
            placeholder="Voornaam, achternaam of e-mail…" className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
          <select value={accessFilter} onChange={event => setAccessFilter(event.target.value as typeof accessFilter)}
            className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary">
            <option value="all">Iedereen</option>
            <option value="assigned">Toegewezen</option>
            <option value="unassigned">Niet toegewezen</option>
          </select>
        </div>
        <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
          {people.map(trainer => {
            const state = assignmentState(selectedMatch, trainer);
            const key = `${selectedMatch.id}:${trainer.id}`;
            return <div key={trainer.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <input type="checkbox" checked={state.visible} disabled={readOnly || saving === key}
                aria-label={`${trainer.display_name} toegang tot wedstrijd`}
                onChange={() => void onToggle(selectedMatch, trainer)} className="h-5 w-5 accent-accent disabled:opacity-50" />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-textPrimary">{trainer.display_name}</strong>
                <span className="block truncate text-xs text-textMuted">{trainer.profiles?.email || "Geen gekoppeld e-mailadres"} · {state.source}</span>
              </span>
              {!readOnly && <button type="button" disabled={!!saving}
                onClick={() => void onRemoveTrainer(trainer)}
                className="rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs text-red-300 disabled:opacity-50">
                Verwijderen
              </button>}
            </div>;
          })}
          {!people.length && <p className="py-6 text-center text-sm text-textMuted">Geen gebruikers gevonden.</p>}
        </div>
        {people.length === 50 && <p className="mt-2 text-xs text-textMuted">De eerste 50 resultaten worden getoond. Verfijn je zoekopdracht.</p>}
      </>}
    </div>
  </div>;
}

function ModuleAccordion({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return <details className="group rounded-xl border border-border bg-card">
    <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
      <img src={icon} alt="" className="h-10 w-10 rounded-lg object-cover" />
      <span className="flex-1 text-lg font-semibold text-textBright">{title}</span>
      <span className="text-accent transition-transform group-open:rotate-90">▶</span>
    </summary>
    <div className="border-t border-borderSubtle p-4">{children}</div>
  </details>;
}

function TrainingModuleSettings({ settings, saving, readOnly, onSave }: {
  settings: TrainingSettings; saving: boolean; readOnly: boolean;
  onSave: (settings: TrainingSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const toggle = (key: keyof TrainingSettings) => setDraft((current) => ({ ...current, [key]: !current[key] }));
  return <section className="rounded-xl border border-border bg-card p-5">
    <h2 className="text-xl font-semibold text-textBright">Training & Intradesk</h2>
    <p className="mt-1 text-sm text-textMuted">Bepaal hoe nieuwe clubtrainingen en nieuwe versies gepubliceerd worden.</p>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <label className="text-sm text-textSecondary">Nieuwe trainingen
        <select value={draft.new_training_policy} disabled={readOnly} onChange={(event) => setDraft((current) => ({ ...current, new_training_policy: event.target.value as TrainingSettings["new_training_policy"] }))} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary">
          <option value="automatic">Automatisch goedkeuren en publiceren in Intradesk</option>
          <option value="approval_required">Eerst laten goedkeuren door een clubadmin</option>
          <option value="personal_only">Niet automatisch in Intradesk opnemen</option>
        </select>
      </label>
      <label className="text-sm text-textSecondary">Nieuwe versies
        <select value={draft.new_version_policy} disabled={readOnly} onChange={(event) => setDraft((current) => ({ ...current, new_version_policy: event.target.value as TrainingSettings["new_version_policy"] }))} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary">
          <option value="automatic">Automatisch publiceren</option>
          <option value="approval_required">Eerst laten goedkeuren</option>
        </select>
      </label>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {([
        ["trainers_can_create_versions", "Trainers mogen nieuwe versies maken"],
        ["trainers_can_download", "Trainers mogen clubtrainingen downloaden"],
        ["age_category_required", "Leeftijdscategorie is verplicht"],
        ["change_note_required", "Wijzigingsnotitie is verplicht"]
      ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-borderSubtle bg-cardDeep px-3 py-2 text-sm text-textPrimary">
        <input type="checkbox" checked={draft[key]} disabled={readOnly} onChange={() => toggle(key)} className="h-4 w-4 accent-accent" />{label}
      </label>)}
    </div>
    {!readOnly && <button type="button" disabled={saving} onClick={() => void onSave(draft)} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page disabled:opacity-50">{saving ? "Opslaan…" : "Instellingen opslaan"}</button>}
  </section>;
}
