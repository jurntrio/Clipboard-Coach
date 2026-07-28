"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClub, removeClubMembership, setClubMembership, setClubModuleEntitlement } from "../actions";
import { CLUB_MODULES, type ClubModuleKey } from "@/lib/club-modules";
import { ClubLogoUploader } from "@/components/clubs/ClubLogoUploader";

type ProfileOption = { id: string; email: string; full_name: string | null };
type Membership = { profile_id: string; role: "trainer" | "club_admin" | "club_admin_viewer" | "analyst" };
type ClubTrainer = { id: string; profile_id: string | null; display_name: string; phone_number: string | null; invitation_status: string; profiles: { email: string } | { email: string }[] | null; club_trainer_teams: { club_teams: { name: string } | { name: string }[] | null }[] };
type ClubTeam = { id: string; name: string };
type ClubUsage = { teams: number; players: number; members: number; trainings: number; matches: number; videos: number; clips: number; videoBytes: number; clipBytes: number; trainingBytes: number; clipsWithUnknownSize: number };
type ClubRow = { id: string; name: string; rbfa_registration_number: string | null; logo_url: string | null; teams: ClubTeam[]; memberships: Membership[]; trainers: ClubTrainer[]; modules: { module_key: string; enabled: boolean }[]; usage: ClubUsage };

const memberRoleLabel: Record<Membership["role"], string> = { club_admin: "Club Admin", club_admin_viewer: "Club Admin (viewer)", analyst: "Analyst", trainer: "Trainer" };
const memberRoleClass: Record<Membership["role"], string> = { club_admin: "bg-blue-500/15 text-blue-300", club_admin_viewer: "bg-blue-500/10 text-blue-200", analyst: "bg-cyan-500/15 text-cyan-300", trainer: "bg-accent/15 text-accent" };

export function ClubAdminManager({ clubs, profiles, readOnly }: { clubs: ClubRow[]; profiles: ProfileOption[]; readOnly?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [rbfa, setRbfa] = useState("");
  const [adminId, setAdminId] = useState("");
  const [error, setError] = useState("");

  function run(action: () => Promise<void>) {
    setError("");
    startTransition(async () => {
      try { await action(); router.refresh(); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "Wijziging kon niet worden bewaard."); }
    });
  }

  return <div className="space-y-6">
    {!readOnly && <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold text-textBright">Nieuwe club</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm text-textSecondary">Clubnaam<input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></label>
        <label className="text-sm text-textSecondary">RBFA-stamnummer (optioneel)<input value={rbfa} onChange={(event) => setRbfa(event.target.value)} className={inputClass} /></label>
        <label className="text-sm text-textSecondary">Eerste clubadmin (optioneel)<select value={adminId} onChange={(event) => setAdminId(event.target.value)} className={inputClass}><option value="">Later toewijzen</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.email}</option>)}</select></label>
      </div>
      <button disabled={pending || !name.trim()} onClick={() => run(async () => { await createClub(name, rbfa, adminId); setName(""); setRbfa(""); setAdminId(""); })} className="mt-4 rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:opacity-50">Club toevoegen</button>
    </section>}
    {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    {clubs.map((club) => <ClubDetails key={club.id} club={club} profiles={profiles} pending={pending} run={run} readOnly={readOnly} />)}
  </div>;
}

