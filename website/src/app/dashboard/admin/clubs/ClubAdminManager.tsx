"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClub, removeClubMembership, setClubMembership, setClubModuleEntitlement } from "../actions";
import { CLUB_MODULES, type ClubModuleKey } from "@/lib/club-modules";
import { ClubLogoUploader } from "@/components/clubs/ClubLogoUploader";

type ProfileOption = { id: string; email: string; full_name: string | null };
type Membership = { profile_id: string; role: "trainer" | "club_admin" | "club_admin_viewer" | "analyst" };
type ClubTrainer = { id: string; profile_id: string | null; display_name: string; phone_number: string | null; invitation_status: string; profiles: { email: string } | { email: string }[] | null; club_trainer_teams: { club_teams: { name: string } | { name: string }[] | null }[] };
type ClubTeam = { id: string; name: string };
type ClubRow = { id: string; name: string; rbfa_registration_number: string | null; logo_url: string | null; teams: ClubTeam[]; memberships: Membership[]; trainers: ClubTrainer[]; modules: { module_key: string; enabled: boolean }[] };

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
        <label className="text-sm text-textSecondary">Clubnaam<input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></label>
        <label className="text-sm text-textSecondary">RBFA-stamnummer (optioneel)<input value={rbfa} onChange={(e) => setRbfa(e.target.value)} className={inputClass} /></label>
        <label className="text-sm text-textSecondary">Eerste clubadmin (optioneel)<select value={adminId} onChange={(e) => setAdminId(e.target.value)} className={inputClass}><option value="">Later toewijzen</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.email}</option>)}</select></label>
      </div>
      <button disabled={pending || !name.trim()} onClick={() => run(async () => { await createClub(name, rbfa, adminId); setName(""); setRbfa(""); setAdminId(""); })} className="mt-4 rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:opacity-50">Club toevoegen</button>
    </section>}

    {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    {clubs.map((club) => <ClubRoles key={club.id} club={club} profiles={profiles} pending={pending} run={run} readOnly={readOnly} />)}
  </div>;
}

