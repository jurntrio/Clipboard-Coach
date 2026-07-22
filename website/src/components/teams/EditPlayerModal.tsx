"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Player, Team } from "@/types/database";

export function EditPlayerModal({
  player,
  onClose,
  onSaved
}: {
  player: Player;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(player.first_name);
  const [lastName, setLastName] = useState(player.last_name);
  const [role, setRole] = useState<Player["role"]>(player.role);
  const [jerseyNumber, setJerseyNumber] = useState(player.jersey_number?.toString() ?? "");
  const [position, setPosition] = useState(player.position ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(player.date_of_birth ?? "");
  const [email, setEmail] = useState(player.email ?? "");
  const [phoneNumbers, setPhoneNumbers] = useState(player.phone_numbers?.join(", ") ?? "");
  const [teamId, setTeamId] = useState(player.team_id);
  const [teams, setTeams] = useState<Team[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    void supabase.from("teams").select("*").order("name").then(({ data }) => setTeams([...(data ?? [])].sort((a, b) => Number(a.name.trim().toUpperCase() === "EXTRA") - Number(b.name.trim().toUpperCase() === "EXTRA") || a.name.localeCompare(b.name))));
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    setSaving(true);
    setError("");
    const parsedJerseyNumber = jerseyNumber.trim() ? Number(jerseyNumber) : null;
    const { error: updateError } = await supabase
      .from("players")
      .update({
        team_id: teamId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role,
        jersey_number: parsedJerseyNumber,
        position: position.trim() || null,
        date_of_birth: dateOfBirth || null,
        email: email.trim() || null,
        phone_numbers: phoneNumbers.split(",").map((phone) => phone.trim()).filter(Boolean)
      })
      .eq("id", player.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-cardAlt p-5" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Edit player">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-textBright">Edit player</h2>
            <p className="text-sm text-textMuted">Update personal and contact details.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-textMuted hover:text-textPrimary">Close</button>
        </div>

        <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
          <Field label="Team"><select required value={teamId} onChange={(event) => setTeamId(event.target.value)} className={inputClass}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
          <Field label="First name"><input required autoFocus value={firstName} onChange={(event) => setFirstName(event.target.value)} className={inputClass} /></Field>
          <Field label="Last name"><input required value={lastName} onChange={(event) => setLastName(event.target.value)} className={inputClass} /></Field>
          <Field label="Role">
            <select value={role} onChange={(event) => setRole(event.target.value as Player["role"])} className={inputClass}>
              <option value="player">Player</option>
              <option value="staff">Staff</option>
            </select>
          </Field>
          <Field label="Jersey number"><input type="number" min="0" max="999" value={jerseyNumber} onChange={(event) => setJerseyNumber(event.target.value)} className={inputClass} /></Field>
          <Field label="Position"><input value={position} onChange={(event) => setPosition(event.target.value)} className={inputClass} /></Field>
          <Field label="Date of birth"><input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className={inputClass} /></Field>
          <Field label="Email"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></Field>
          <Field label="Phone numbers"><input value={phoneNumbers} onChange={(event) => setPhoneNumbers(event.target.value)} placeholder="Separate multiple numbers with commas" className={inputClass} /></Field>

          {error && <p className="sm:col-span-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">Could not save: {error}</p>}

          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-textSecondary hover:bg-cardHover">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-2 font-semibold text-page hover:opacity-90 disabled:opacity-50">{saving ? "Saving..." : "Save changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium text-textSecondary"><span>{label}</span>{children}</label>;
}