function ClubDetails({ club, profiles, pending, run, readOnly }: { club: ClubRow; profiles: ProfileOption[]; pending: boolean; run: (action: () => Promise<void>) => void; readOnly?: boolean }) {
  const [clubAdminId, setClubAdminId] = useState("");
  const [clubAdminViewerId, setClubAdminViewerId] = useState("");
  const [analystId, setAnalystId] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberSort, setMemberSort] = useState<"lastName" | "firstName" | "role">("lastName");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const privilegedMembers = club.memberships.filter((item) => item.role !== "trainer");
  const nameOf = (id: string) => { const profile = profiles.find((item) => item.id === id); return profile?.full_name || profile?.email || "Onbekende gebruiker"; };
  const assignedTeamNames = new Set(club.trainers.flatMap((trainer) => trainer.club_trainer_teams.map((link) => relationValue(link.club_teams)?.name).filter(Boolean) as string[]));

  const listedMembers = useMemo(() => {
    const rows = club.trainers.map((trainer) => {
      const profileName = trainer.profile_id ? nameOf(trainer.profile_id) : trainer.display_name;
      const displayName = profileName.includes("@") ? trainer.display_name : profileName;
      const { firstName, lastName } = splitName(displayName);
      const membership = trainer.profile_id ? club.memberships.find((item) => item.profile_id === trainer.profile_id) : null;
      return {
        id: trainer.profile_id ?? `trainer:${trainer.id}`, profileId: trainer.profile_id,
        firstName, lastName, displayName, role: membership?.role ?? "trainer" as Membership["role"],
        teams: trainer.club_trainer_teams.map((link) => relationValue(link.club_teams)?.name).filter(Boolean).join(", ") || "—",
        email: relationValue(trainer.profiles)?.email || "—", pending: trainer.invitation_status !== "linked"
      };
    });
    const trainerProfileIds = new Set(club.trainers.map((trainer) => trainer.profile_id).filter(Boolean));
    for (const membership of club.memberships) {
      if (trainerProfileIds.has(membership.profile_id)) continue;
      const displayName = nameOf(membership.profile_id);
      rows.push({
        id: membership.profile_id, profileId: membership.profile_id, ...splitName(displayName),
        displayName, role: membership.role, teams: "—",
        email: profiles.find((profile) => profile.id === membership.profile_id)?.email || "—", pending: false
      });
    }
    const needle = memberQuery.trim().toLocaleLowerCase("nl-BE");
    return rows.filter((row) => !needle || `${row.firstName} ${row.lastName} ${row.role} ${row.email}`.toLocaleLowerCase("nl-BE").includes(needle))
      .sort((first, second) => {
        const a = memberSort === "role" ? first.role : first[memberSort];
        const b = memberSort === "role" ? second.role : second[memberSort];
        return a.localeCompare(b, "nl-BE", { sensitivity: "base" });
      });
  }, [club.memberships, club.trainers, memberQuery, memberSort, profiles]);

  const knownStorage = club.usage.videoBytes + club.usage.clipBytes + club.usage.trainingBytes;

  return <details className="group rounded-xl border border-border bg-card">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
      <div><h2 className="text-lg font-semibold text-textBright">{club.name}</h2><p className="text-xs text-textMuted">{club.rbfa_registration_number ? `RBFA ${club.rbfa_registration_number}` : "Geen stamnummer ingesteld"} · {club.usage.teams} ploeg(en) · {club.usage.members} lid/leden · {formatBytes(knownStorage)} bekend gebruik</p></div>
      <span className="text-accent transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
    </summary>
    <div className="border-t border-borderSubtle p-5">
      <section className="mb-5">
        <h3 className="font-semibold text-textBright">Gebruik op CBCS</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <UsageCard label="Club & Teams" value={`${club.usage.teams} teams · ${club.usage.players} spelers`} detail={`${club.usage.members} clubleden`} />
          <UsageCard label="Training" value={`${club.usage.trainings} trainingen`} detail={formatBytes(club.usage.trainingBytes)} />
          <UsageCard label="Videoanalyse" value={`${club.usage.matches} matches · ${club.usage.videos} video's`} detail={formatBytes(club.usage.videoBytes)} />
          <UsageCard label="Clips" value={`${club.usage.clips} clips`} detail={`${formatBytes(club.usage.clipBytes)}${club.usage.clipsWithUnknownSize ? ` · ${club.usage.clipsWithUnknownSize} grootte(s) onbekend` : ""}`} />
        </div>
        <p className="mt-2 text-xs text-textMuted">Opslag is de som van geregistreerde video- en clipbestanden plus trainingsinhoud. Oude bestanden zonder bestandsgrootte worden apart gemeld.</p>
      </section>

      <section className="mb-5 rounded-lg border border-borderSubtle bg-cardDeep p-4">
        <h3 className="font-semibold text-textBright">Modules en rechten</h3>
        <p className="mt-1 text-xs text-textMuted">Schakel per onderdeel de module in en bepaal daaronder welke handelingen toegelaten zijn.</p>
        <div className="mt-3 space-y-2">
          {CLUB_MODULES.filter((module) => ["matches", "video_viewer", "teams", "clips", "training", "intradesk"].includes(module.key)).map((module) => {
            const enabled = club.modules.find((item) => item.module_key === module.key)?.enabled !== false;
            return <div key={module.key} className="rounded-lg border border-border bg-card">
              <label className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-textBright">
                <input type="checkbox" checked={enabled} disabled={pending || readOnly} onChange={(event) => run(() => setClubModuleEntitlement(club.id, module.key as ClubModuleKey, event.target.checked))} className="h-4 w-4 accent-accent disabled:opacity-50" />
                {module.label}
              </label>
            </div>;
          })}
        </div>
      </section>

      <section className="mb-5 rounded-lg border border-borderSubtle bg-cardDeep p-4">
        <h3 className="mb-3 font-semibold text-textBright">Clublogo</h3>
        <ClubLogoUploader clubId={club.id} clubName={club.name} logoUrl={club.logo_url} readOnly={readOnly} />
      </section>
      {!!club.teams.length && <div className="mb-5 flex flex-wrap gap-2">{club.teams.map((team) => <span key={team.id} className={`rounded-full px-3 py-1 text-xs ${assignedTeamNames.has(team.name) ? "bg-accent/15 text-accent" : "bg-cardDeep text-textMuted"}`}>{team.name}{!assignedTeamNames.has(team.name) && " · geen trainer"}</span>)}</div>}

      <details className="group/members mb-5 rounded-lg border border-borderSubtle">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4">
          <span className="font-semibold text-textBright">Leden en rollen ({listedMembers.length})</span>
          <span className="text-accent transition-transform group-open/members:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-borderSubtle p-4">
          <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_220px]">
            <input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Zoek op naam, rol of e-mail" className={inputClassBare} />
            <select value={memberSort} onChange={(event) => setMemberSort(event.target.value as typeof memberSort)} className={inputClassBare}>
              <option value="lastName">Sorteren op naam</option>
              <option value="firstName">Sorteren op voornaam</option>
              <option value="role">Sorteren op rol</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-lg border border-borderSubtle">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-cardDeep text-xs uppercase text-textMuted"><tr>
                <th className="px-3 py-2 text-left"><input type="checkbox" aria-label="Alle zichtbare leden selecteren" checked={listedMembers.length > 0 && listedMembers.every((item) => selectedMemberIds.includes(item.id))} onChange={(event) => setSelectedMemberIds((current) => event.target.checked ? [...new Set([...current, ...listedMembers.map((item) => item.id)])] : current.filter((id) => !listedMembers.some((item) => item.id === id)))} /></th>
                <th className="px-3 py-2 text-left">Naam</th><th className="px-3 py-2 text-left">Voornaam</th><th className="px-3 py-2 text-left">Rol</th><th className="px-3 py-2 text-left">Ploeg(en)</th><th className="px-3 py-2 text-left">E-mail</th>
              </tr></thead>
              <tbody>{listedMembers.map((member) => <tr key={member.id} className="border-t border-borderSubtle">
                <td className="px-3 py-2"><input type="checkbox" aria-label={`Selecteer ${member.displayName}`} checked={selectedMemberIds.includes(member.id)} onChange={(event) => setSelectedMemberIds((current) => event.target.checked ? [...new Set([...current, member.id])] : current.filter((id) => id !== member.id))} /></td>
                <td className="px-3 py-2 text-textPrimary">{member.profileId ? <Link href={`/dashboard/admin/coaches/${member.profileId}`} className="hover:text-accent hover:underline">{member.lastName}</Link> : member.lastName}{member.pending && <span className="ml-2 text-xs text-amber-300">Nog te koppelen</span>}</td>
                <td className="px-3 py-2 text-textPrimary">{member.firstName}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${memberRoleClass[member.role]}`}>{memberRoleLabel[member.role]}</span></td>
                <td className="px-3 py-2 text-textSecondary">{member.teams}</td><td className="px-3 py-2 text-textSecondary">{member.email}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {!!selectedMemberIds.length && <p className="mt-2 text-xs font-semibold text-accent">{selectedMemberIds.length} lid/leden geselecteerd</p>}
        </div>
      </details>

      <div className="mt-4 space-y-2">{privilegedMembers.map((member) => <div key={member.profile_id} className="flex items-center justify-between rounded-lg border border-borderSubtle bg-cardDeep px-3 py-2"><div><span className="text-sm text-textPrimary">{nameOf(member.profile_id)}</span><span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${memberRoleClass[member.role]}`}>{memberRoleLabel[member.role]}</span></div>{!readOnly && <button disabled={pending} onClick={() => run(() => removeClubMembership(club.id, member.profile_id))} className="text-xs text-red-300 hover:underline">Verwijderen</button>}</div>)}</div>
      {!readOnly && <div className="mt-4 grid gap-3 md:grid-cols-3">
        <RolePicker label="Club Admin toevoegen" value={clubAdminId} setValue={setClubAdminId} profiles={profiles} pending={pending} onAdd={() => run(async () => { await setClubMembership(club.id, clubAdminId, "club_admin"); setClubAdminId(""); })} />
        <RolePicker label="Club Admin (viewer) toevoegen" value={clubAdminViewerId} setValue={setClubAdminViewerId} profiles={profiles} pending={pending} onAdd={() => run(async () => { await setClubMembership(club.id, clubAdminViewerId, "club_admin_viewer"); setClubAdminViewerId(""); })} />
        <RolePicker label="Analyst toevoegen" value={analystId} setValue={setAnalystId} profiles={profiles} pending={pending} onAdd={() => run(async () => { await setClubMembership(club.id, analystId, "analyst"); setAnalystId(""); })} />
      </div>}
    </div>
  </details>;
}

function UsageCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-lg border border-borderSubtle bg-cardDeep p-4"><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{label}</p><p className="mt-1 font-semibold text-textBright">{value}</p><p className="mt-1 text-xs text-textSecondary">{detail}</p></article>;
}

function RolePicker({ label, value, setValue, profiles, pending, onAdd }: { label: string; value: string; setValue: (value: string) => void; profiles: ProfileOption[]; pending: boolean; onAdd: () => void }) {
  return <div><label className="text-sm text-textSecondary">{label}<select value={value} onChange={(event) => setValue(event.target.value)} className={inputClass}><option value="">Kies een gebruiker</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.email}</option>)}</select></label><button disabled={pending || !value} onClick={onAdd} className="mt-2 rounded-lg border border-borderButton px-3 py-2 text-sm text-textPrimary disabled:opacity-50">Toevoegen</button></div>;
}

function splitName(displayName: string) {
  const parts = displayName.trim().split(/\s+/);
  return { firstName: parts[0] || "—", lastName: parts.slice(1).join(" ") || "—" };
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** exponent)).toLocaleString("nl-BE", { maximumFractionDigits: exponent ? 1 : 0 })} ${units[exponent]}`;
}

const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";
const inputClassBare = "w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";

function relationValue<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
