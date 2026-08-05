"use client";

import { useEffect, useMemo, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { TeamTrainingScheduler } from "@/components/teams/TeamTrainingScheduler";
import { TeamMatchScheduler } from "@/components/teams/TeamMatchScheduler";
import type { ClubMatchOption } from "@/components/clubs/ClubMatchOptionsManager";
import { AGE_CATEGORIES, defaultsForAgeCategory, type MatchFormat } from "@/lib/match-defaults";

type PlayerRow = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phoneNumbers: string;
  // Enkel gezet voor rijen die al een DB-rij zijn (uit storedRows) op het moment van laden.
  // De import slaat nooit meer stilzwijgend een speler af (toevoegen/bijwerken-modus, zie
  // roster/route.ts), dus de "x"-knop mag voor zulke rijen niet langer "verwijderen" beloven.
  isStored?: boolean;
};
type StoredPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  email: string | null;
  phone_numbers: string[];
  role: "player" | "staff";
};
type Team = {
  id: string;
  club_id: string;
  name: string;
  status: string;
  display_order: number;
  trainers_can_edit_roster: boolean;
  trainers_can_manage_matches: boolean;
  age_category: string | null;
  match_format: MatchFormat | null;
  match_period_count: number | null;
  match_period_minutes: number | null;
  match_minimum_players: number | null;
  club_trainer_teams?: { trainer_id: string; role: string; status: string }[];
  teams?: { id: string; players: StoredPlayer[] }[];
};
type Trainer = { id: string; profile_id: string | null; display_name: string };
type MigrationIssue = { id: string; clubId: string; clubPlayerId: string; playerName: string; seasonId: string | null; candidates: { teamId: string; teamName: string; membershipType: string }[] };
type SearchResult = { club_player_id: string; first_name: string; last_name: string; birth_year: number | null; current_team_names: string[] };
type ImportMode = "merge" | "sync" | "replace";

const inputClass = "w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";
const emptyPlayer = (): PlayerRow => ({ firstName: "", lastName: "", dateOfBirth: "", email: "", phoneNumbers: "" });
const textValue = (value: unknown) => value == null ? "" : String(value).trim();
const normalizedHeader = (value: unknown) => textValue(value).toLocaleLowerCase("nl-BE").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
// Client-side benadering van de servers normalize_person_name (0030) -- enkel gebruikt om de
// importpreview (nieuw/bijgewerkt/ontbrekend) te tonen. De echte match gebeurt server-side op
// naam+geboortedatum; hier volstaat een benadering omdat de uiteindelijke verwijdering altijd
// via een expliciet aangevinkte speler-id loopt, nooit via deze string-match zelf.
const nameKey = (first: string, last: string) => `${first}${last}`.toLocaleLowerCase("nl-BE").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const match = textValue(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
}
function phoneValue(value: unknown) {
  const raw = textValue(value);
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits === "14" || digits.length < 8) return "";
  if (raw.startsWith("+") || digits.startsWith("32")) return `+${digits}`;
  return raw;
}
function storedRows(team: Team): PlayerRow[] {
  const players = team.teams?.[0]?.players?.filter((player) => player.role === "player") ?? [];
  return players.length ? players.map((player) => ({
    firstName: player.first_name,
    lastName: player.last_name,
    dateOfBirth: player.date_of_birth ?? "",
    email: player.email ?? "",
    phoneNumbers: player.phone_numbers?.join(", ") ?? "",
    isStored: true
  })) : [emptyPlayer()];
}

