"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ClubTeamsManager } from "./ClubTeamsManager";
import { ClubLogoUploader } from "@/components/clubs/ClubLogoUploader";
import { useActiveClub } from "@/components/clubs/ActiveClubProvider";
import { ClubMemberAccessManager } from "./ClubMemberAccessManager";
import { ClubInvitationCreator } from "./ClubInvitationCreator";
import Link from "next/link";
import Image from "next/image";

type Club = { id: string; name: string; rbfa_registration_number: string | null; clip_advertising_enabled: boolean; clip_view_count_roles?: string[]; logo_url?: string | null };
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
type Overview = { clubs: Club[]; teams: Team[]; trainers: Trainer[]; matches: Match[]; assignments: Assignment[]; memberships: Membership[]; moduleEntitlements: ModuleEntitlement[]; trainingSettings: TrainingSettings[]; memberPermissions: { club_id: string; profile_id: string; permission_key: string; enabled: boolean }[]; memberTeamAccess: { club_id: string; profile_id: string; club_team_id: string }[]; migrationIssues: MigrationIssue[] };

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

  async function setClipAdvertising(enabled: boolean) {
    if (!club || readOnly) return;
    const key = `clips:${club.id}`;
    setSaving(key);
    setError("");
    const response = await fetch("/api/club/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId: club.id, clipAdvertisingEnabled: enabled })
    });
    const body = await response.json();
    setSaving("");
    if (!response.ok) return setError(body.error || "Clipinstellingen konden niet worden bewaard.");
    setData((current) => current ? {
      ...current,
      clubs: current.clubs.map((item) => item.id === club.id ? { ...item, clip_advertising_enabled: enabled } : item)
    } : current);
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

  async function setFeaturePermission(key: "teams_manage" | "teams_import", enabled: boolean) {
    if (readOnly) return;
    setSaving(key);
    setError("");
    const response = await fetch("/api/club/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId: selectedClubId, featurePermission: { key, enabled } })
    });
    const body = await response.json();
    setSaving("");
    if (!response.ok) return setError(body.error || "Recht kon niet worden bewaard.");
    await load();
  }

  if (error) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>;
  if (!data) return <div className="text-textMuted">Clubgegevens laden…</div>;
  if (!data.clubs.length) return <div className="text-textMuted">Je bent nog niet aan een club gekoppeld.</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/dashboard" title="Home" className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-borderButton bg-button transition hover:border-accent hover:bg-cardHover">
            <Image src="/branding/home.png" alt="Home" width={38} height={38} />
          </Link>
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

      {moduleEnabled("teams") && <ModuleAccordion title="Teams" icon="/branding/teams.png">
        <div className="mb-4 space-y-2 rounded-xl border border-borderSubtle bg-cardDeep p-4">
          <PermissionToggle label="Teams en spelers beheren" help="Teams aanpassen en spelers toevoegen, wijzigen of verwijderen."
            checked={moduleEnabled("teams_manage")} disabled={readOnly || saving === "teams_manage"}
            onChange={(enabled) => void setFeaturePermission("teams_manage", enabled)} />
          <PermissionToggle label="PSD/Excel-import gebruiken" help="Spelerslijsten vanuit PSD of Excel inlezen."
            checked={moduleEnabled("teams_manage") && moduleEnabled("teams_import")}
            disabled={readOnly || !moduleEnabled("teams_manage") || saving === "teams_import"}
            onChange={(enabled) => void setFeaturePermission("teams_import", enabled)} />
        </div>
        <ClubTeamsManager clubId={selectedClubId} teams={teams} trainers={trainers} migrationIssues={migrationIssues} onChanged={load}
          readOnly={readOnly || !moduleEnabled("teams_manage")} allowImport={moduleEnabled("teams_import")} />
      </ModuleAccordion>}

      {(moduleEnabled("training") || moduleEnabled("intradesk")) && trainingSettings && (
        <>
          {moduleEnabled("training") && <ModuleAccordion title="Training" icon="/branding/training.png">
            <TrainingModuleSettings settings={trainingSettings} saving={saving === "training-settings"} readOnly={readOnly} onSave={saveTrainingSettings} />
          </ModuleAccordion>}
          {moduleEnabled("intradesk") && <ModuleAccordion title="Intradesk" icon="/branding/intradesk.png">
            <div className="rounded-xl border border-borderSubtle bg-cardDeep p-4 text-sm text-textSecondary">Hier komen de rechten om nieuwe onderdelen en versies aan de gedeelde trainingsbibliotheek toe te voegen.</div>
          </ModuleAccordion>}
        </>
      )}

      {(moduleEnabled("clips") || moduleEnabled("matches")) && <ModuleAccordion title="Games" icon="/branding/games.png">
      {moduleEnabled("clips") && <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold text-textBright">Clips</h2>
        <p className="mt-1 text-sm text-textMuted">Bepaal wat er onderaan de publieke gedeelde clips van deze club verschijnt.</p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-borderSubtle bg-cardDeep p-4">
          <input
            type="checkbox"
            checked={club?.clip_advertising_enabled !== false}
            disabled={readOnly || saving === `clips:${club?.id}`}
            onChange={(event) => void setClipAdvertising(event.target.checked)}
            className="mt-0.5 h-5 w-5 accent-accent disabled:opacity-60"
          />
          <span>
            <span className="block font-semibold text-textPrimary">Voeg reclame toe</span>
            <span className="mt-1 block text-sm text-textMuted">Toon de vaste sponsorafbeelding onder de video op gedeelde clippagina’s.</span>
          </span>
        </label>
        <div className="mt-4 rounded-lg border border-borderSubtle bg-cardDeep p-4">
          <h3 className="font-semibold text-textPrimary">Wie mag kijkcijfers zien?</h3>
          <p className="mt-1 text-sm text-textMuted">Bepaal welke rollen het aantal geopende gedeelde clips in Matches zien. Clubadmins behouden altijd toegang.</p>
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
      </section>}

      {moduleEnabled("matches") && <section className="mt-4 rounded-xl border border-border bg-card p-5">
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
      </section>}
      </ModuleAccordion>}

      {moduleEnabled("video_viewer") && <ModuleAccordion title="Video Viewer" icon="/branding/video-viewer.png">
        <div className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
          <h3 className="font-semibold text-textPrimary">Wie mag de Video Viewer gebruiken?</h3>
          <p className="mt-1 text-sm text-textMuted">De rol Afgevaardigde bestaat technisch al als teammanager. De afzonderlijke rolselectie wordt hier verder uitgebouwd.</p>
        </div>
      </ModuleAccordion>}

      <ClubInvitationCreator clubId={selectedClubId} readOnly={readOnly} />
      <ClubMemberAccessManager clubId={selectedClubId}
        members={data.memberships.filter((item) => item.club_id === selectedClubId)}
        trainers={trainers} teams={teams}
        permissions={data.memberPermissions.filter((item) => item.club_id === selectedClubId)}
        teamAccess={data.memberTeamAccess.filter((item) => item.club_id === selectedClubId)}
        readOnly={readOnly} onChanged={load} />
    </div>
  );
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

function PermissionToggle({ label, help, checked, disabled, onChange }: { label: string; help: string; checked: boolean; disabled: boolean; onChange: (enabled: boolean) => void }) {
  return <label className="flex items-start gap-3 rounded-lg border border-border p-3">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-accent disabled:opacity-50" />
    <span><strong className="block text-sm text-textPrimary">{label}</strong><span className="block text-xs text-textMuted">{help}</span></span>
  </label>;
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
