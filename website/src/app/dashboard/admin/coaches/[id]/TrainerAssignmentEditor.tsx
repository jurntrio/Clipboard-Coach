"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTrainerAssignment } from "../../actions";
import { CLUB_FUNCTION_ROLES } from "@/lib/club-access-options";

type ClubOption = { id: string; name: string; teams: { id: string; name: string }[] };

export function TrainerAssignmentEditor({ profileId, fullName: initialName, clubs, assignment, readOnly }: {
  profileId: string;
  fullName: string;
  clubs: ClubOption[];
  assignment: { club_id: string; function_role: string; custom_role_name: string; team_ids: string[]; phone_number: string } | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(initialName);
  const [phoneNumber, setPhoneNumber] = useState(assignment?.phone_number ?? "");
  const [clubId, setClubId] = useState(assignment?.club_id ?? "");
  const [role, setRole] = useState(assignment?.function_role ?? "trainer");
  const [customRoleName, setCustomRoleName] = useState(assignment?.custom_role_name ?? "");
  const [teamIds, setTeamIds] = useState<string[]>(assignment?.team_ids ?? []);
  const [error, setError] = useState("");
  const teams = clubs.find((club) => club.id === clubId)?.teams ?? [];

  function chooseClub(value: string) { setClubId(value); setTeamIds([]); }
  function toggleTeam(id: string) { setTeamIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function save() {
    setError("");
    startTransition(async () => {
      try {
        await updateTrainerAssignment({ profileId, fullName, phoneNumber, clubId, role, customRoleName, teamIds });
        router.refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "De trainergegevens konden niet bewaard worden.");
      }
    });
  }

  return <section className="mb-8 rounded-xl border border-border bg-card p-5">
    <div><h3 className="font-semibold text-textBright">Clubtoewijzing</h3><p className="mt-1 text-sm text-textMuted">Beheer naam, clubfunctie en de ploegen waarvoor deze gebruiker verantwoordelijk is.</p></div>
    <div className="mt-4 grid gap-4 md:grid-cols-4">
      <label className="text-sm text-textSecondary">Naam<input value={fullName} disabled={readOnly} onChange={(event) => setFullName(event.target.value)} className={`${inputClass} disabled:opacity-60`} /></label>
      <label className="text-sm text-textSecondary">Gsm<input type="tel" value={phoneNumber} disabled={readOnly} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+32 …" className={`${inputClass} disabled:opacity-60`} /></label>
      <label className="text-sm text-textSecondary">Club<select value={clubId} disabled={readOnly} onChange={(event) => chooseClub(event.target.value)} className={`${inputClass} disabled:opacity-60`}><option value="">Kies een club</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
      <label className="text-sm text-textSecondary">Clubfunctie<select value={role} disabled={readOnly} onChange={(event) => setRole(event.target.value)} className={`${inputClass} disabled:opacity-60`}>{CLUB_FUNCTION_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {role === "custom" && <label className="mt-4 block max-w-md text-sm text-textSecondary">Naam van de aangepaste functie<input value={customRoleName} disabled={readOnly} onChange={(event) => setCustomRoleName(event.target.value)} className={`${inputClass} disabled:opacity-60`} /></label>}
    <div className="mt-4">
      <p className="mb-2 text-sm font-semibold text-textSecondary">Ploegen</p>
      {(role === "club_admin" || role === "club_admin_viewer") && <p className="mb-3 rounded-lg border border-accent/30 bg-accentDim px-3 py-2 text-sm text-textSecondary">Deze rol heeft automatisch toegang tot alle ploegen van de club. De keuzes hieronder zijn alleen optionele standaardploegen.</p>}
      {teams.length ? <div className="flex flex-wrap gap-2">{teams.map((team) => { const selected = teamIds.includes(team.id); return <button key={team.id} type="button" disabled={readOnly} onClick={() => toggleTeam(team.id)} className={`rounded-full border px-3 py-2 text-sm disabled:opacity-60 ${selected ? "border-accent bg-accentDim text-accent" : "border-borderButton bg-button text-textPrimary"}`}>{selected ? "✓ " : ""}{team.name}</button>; })}</div> : <p className="text-sm text-textMuted">{clubId ? "Deze club heeft nog geen ploegen." : "Kies eerst een club."}</p>}
    </div>
    {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
    {!readOnly && <button type="button" disabled={pending || !fullName.trim() || !clubId || (role === "custom" && !customRoleName.trim())} onClick={save} className="mt-5 rounded-lg bg-accent px-5 py-2.5 font-semibold text-page disabled:opacity-50">{pending ? "Bewaren…" : "Clubtoewijzing bewaren"}</button>}
  </section>;
}

const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-textPrimary";