export function ClubTeamsManager({ clubId, teams, trainers, coordinatorTrainerIds, options, migrationIssues, onChanged, readOnly, allowImport = true, allowReorder = false }: { clubId: string; teams: Team[]; trainers: Trainer[]; coordinatorTrainerIds: string[]; options: ClubMatchOption[]; migrationIssues: MigrationIssue[]; onChanged: () => Promise<void>; readOnly?: boolean; allowImport?: boolean; allowReorder?: boolean }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [newAgeCategory, setNewAgeCategory] = useState("");
  const [editing, setEditing] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState("");
  const supabase = useMemo(() => createClient(), []);

  async function request(method: string, body: Record<string, unknown>) {
    setBusy(String(body.teamId ?? "create")); setError("");
    const response = await fetch("/api/club/teams", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    setBusy("");
    if (!response.ok) { setError(result.error || t("clubTeams.saveFailed")); return false; }
    await onChanged();
    return true;
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const defaults = defaultsForAgeCategory(newAgeCategory);
    if (await request("POST", {
      clubId, name, ageCategory: newAgeCategory,
      matchFormat: defaults?.format, periodCount: defaults?.periodCount,
      periodMinutes: defaults?.periodMinutes, minimumPlayers: defaults?.minimumPlayers
    })) { setName(""); setNewAgeCategory(""); }
  }

  async function resolvePrimary(issue: MigrationIssue, teamId: string) {
    setResolving(issue.id); setError("");
    const { error: resolveError } = await supabase.rpc("resolve_primary_membership", {
      target_club_player_id: issue.clubPlayerId, target_team_id: teamId
    });
    setResolving("");
    if (resolveError) { setError(resolveError.message); return; }
    await onChanged();
  }

  async function moveTeam(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= teams.length) return;
    const reordered = teams.map((team) => team.id);
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    await request("PATCH", { clubId, teamIds: reordered });
  }

  return <section className="rounded-xl border border-border bg-card p-5">
    <h2 className="text-xl font-semibold text-textBright">{t("clubTeams.heading")}</h2>
    <p className="mt-1 text-sm text-textMuted">{t("clubTeams.subtitle")}</p>
    {!readOnly && <form onSubmit={create} className="mt-4 flex flex-wrap gap-3 rounded-xl border border-borderSubtle bg-cardDeep p-4">
      <input required value={name} onChange={(event) => setName(event.target.value)} placeholder={t("clubTeams.namePlaceholder")} className={`${inputClass} min-w-60 flex-1`} />
      <input required list="new-team-age-categories" value={newAgeCategory} onChange={(event) => setNewAgeCategory(event.target.value)} placeholder="Leeftijdscategorie" className={`${inputClass} w-52`} />
      <datalist id="new-team-age-categories">{AGE_CATEGORIES.map(category => <option key={category} value={category} />)}</datalist>
      <button disabled={busy === "create"} className="shrink-0 rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:opacity-50">{t("clubTeams.create")}</button>
    </form>}
    {error && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    {!readOnly && !!migrationIssues.length && <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <h3 className="font-semibold text-amber-200">{t("clubTeams.unassignedPrimaryHeading")}</h3>
      <p className="mt-1 text-sm text-amber-100/80">{t("clubTeams.unassignedPrimaryHelp")}</p>
      <div className="mt-3 space-y-3">{migrationIssues.map((issue) => (
        <div key={issue.id} className="rounded-lg border border-borderSubtle bg-card p-3">
          <p className="text-sm font-semibold text-textPrimary">{issue.playerName}</p>
          <div className="mt-2 flex flex-wrap gap-2">{issue.candidates.map((candidate) => (
            <button key={candidate.teamId} type="button" disabled={resolving === issue.id}
              onClick={() => void resolvePrimary(issue, candidate.teamId)}
              className="rounded-lg border border-borderButton px-3 py-1.5 text-xs font-semibold text-accent disabled:opacity-50">
              {t("clubTeams.choosePrimary", { team: candidate.teamName })}
            </button>
          ))}</div>
        </div>
      ))}</div>
    </div>}
    {allowReorder && teams.length > 1 && <p className="mt-4 text-sm text-textMuted">Gebruik de pijlen om de vaste ploegvolgorde voor alle clubleden te bepalen.</p>}
    <div className="mt-4 space-y-3">{teams.map((team, index) => {
      const coachNames = (team.club_trainer_teams ?? []).filter((link) => link.status === "active").map((link) => trainers.find((trainer) => trainer.id === link.trainer_id)?.display_name).filter(Boolean);
      return <article key={team.id} className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h3 className="font-semibold text-textPrimary">{team.name}</h3>
            <p className="mt-1 text-sm text-textMuted">{t("clubTeams.coachesLabel", { names: coachNames.join(", ") || t("clubTeams.noCoachAssigned") })}</p>
          </div>
          <span className="text-xs text-textMuted">{t("matchHub.lineupCount", { count: team.teams?.[0]?.players?.filter((player) => player.role === "player").length ?? 0 })}</span>
          {allowReorder && <div className="flex gap-1" aria-label={`Volgorde van ${team.name}`}>
            <button type="button" title="Naar boven" aria-label={`${team.name} naar boven`} disabled={index === 0 || !!busy} onClick={() => void moveTeam(index, -1)} className="grid h-9 w-9 place-items-center rounded-lg border border-borderButton text-textPrimary disabled:opacity-30">↑</button>
            <button type="button" title="Naar beneden" aria-label={`${team.name} naar beneden`} disabled={index === teams.length - 1 || !!busy} onClick={() => void moveTeam(index, 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-borderButton text-textPrimary disabled:opacity-30">↓</button>
          </div>}
          <button type="button" onClick={() => setEditing((current) => current === team.id ? "" : team.id)} className="flex items-center gap-2 rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-accent">
            {t("common.edit")}<span className={`transition ${editing === team.id ? "rotate-90" : ""}`}>▶</span>
          </button>
        </div>
        {editing === team.id && <TeamEditor clubId={clubId} team={team} trainers={trainers} coordinatorTrainerIds={coordinatorTrainerIds} options={options} busy={busy === team.id} request={request} onChanged={onChanged} readOnly={readOnly} allowImport={allowImport} />}
      </article>;
    })}</div>
    {!teams.length && <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-textMuted">{t("clubTeams.noTeamsYet")}</div>}
  </section>;
}

function TeamEditor({ clubId, team, trainers, coordinatorTrainerIds, options, busy, request, onChanged, readOnly, allowImport }: { clubId: string; team: Team; trainers: Trainer[]; coordinatorTrainerIds: string[]; options: ClubMatchOption[]; busy: boolean; request: (method: string, body: Record<string, unknown>) => Promise<boolean>; onChanged: () => Promise<void>; readOnly?: boolean; allowImport: boolean }) {
  const { t } = useI18n();
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState(team.name);
  const [canEdit, setCanEdit] = useState(team.trainers_can_edit_roster);
  const [canManageMatches, setCanManageMatches] = useState(team.trainers_can_manage_matches ?? false);
  const ageDefaults = defaultsForAgeCategory(team.age_category);
  const [ageCategory, setAgeCategory] = useState(team.age_category ?? "");
  const [matchFormat, setMatchFormat] = useState<MatchFormat | "">(team.match_format ?? ageDefaults?.format ?? "");
  const [periodCount, setPeriodCount] = useState((team.match_period_count ?? ageDefaults?.periodCount ?? "").toString());
  const [periodMinutes, setPeriodMinutes] = useState((team.match_period_minutes ?? ageDefaults?.periodMinutes ?? "").toString());
  const [minimumPlayers, setMinimumPlayers] = useState((team.match_minimum_players ?? ageDefaults?.minimumPlayers ?? "").toString());
  const [coachMenuOpen, setCoachMenuOpen] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState("");
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [calendarConfigured, setCalendarConfigured] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState("");
  const [calendarLastSync, setCalendarLastSync] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>(() => storedRows(team));
  const [baseline, setBaseline] = useState<StoredPlayer[]>(() => team.teams?.[0]?.players?.filter((player) => player.role === "player") ?? []);
  const [rosterStatus, setRosterStatus] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [removeIds, setRemoveIds] = useState<Set<string>>(new Set());
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [assignStatus, setAssignStatus] = useState("");
  const [activeTab, setActiveTab] = useState<"settings" | "matches" | "trainings">("settings");
  const [rosterOpen, setRosterOpen] = useState(false);

  const missingPlayers = useMemo(() => {
    const currentKeys = new Set(players.map((player) => nameKey(player.firstName, player.lastName)));
    return baseline.filter((player) => !currentKeys.has(nameKey(player.first_name, player.last_name)));
  }, [players, baseline]);
  const newCount = useMemo(() => {
    const baselineKeys = new Set(baseline.map((player) => nameKey(player.first_name, player.last_name)));
    return players.filter((player) => player.firstName && player.lastName && !baselineKeys.has(nameKey(player.firstName, player.lastName))).length;
  }, [players, baseline]);
  const updatedCount = players.filter((player) => player.firstName && player.lastName).length - newCount;

  useEffect(() => {
    if (importMode === "replace") setRemoveIds(new Set(missingPlayers.map((player) => player.id)));
    else if (importMode === "merge") { setRemoveIds(new Set()); setReplaceConfirmed(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importMode, missingPlayers.length]);

  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) { setSearchResults([]); return; }
    const handle = setTimeout(() => {
      void supabase.rpc("search_club_players_for_assignment", { target_club_id: clubId, search_term: term })
        .then(({ data }) => setSearchResults((data as SearchResult[] | null) ?? []));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchTerm, clubId, supabase]);

  useEffect(() => {
    void fetch(`/api/club/teams/${team.id}/calendar`).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json();
      setCalendarConfigured(result.configured === true);
      setCalendarEnabled(result.enabled === true);
      setCalendarStatus(result.last_sync_message ?? "");
      setCalendarLastSync(result.last_synced_at ?? null);
    });
  }, [team.id]);

  function updatePlayer(index: number, field: keyof PlayerRow, value: string) {
    setPlayers((current) => current.map((player, row) => row === index ? { ...player, [field]: value } : player));
  }
  function toggleRemove(id: string) {
    setRemoveIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function importRoster(file: File) {
    setRosterStatus(t("clubTeams.readingFile"));
    try {
      const rows = await readSheet(file);
      const headers = (rows[0] ?? []).map(normalizedHeader);
      const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
      const first = column("voornaam", "firstname");
      const last = column("naam", "achternaam", "familienaam");
      const birth = column("geboortedatum", "geboortedate", "birthdate");
      const email = column("emailspeler", "email", "emailadres");
      const phones = [column("telefoonspeler", "gsmspeler", "gsm"), column("telefoon2", "gsm2"), column("telefoon3", "gsm3")].filter((index) => index >= 0);
      if (first < 0 || last < 0) throw new Error(t("clubTeams.columnsNotFound"));
      const imported = rows.slice(1).map((row) => ({
        firstName: textValue(row[first]),
        lastName: textValue(row[last]),
        dateOfBirth: birth >= 0 ? dateValue(row[birth]) : "",
        email: email >= 0 ? textValue(row[email]) : "",
        phoneNumbers: Array.from(new Set(phones.map((index) => phoneValue(row[index])).filter(Boolean))).join(", ")
      })).filter((player) => player.firstName || player.lastName);
      if (!imported.length) throw new Error(t("clubTeams.noUsablePlayers"));
      setPlayers(imported);
      setRosterStatus(t("clubTeams.importedCount", { count: imported.length }));
    } catch (error) {
      setRosterStatus(error instanceof Error ? error.message : t("clubTeams.fileReadFailed"));
    }
  }
  async function saveAll() {
    if (!name.trim()) return;
    if (importMode === "replace" && missingPlayers.length > 0 && !replaceConfirmed) {
      setRosterStatus(t("clubTeams.replaceConfirmRequired"));
      return;
    }
    setRosterStatus(t("common.saving"));
    const savedTeam = await request("PATCH", {
      teamId: team.id, name, ageCategory, trainersCanEditRoster: canEdit, trainersCanManageMatches: canManageMatches,
      matchFormat, periodCount: Number(periodCount), periodMinutes: Number(periodMinutes), minimumPlayers: Number(minimumPlayers)
    });
    if (!savedTeam) { setRosterStatus(""); return; }
    const removePlayerIds = importMode === "merge" ? [] : missingPlayers.filter((player) => removeIds.has(player.id)).map((player) => player.id);
    const response = await fetch(`/api/club/teams/${team.id}/roster`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ players: players.map(({ isStored: _isStored, ...player }) => player), removePlayerIds }) });
    const result = await response.json();
    if (!response.ok) return setRosterStatus(result.error || t("clubTeams.rosterSaveFailed"));
    setRosterStatus(result.removed ? t("clubTeams.allSavedWithRemoved", { count: result.saved, removed: result.removed }) : t("clubTeams.allSaved", { count: result.saved }));
    if (removePlayerIds.length) setBaseline((current) => current.filter((player) => !removePlayerIds.includes(player.id)));
    setRemoveIds(new Set());
    setReplaceConfirmed(false);
    await onChanged();
  }
  async function assignExisting(result: SearchResult) {
    const operationalTeamId = team.teams?.[0]?.id;
    if (!operationalTeamId) return;
    setAssignStatus(t("common.saving"));
    const { error } = await supabase.rpc("add_club_player_to_team", { target_club_player_id: result.club_player_id, target_team_id: operationalTeamId });
    if (error) { setAssignStatus(error.message); return; }
    setAssignStatus(t("clubTeams.addedToTeam", { name: `${result.first_name} ${result.last_name}` }));
    setSearchTerm("");
    setSearchResults([]);
    await onChanged();
  }

  async function saveCalendar(syncAfter = false) {
    setCalendarStatus(t("common.saving"));
    const response = await fetch(`/api/club/teams/${team.id}/calendar`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: calendarUrl, enabled: calendarEnabled })
    });
    const result = await response.json();
    if (!response.ok) { setCalendarStatus(result.error || t("clubTeams.calendarSaveFailed")); return; }
    setCalendarConfigured(true);
    setCalendarUrl("");
    setCalendarStatus(t("clubTeams.calendarSaved"));
    if (syncAfter) await syncCalendar();
  }

  async function syncCalendar() {
    setCalendarStatus(t("clubTeams.calendarChecking"));
    const response = await fetch(`/api/club/teams/${team.id}/calendar`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) { setCalendarStatus(result.error || t("clubTeams.calendarSyncFailed")); return; }
    setCalendarStatus(result.unchanged ? t("clubTeams.calendarNoChanges") : t("clubTeams.calendarSyncResult", { imported: result.imported, updated: result.updated }));
    setCalendarLastSync(new Date().toISOString());
    await onChanged();
  }

  return <div className="mt-4 border-t border-borderSubtle pt-4">
    <div className="mb-5 flex gap-2 border-b border-borderSubtle pb-3">
      <button type="button" onClick={() => setActiveTab("settings")} className={`rounded-lg px-4 py-2 text-sm font-bold ${activeTab === "settings" ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>Team bewerken</button>
      <button type="button" onClick={() => setActiveTab("matches")} className={`rounded-lg px-4 py-2 text-sm font-bold ${activeTab === "matches" ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>Wedstrijden toevoegen</button>
      <button type="button" onClick={() => setActiveTab("trainings")} className={`rounded-lg px-4 py-2 text-sm font-bold ${activeTab === "trainings" ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>Trainingen toevoegen</button>
    </div>
    {activeTab === "matches" ? <TeamMatchScheduler teamId={team.teams?.[0]?.id ?? ""} teamName={team.name} readOnly={readOnly || !team.teams?.[0]?.id} />
      : activeTab === "trainings" ? <TeamTrainingScheduler teamId={team.id} trainers={trainers}
      assignedTrainerIds={[...new Set([...coordinatorTrainerIds, ...(team.club_trainer_teams ?? []).filter(link => link.status === "active").map(link => link.trainer_id)])]}
      options={options} readOnly={readOnly} /> : <div className="space-y-5">
    <div className="flex flex-wrap gap-3">
      <input value={name} disabled={readOnly} onChange={(event) => setName(event.target.value)} className={`${inputClass} min-w-52 flex-1 disabled:opacity-60`} />
      {!readOnly && <button disabled={busy || !name.trim()} onClick={() => void saveAll()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page">{t("common.save")}</button>}
    </div>
    <div className="grid gap-2 md:grid-cols-2">
      <label className="flex items-center gap-3 rounded-lg border border-borderSubtle p-3 text-sm text-textSecondary">
        <input type="checkbox" checked={canEdit} disabled={readOnly} onChange={(event) => setCanEdit(event.target.checked)} className="h-4 w-4 accent-accent" />
        <strong className="flex-1 text-textPrimary">{t("clubTeams.trainerCanEditRoster")}</strong>
        <span title={t("clubTeams.trainerCanEditRosterHelp")} className="cursor-help rounded-full border border-borderButton px-2 py-0.5 text-xs font-bold text-accent">i</span>
      </label>
      <label className="flex items-center gap-3 rounded-lg border border-borderSubtle p-3 text-sm text-textSecondary">
        <input type="checkbox" checked={canManageMatches} disabled={readOnly} onChange={(event) => setCanManageMatches(event.target.checked)} className="h-4 w-4 accent-accent" />
        <strong className="flex-1 text-textPrimary">{t("clubTeams.trainerCanManageMatches")}</strong>
        <span title={t("clubTeams.trainerCanManageMatchesHelp")} className="cursor-help rounded-full border border-borderButton px-2 py-0.5 text-xs font-bold text-accent">i</span>
      </label>
    </div>
    <section className="rounded-xl border border-borderSubtle bg-card p-4">
      <h4 className="text-sm font-semibold text-textBright">Standaard wedstrijdindeling</h4>
      <p className="mt-1 text-xs text-textMuted">Nieuwe wedstrijden nemen deze waarden over. In de wedstrijdvoorbereiding blijven ze aanpasbaar.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs text-textSecondary">Leeftijdscategorie
          <input list={`age-categories-${team.id}`} value={ageCategory} disabled={readOnly} onChange={event => {
            const category = event.target.value;
            setAgeCategory(category);
            const defaults = defaultsForAgeCategory(category);
            if (defaults) {
              setMatchFormat(defaults.format); setPeriodCount(String(defaults.periodCount));
              setPeriodMinutes(String(defaults.periodMinutes)); setMinimumPlayers(String(defaults.minimumPlayers));
            }
          }} className={`mt-1 ${inputClass}`} />
          <datalist id={`age-categories-${team.id}`}>{AGE_CATEGORIES.map(category => <option key={category} value={category} />)}</datalist>
        </label>
        <label className="text-xs text-textSecondary">Spelvorm<select value={matchFormat} disabled={readOnly} onChange={event => setMatchFormat(event.target.value as MatchFormat)} className={`mt-1 ${inputClass}`}><option value="">—</option><option value="5v5">5v5</option><option value="8v8">8v8</option><option value="11v11">11v11</option></select></label>
        <label className="text-xs text-textSecondary">Aantal periodes<input required type="number" min="1" max="12" value={periodCount} disabled={readOnly} onChange={event => setPeriodCount(event.target.value)} className={`mt-1 ${inputClass}`} /></label>
        <label className="text-xs text-textSecondary">Minuten per periode<input required type="number" min="1" max="120" value={periodMinutes} disabled={readOnly} onChange={event => setPeriodMinutes(event.target.value)} className={`mt-1 ${inputClass}`} /></label>
        <label className="text-xs text-textSecondary">Minimum spelers<input required type="number" min="1" max="30" value={minimumPlayers} disabled={readOnly} onChange={event => setMinimumPlayers(event.target.value)} className={`mt-1 ${inputClass}`} /></label>
      </div>
    </section>
    <div>
      <h4 className="text-sm font-semibold text-textPrimary">{t("clubTeams.assignCoaches")}</h4>
      <div className="relative mt-2">
        <button type="button" disabled={readOnly} onClick={() => setCoachMenuOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-lg border border-borderSubtle bg-input px-3 py-2 text-left text-sm text-textPrimary disabled:opacity-60">
          <span>{(team.club_trainer_teams ?? []).filter((link) => link.status === "active").length
            ? t("clubTeams.selectedCoachCount", { count: (team.club_trainer_teams ?? []).filter((link) => link.status === "active").length })
            : t("clubTeams.chooseCoaches")}</span>
          <span className={`transition ${coachMenuOpen ? "rotate-180" : ""}`}>▼</span>
        </button>
        {coachMenuOpen && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-xl">{trainers.map((trainer) => {
        const link = team.club_trainer_teams?.find((item) => item.trainer_id === trainer.id && item.status === "active");
        return <label key={trainer.id} className="flex items-center gap-2 rounded-lg border border-borderSubtle px-3 py-2 text-sm text-textSecondary">
          <input type="checkbox" checked={!!link} disabled={readOnly || busy || !trainer.profile_id} onChange={() => {
            void request("PUT", { teamId: team.id, profileId: trainer.profile_id, role: link?.role ?? "coach", remove: !!link }).then(() => setCoachMenuOpen(false));
          }} className="accent-accent" />
          <span className="flex-1">{trainer.display_name}</span>
          {!trainer.profile_id && <span className="text-xs text-amber-300">{t("clubTeams.notRegisteredYet")}</span>}
        </label>;
      })}</div>}
      </div>
    </div>
    {!readOnly && <div className="rounded-xl border border-borderSubtle p-4">
      <h4 className="font-semibold text-textPrimary">{t("clubTeams.automaticMatches")}</h4>
      <p className="mt-1 text-xs text-textMuted">{t("clubTeams.automaticMatchesHelp")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input type="url" value={calendarUrl} onChange={(event) => setCalendarUrl(event.target.value)}
          placeholder={calendarConfigured ? t("clubTeams.calendarConfigured") : "https://www.voetbalvlaanderen.be/club/.../ploeg/.../kalender"}
          className={`${inputClass} min-w-64 flex-1`} />
        <button type="button" onClick={() => void saveCalendar(true)} disabled={!calendarUrl && !calendarConfigured}
          className="rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-accent disabled:opacity-50">{t("clubTeams.testAndSync")}</button>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-textSecondary">
        <input type="checkbox" checked={calendarEnabled} onChange={(event) => setCalendarEnabled(event.target.checked)} className="accent-accent" />
        {t("clubTeams.enableAutomaticSync")}
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void saveCalendar(false)} disabled={!calendarUrl && !calendarConfigured}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-page disabled:opacity-50">{t("common.save")}</button>
        {calendarConfigured && <button type="button" onClick={() => void syncCalendar()} className="rounded-lg border border-borderButton px-3 py-2 text-sm text-textPrimary">{t("clubTeams.syncNow")}</button>}
        {calendarLastSync && <span className="text-xs text-textMuted">{t("clubTeams.lastSync", { date: new Date(calendarLastSync).toLocaleString("nl-BE") })}</span>}
      </div>
      {calendarStatus && <p className="mt-2 text-sm text-accent">{calendarStatus}</p>}
    </div>}
    {!readOnly && <div className="rounded-xl border border-borderSubtle p-4">
      <h4 className="font-semibold text-textPrimary">{t("clubTeams.addExistingHeading")}</h4>
      <p className="text-xs text-textMuted">{t("clubTeams.addExistingHelp")}</p>
      <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={t("clubTeams.addExistingSearchPlaceholder")} className={`${inputClass} mt-2`} />
      {assignStatus && <p className="mt-2 text-sm text-accent">{assignStatus}</p>}
      {!!searchResults.length && <div className="mt-2 space-y-1">{searchResults.map((result) => <div key={result.club_player_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borderSubtle px-3 py-2 text-sm">
        <span className="text-textPrimary">{result.first_name} {result.last_name}{result.birth_year ? ` (${result.birth_year})` : ""}
          {!!result.current_team_names.length && <span className="ml-2 text-xs text-textMuted">{t("clubTeams.currentlyOn", { teams: result.current_team_names.join(", ") })}</span>}
        </span>
        <button type="button" onClick={() => void assignExisting(result)} className="rounded-lg border border-borderButton px-2 py-1 text-xs font-semibold text-accent">{t("clubTeams.addToTeam")}</button>
      </div>)}</div>}
    </div>}
    <div className="rounded-xl border border-borderSubtle p-4">
      <button type="button" onClick={() => setRosterOpen(open => !open)} className="flex w-full flex-wrap items-center gap-3 text-left">
        <div className="mr-auto"><h4 className="font-semibold text-textPrimary">{t("clubTeams.roster")}</h4><p className="text-xs text-textMuted">{t("clubTeams.importHelp")}</p></div>
        <span className={`text-accent transition ${rosterOpen ? "rotate-90" : ""}`}>▶</span>
      </button>
      {rosterOpen && <div className="mt-4">
      <div className="flex flex-wrap justify-end gap-3">
        {!readOnly && allowImport && <label className="cursor-pointer rounded-lg border border-borderButton px-3 py-2 text-sm text-textPrimary">{t("clubTeams.choosePsdFile")}<input type="file" accept=".xlsx" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importRoster(file); event.target.value = ""; }} /></label>}
        {!readOnly && <button type="button" onClick={() => setPlayers((current) => [...current, emptyPlayer()])} className="rounded-lg border border-borderButton px-3 py-2 text-sm text-textSecondary">{t("clubTeams.addPlayer")}</button>}
      </div>
      {!readOnly && <div className="mt-3 flex flex-wrap gap-2">{(["merge", "sync", "replace"] as const).map((mode) => (
        <button key={mode} type="button" onClick={() => setImportMode(mode)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${importMode === mode ? "border-accent bg-accent/10 text-accent" : "border-borderButton text-textSecondary"}`}>
          {t(`clubTeams.importMode.${mode}`)}
        </button>
      ))}</div>}
      <p className="mt-2 text-xs text-textMuted">{t(`clubTeams.importModeHint.${importMode}`)}</p>
      {(!!players.length || !!baseline.length) && <p className="mt-2 text-xs font-semibold text-textSecondary">{t("clubTeams.importPreview", { new: newCount, updated: updatedCount, missing: missingPlayers.length })}</p>}
      {importMode !== "merge" && !!missingPlayers.length && <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
        <p className="text-sm font-semibold text-amber-200">{t(importMode === "replace" ? "clubTeams.replaceWarning" : "clubTeams.syncMissingHeading")}</p>
        <div className="mt-2 space-y-1">{missingPlayers.map((player) => <label key={player.id} className="flex items-center gap-2 text-sm text-textSecondary">
          <input type="checkbox" checked={removeIds.has(player.id)} disabled={importMode === "replace"} onChange={() => toggleRemove(player.id)} className="accent-accent" />
          <span>{player.first_name} {player.last_name}</span>
        </label>)}</div>
        {importMode === "replace" && <label className="mt-3 flex items-start gap-2 text-sm text-red-300">
          <input type="checkbox" checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} className="mt-1 accent-red-400" />
          <span>{t("clubTeams.replaceConfirmLabel", { count: missingPlayers.length })}</span>
        </label>}
      </div>}
      {rosterStatus && <p className="mt-2 text-sm text-accent">{rosterStatus}</p>}
      <div className="mt-3 space-y-2">{players.map((player, index) => <div key={index} className="grid gap-2 rounded-lg border border-borderSubtle p-2 md:grid-cols-[1fr_1fr_135px_1.3fr_1fr_auto]">
        <input value={player.firstName} disabled={readOnly} onChange={(event) => updatePlayer(index, "firstName", event.target.value)} placeholder={t("clubTeams.firstNamePlaceholder")} className={`${inputClass} disabled:opacity-60`} />
        <input value={player.lastName} disabled={readOnly} onChange={(event) => updatePlayer(index, "lastName", event.target.value)} placeholder={t("clubTeams.lastNamePlaceholder")} className={`${inputClass} disabled:opacity-60`} />
        <input type="date" value={player.dateOfBirth} disabled={readOnly} onChange={(event) => updatePlayer(index, "dateOfBirth", event.target.value)} className={`${inputClass} disabled:opacity-60`} />
        <input type="email" value={player.email} disabled={readOnly} onChange={(event) => updatePlayer(index, "email", event.target.value)} placeholder={t("auth.email")} className={`${inputClass} disabled:opacity-60`} />
        <input value={player.phoneNumbers} disabled={readOnly} onChange={(event) => updatePlayer(index, "phoneNumbers", event.target.value)} placeholder={t("clubTeams.phonePlaceholder")} className={`${inputClass} disabled:opacity-60`} />
        {!readOnly && (player.isStored
          ? <button type="button" disabled title={t("clubTeams.removeDisabledTooltip")} className="px-2 text-textMuted opacity-40">×</button>
          : <button type="button" onClick={() => setPlayers((current) => current.filter((_, row) => row !== index))} className="px-2 text-red-300">×</button>
        )}
      </div>)}</div>
      {!readOnly && <p className="mt-3 text-xs text-textMuted">{t("clubTeams.saveHint", { save: t("common.save") })}</p>}
      </div>}
    </div>
  </div>}
  </div>;
}