function ClubRoles({ club, profiles, pending, run, readOnly }: { club: ClubRow; profiles: ProfileOption[]; pending: boolean; run: (action: () => Promise<void>) => void; readOnly?: boolean }) {
  const [clubAdminId, setClubAdminId] = useState("");
  const [clubAdminViewerId, setClubAdminViewerId] = useState("");
  const [analystId, setAnalystId] = useState("");
  const members = club.memberships.filter((item) => item.role === "club_admin" || item.role === "club_admin_viewer" || item.role === "analyst");
  const nameOf = (id: string) => { const profile = profiles.find((item) => item.id === id); return profile?.full_name || profile?.email || "Onbekende gebruiker"; };
  const assignedTeamNames = new Set(club.trainers.flatMap((trainer) => trainer.club_trainer_teams.map((link) => relationValue(link.club_teams)?.name).filter(Boolean) as string[]));
  return <details className="group rounded-xl border border-border bg-card" open>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
      <div><h2 className="text-lg font-semibold text-textBright">{club.name}</h2><p className="text-xs text-textMuted">{club.rbfa_registration_number ? `RBFA ${club.rbfa_registration_number}` : "Geen stamnummer ingesteld"} · {club.teams.length} ploeg(en) · {club.trainers.length} trainer(s)</p></div>
      <span className="text-accent transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
    </summary>
    <div className="border-t border-borderSubtle p-5">
    <section className="mb-5 rounded-lg border border-borderSubtle bg-cardDeep p-4">
      <h3 className="mb-3 font-semibold text-textBright">Clublogo</h3>
      <ClubLogoUploader clubId={club.id} clubName={club.name} logoUrl={club.logo_url} readOnly={readOnly} />
    </section>
    {!!club.teams.length && <div className="mb-5 flex flex-wrap gap-2">{club.teams.map((team) => <span key={team.id} className={`rounded-full px-3 py-1 text-xs ${assignedTeamNames.has(team.name) ? "bg-accent/15 text-accent" : "bg-cardDeep text-textMuted"}`}>{team.name}{!assignedTeamNames.has(team.name) && " · geen trainer"}</span>)}</div>}
    <section className="mb-5 rounded-lg border border-borderSubtle bg-cardDeep p-4">
      <h3 className="font-semibold text-textBright">Beschikbare modules</h3>
      <p className="mt-1 text-xs text-textMuted">Alleen de platformadmin bepaalt welke onderdelen deze club kan gebruiken.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {CLUB_MODULES.map((module) => {
          const enabled = club.modules.find((item) => item.module_key === module.key)?.enabled !== false;
          return <label key={module.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textPrimary">
            <input type="checkbox" checked={enabled} disabled={pending || readOnly}
              onChange={(event) => run(() => setClubModuleEntitlement(club.id, module.key as ClubModuleKey, event.target.checked))}
              className="h-4 w-4 accent-accent disabled:opacity-50" />
            {module.label}
          </label>;
        })}
      </div>
    </section>
    <div className="mb-5 overflow-x-auto rounded-lg border border-borderSubtle">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="bg-cardDeep text-xs uppercase text-textMuted"><tr><th className="px-3 py-2 text-left">Naam</th><th className="px-3 py-2 text-left">Ploeg(en)</th><th className="px-3 py-2 text-left">GSM</th><th className="px-3 py-2 text-left">E-mail</th></tr></thead>
        <tbody>{club.trainers.map((trainer) => <tr key={trainer.id} className="border-t border-borderSubtle"><td className="px-3 py-2 text-textPrimary">{trainer.display_name}{trainer.invitation_status !== "linked" && <span className="ml-2 text-xs text-amber-300">Nog te koppelen</span>}</td><td className="px-3 py-2 text-textSecondary">{trainer.club_trainer_teams.map((link) => relationValue(link.club_teams)?.name).filter(Boolean).join(", ") || "—"}</td><td className="px-3 py-2 text-textSecondary">{trainer.phone_number || "—"}</td><td className="px-3 py-2 text-textSecondary">{relationValue(trainer.profiles)?.email || "—"}</td></tr>)}</tbody>
      </table>
    </div>
    <div className="mt-4 space-y-2">{members.map((member) => <div key={member.profile_id} className="flex items-center justify-between rounded-lg border border-borderSubtle bg-cardDeep px-3 py-2"><div><span className="text-sm text-textPrimary">{nameOf(member.profile_id)}</span><span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${memberRoleClass[member.role]}`}>{memberRoleLabel[member.role]}</span></div>{!readOnly && <button disabled={pending} onClick={() => run(() => removeClubMembership(club.id, member.profile_id))} className="text-xs text-red-300 hover:underline">Verwijderen</button>}</div>)}</div>
    {!readOnly && <div className="mt-4 grid gap-3 md:grid-cols-3">
      <RolePicker label="Club Admin toevoegen" value={clubAdminId} setValue={setClubAdminId} profiles={profiles} pending={pending} onAdd={() => run(async () => { await setClubMembership(club.id, clubAdminId, "club_admin"); setClubAdminId(""); })} />
      <RolePicker label="Club Admin (viewer) toevoegen" value={clubAdminViewerId} setValue={setClubAdminViewerId} profiles={profiles} pending={pending} onAdd={() => run(async () => { await setClubMembership(club.id, clubAdminViewerId, "club_admin_viewer"); setClubAdminViewerId(""); })} />
      <RolePicker label="Analyst toevoegen" value={analystId} setValue={setAnalystId} profiles={profiles} pending={pending} onAdd={() => run(async () => { await setClubMembership(club.id, analystId, "analyst"); setAnalystId(""); })} />
    </div>}
    </div>
  </details>;
}

function RolePicker({ label, value, setValue, profiles, pending, onAdd }: { label: string; value: string; setValue: (value: string) => void; profiles: ProfileOption[]; pending: boolean; onAdd: () => void }) {
  return <div><label className="text-sm text-textSecondary">{label}<select value={value} onChange={(e) => setValue(e.target.value)} className={inputClass}><option value="">Kies een gebruiker</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.email}</option>)}</select></label><button disabled={pending || !value} onClick={onAdd} className="mt-2 rounded-lg border border-borderButton px-3 py-2 text-sm text-textPrimary disabled:opacity-50">Toevoegen</button></div>;
}

const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";

function relationValue<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
