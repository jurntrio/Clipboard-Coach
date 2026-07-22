"use client";

import { useState } from "react";
import { readSheet } from "read-excel-file/browser";
import { createClient } from "@/lib/supabase/client";

type PlayerRow = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phoneNumbers: string;
};

const emptyPlayer = (): PlayerRow => ({ firstName: "", lastName: "", dateOfBirth: "", email: "", phoneNumbers: "" });

function textValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizedHeader(value: unknown) {
  return textValue(value).toLocaleLowerCase("nl-BE").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const match = textValue(value).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
}

function phoneValue(value: unknown) {
  const raw = textValue(value);
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits === "14" || digits.length < 8) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("32")) return `+${digits}`;
  return raw;
}

export function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [players, setPlayers] = useState<PlayerRow[]>([emptyPlayer()]);
  const [gdprConfirmed, setGdprConfirmed] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  function updatePlayerRow(index: number, field: keyof PlayerRow, value: string) {
    setPlayers((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addPlayerRow() {
    setPlayers((current) => [...current, emptyPlayer()]);
  }

  async function importRoster(file: File) {
    if (!gdprConfirmed) return;
    setError("");
    setImportStatus("Reading player list…");
    try {
      const rows = await readSheet(file);
      if (rows.length < 2) throw new Error("No player rows were found in this file.");
      const headers = rows[0].map(normalizedHeader);
      const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
      const lastNameIndex = column("naam", "achternaam", "familienaam");
      const firstNameIndex = column("voornaam", "firstname");
      const emailIndex = column("emailspeler", "email", "emailadres");
      const birthDateIndex = column("geboortedatum", "geboortedate", "birthdate");
      const phoneIndexes = [column("telefoonspeler", "gsmspeler", "gsm"), column("telefoon2", "gsm2"), column("telefoon3", "gsm3")].filter((index) => index >= 0);
      if (firstNameIndex < 0 || lastNameIndex < 0) throw new Error("The columns ‘Voornaam’ and ‘Naam’ could not be found.");

      const imported = rows.slice(1).map((row) => {
        const phones = Array.from(new Set(phoneIndexes.map((index) => phoneValue(row[index])).filter(Boolean)));
        return {
          firstName: textValue(row[firstNameIndex]),
          lastName: textValue(row[lastNameIndex]),
          dateOfBirth: birthDateIndex >= 0 ? dateValue(row[birthDateIndex]) : "",
          email: emailIndex >= 0 ? textValue(row[emailIndex]) : "",
          phoneNumbers: phones.join(", ")
        };
      }).filter((row) => row.firstName || row.lastName);

      if (!imported.length) throw new Error("No usable players were found in this file.");
      setPlayers(imported);
      setImportStatus(`${imported.length} players imported. Check the list before creating the team.`);
    } catch (importError) {
      setImportStatus("");
      setError(importError instanceof Error ? importError.message : "The player list could not be read.");
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Your session has expired."); setSaving(false); return; }

    const { data: team, error: teamError } = await supabase.from("teams").insert({ coach_id: user.id, name: name.trim() }).select().single();
    if (teamError || !team) { setError(teamError?.message || "The team could not be created."); setSaving(false); return; }

    const { error: staffError } = await supabase.from("team_staff_members").insert({ team_id: team.id, user_id: user.id, added_by: user.id });
    if (staffError) { await supabase.from("teams").delete().eq("id", team.id); setError(staffError.message); setSaving(false); return; }

    const rows = players.filter((row) => row.firstName.trim() && row.lastName.trim()).map((row) => ({
      team_id: team.id,
      first_name: row.firstName.trim(),
      last_name: row.lastName.trim(),
      email: row.email.trim() || null,
      date_of_birth: row.dateOfBirth || null,
      phone_numbers: row.phoneNumbers.split(",").map((phone) => phone.trim()).filter(Boolean)
    }));
    if (rows.length) {
      const { error: playerError } = await supabase.from("players").insert(rows);
      if (playerError) { await supabase.from("teams").delete().eq("id", team.id); setError(playerError.message); setSaving(false); return; }
    }

    setSaving(false);
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 sm:grid sm:place-items-center sm:p-4" onClick={onClose}>
      <div className="mx-auto my-3 w-full max-w-5xl rounded-xl border border-border bg-cardAlt p-4 sm:my-0 sm:max-h-[calc(100dvh-2rem)] sm:overflow-y-auto sm:p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div><h2 className="font-semibold text-textBright">Create Team</h2><p className="text-sm text-textMuted">Add players manually or import a ProSoccerData Excel list.</p></div>
          <button type="button" onClick={onClose} className="text-sm text-textMuted hover:text-textPrimary">Close</button>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1"><span className="text-xs uppercase tracking-wide text-textMuted">Team name</span><input type="text" placeholder="Team name" value={name} onChange={(event) => setName(event.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" autoFocus required /></label>

          <section className="rounded-xl border border-border bg-cardDeep p-4">
            <h3 className="font-semibold text-textBright">Import player list</h3>
            <p className="mt-1 text-xs text-textMuted">The file is read locally for preview and is only saved after you create the team.</p>
            <label className="mt-3 flex items-start gap-2 text-sm text-textSecondary"><input type="checkbox" checked={gdprConfirmed} onChange={(event) => setGdprConfirmed(event.target.checked)} className="mt-1" /><span>I confirm that I have permission or another valid legal basis to use and store these players’ personal data.</span></label>
            <label className={`mt-3 inline-flex rounded-lg border border-borderButton px-4 py-2 text-sm font-semibold ${gdprConfirmed ? "cursor-pointer bg-button text-textPrimary hover:border-accent" : "cursor-not-allowed text-textMuted opacity-50"}`}>Choose Excel file<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={!gdprConfirmed} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importRoster(file); event.target.value = ""; }} /></label>
            {importStatus && <p className="mt-2 text-sm text-accent">{importStatus}</p>}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-textBright">Players ({players.filter((player) => player.firstName || player.lastName).length})</h3><button type="button" onClick={addPlayerRow} className="rounded-lg border border-borderButton px-3 py-1.5 text-sm text-textSecondary hover:border-accent">+ Add player</button></div>
            <div className="hidden grid-cols-[1fr_1fr_140px_1.4fr_1.2fr] gap-2 px-2 pb-1 text-xs font-bold uppercase tracking-wide text-textMuted md:grid"><span>First name</span><span>Last name</span><span>Date of birth</span><span>Email</span><span>Phone numbers</span></div>
            <div className="space-y-2 pr-1 md:max-h-80 md:overflow-y-auto">
              {players.map((row, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-border bg-card p-2 md:grid-cols-[1fr_1fr_140px_1.4fr_1.2fr]">
                  <input type="text" placeholder="First name" value={row.firstName} onChange={(event) => updatePlayerRow(index, "firstName", event.target.value)} className="min-w-0 rounded-lg border border-border bg-input px-2 py-2 text-sm text-textPrimary" />
                  <input type="text" placeholder="Last name" value={row.lastName} onChange={(event) => updatePlayerRow(index, "lastName", event.target.value)} className="min-w-0 rounded-lg border border-border bg-input px-2 py-2 text-sm text-textPrimary" />
                  <input type="date" value={row.dateOfBirth} onChange={(event) => updatePlayerRow(index, "dateOfBirth", event.target.value)} className="min-w-0 rounded-lg border border-border bg-input px-2 py-2 text-sm text-textPrimary" />
                  <input type="email" placeholder="Email" value={row.email} onChange={(event) => updatePlayerRow(index, "email", event.target.value)} className="min-w-0 rounded-lg border border-border bg-input px-2 py-2 text-sm text-textPrimary" />
                  <input type="text" placeholder="Phone numbers" value={row.phoneNumbers} onChange={(event) => updatePlayerRow(index, "phoneNumbers", event.target.value)} className="min-w-0 rounded-lg border border-border bg-input px-2 py-2 text-sm text-textPrimary" />
                </div>
              ))}
            </div>
          </section>

          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
          <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-cardAlt px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:border-0 sm:p-0"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-textSecondary hover:bg-cardHover">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:opacity-50">{saving ? "Creating…" : "Create team"}</button></div>
        </form>
      </div>
    </div>
  );
}
