"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
import { parseRosterFile, type ImportedPlayerRow as PlayerRow } from "@/lib/roster-import";

const emptyPlayer = (): PlayerRow => ({ firstName: "", lastName: "", dateOfBirth: "", email: "", phoneNumbers: "" });

export function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
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
    setImportStatus(t("team.reading"));
    try {
      const imported = await parseRosterFile(file, {
        noRows: t("team.noRows"),
        missingColumns: t("team.missingColumns"),
        noUsablePlayers: t("team.noUsablePlayers")
      });
      setPlayers(imported);
      setImportStatus(t("team.imported", { count: imported.length }));
    } catch (importError) {
      setImportStatus("");
      setError(importError instanceof Error ? importError.message : t("team.readFailed"));
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError(t("errors.sessionExpired")); setSaving(false); return; }

    const { data: team, error: teamError } = await supabase.from("teams").insert({ coach_id: user.id, name: name.trim() }).select().single();
    if (teamError || !team) { setError(teamError?.message || t("team.createFailed")); setSaving(false); return; }

    // Safe both before and after the database trigger migration is deployed.
    const { error: staffError } = await supabase.from("team_staff_members").upsert(
      { team_id: team.id, user_id: user.id, added_by: user.id },
      { onConflict: "team_id,user_id", ignoreDuplicates: true }
    );
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
          <div><h2 className="font-semibold text-textBright">{t("team.create")}</h2><p className="text-sm text-textMuted">{t("team.createIntro")}</p></div>
          <button type="button" onClick={onClose} className="text-sm text-textMuted hover:text-textPrimary">{t("common.close")}</button>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1"><span className="text-xs uppercase tracking-wide text-textMuted">{t("team.name")}</span><input type="text" placeholder={t("team.name")} value={name} onChange={(event) => setName(event.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" autoFocus required /></label>

          <section className="rounded-xl border border-border bg-cardDeep p-4">
            <h3 className="font-semibold text-textBright">{t("team.importRoster")}</h3>
            <p className="mt-1 text-xs text-textMuted">{t("team.importLocal")}</p>
            <label className="mt-3 flex items-start gap-2 text-sm text-textSecondary"><input type="checkbox" checked={gdprConfirmed} onChange={(event) => setGdprConfirmed(event.target.checked)} className="mt-1" /><span>{t("team.gdprConfirm")}</span></label>
            <label className={`mt-3 inline-flex rounded-lg border border-borderButton px-4 py-2 text-sm font-semibold ${gdprConfirmed ? "cursor-pointer bg-button text-textPrimary hover:border-accent" : "cursor-not-allowed text-textMuted opacity-50"}`}>{t("team.chooseExcel")}<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={!gdprConfirmed} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importRoster(file); event.target.value = ""; }} /></label>
            {importStatus && <p className="mt-2 text-sm text-accent">{importStatus}</p>}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-textBright">{t("team.players", { count: players.filter((player) => player.firstName || player.lastName).length })}</h3><button type="button" onClick={addPlayerRow} className="rounded-lg border border-borderButton px-3 py-1.5 text-sm text-textSecondary hover:border-accent">{t("team.addPlayer")}</button></div>
            <div className="hidden grid-cols-[1fr_1fr_140px_1.4fr_1.2fr] gap-2 px-2 pb-1 text-xs font-bold uppercase tracking-wide text-textMuted md:grid"><span>{t("team.firstName")}</span><span>{t("team.lastName")}</span><span>{t("team.dateOfBirth")}</span><span>{t("auth.email")}</span><span>{t("team.phoneNumbers")}</span></div>
            <div className="space-y-2 pr-1 md:max-h-80 md:overflow-y-auto">
              {players.map((row, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-border bg-card p-2 md:grid-cols-[1fr_1fr_140px_1.4fr_1.2fr]">
                  <input type="text" placeholder={t("team.firstName")} value={row.firstName} onChange={(event) => updatePlayerRow(index, "firstName", event.target.value)} className="min-w-0 rounded-lg border border-border bg-input px-2 py-2 text-sm text-textPrimary" />
                  <input type="text" placeholder={t("team.lastName")} value={row.lastName} onChange={(event) => updatePlayerRow(index, "lastName", event.target.value)} className="min-w-0 rounded-lg border border-border bg-input px-2 py-2 text-sm text-textPrimary" />
                  <input type="date" value={row.dateOfBirth} onChange={(event) => updatePlayerRow(index, "dateOfBirth", event.target.value)} className="min-w-0 rounded-lg border border-border bg-input px-2 py-2 text-sm text-textPrimary" />
                  <input type="email" placeholder={t("auth.email")} value={row.email} onChange={(event) => updatePlayerRow(index, "email", event.target.value)} className="min-w-0 rounded-lg border border-border bg-input px-2 py-2 text-sm text-textPrimary" />
                  <input type="text" placeholder={t("team.phoneNumbers")} value={row.phoneNumbers} onChange={(event) => updatePlayerRow(index, "phoneNumbers", event.target.value)} className="min-w-0 rounded-lg border border-border bg-input px-2 py-2 text-sm text-textPrimary" />
                </div>
              ))}
            </div>
          </section>

          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
          <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-cardAlt px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:border-0 sm:p-0"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-textSecondary hover:bg-cardHover">{t("common.cancel")}</button><button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:cursor-not-allowed disabled:opacity-50">{saving ? t("team.creating") : t("team.create")}</button></div>
        </form>
      </div>
    </div>
  );
}
