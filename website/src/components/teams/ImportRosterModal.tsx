"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
import { parseRosterFile, type ImportedPlayerRow } from "@/lib/roster-import";

export function ImportRosterModal({ teamId, clubTeamId, teamName, onClose, onImported }: {
  teamId: string;
  clubTeamId: string | null;
  teamName: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useI18n();
  const [gdprConfirmed, setGdprConfirmed] = useState(false);
  const [players, setPlayers] = useState<ImportedPlayerRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function readFile(file: File) {
    setError("");
    setStatus(t("team.reading"));
    try {
      const imported = await parseRosterFile(file, {
        noRows: t("team.noRows"),
        missingColumns: t("team.missingColumns"),
        noUsablePlayers: t("team.noUsablePlayers")
      });
      setPlayers(imported);
      setFileName(file.name);
      setStatus(t("team.imported", { count: imported.length }));
    } catch (reason) {
      setPlayers([]);
      setStatus("");
      setError(reason instanceof Error ? reason.message : t("team.readFailed"));
    }
  }

  async function save() {
    if (!players.length || saving) return;
    setSaving(true);
    setError("");
    if (clubTeamId) {
      const response = await fetch(`/api/club/teams/${clubTeamId}/roster`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players, source: "excel_import" })
      });
      const body = await response.json().catch(() => null) as { error?: string; saved?: number; failed?: number } | null;
      if (!response.ok) {
        setError(body?.error || t("team.readFailed"));
        setSaving(false);
        return;
      }
    } else {
      const rows = players.map((player) => ({
        team_id: teamId,
        first_name: player.firstName.trim(),
        last_name: player.lastName.trim(),
        date_of_birth: player.dateOfBirth || null,
        email: player.email.trim() || null,
        phone_numbers: player.phoneNumbers.split(",").map((phone) => phone.trim()).filter(Boolean),
        role: "player"
      }));
      const { error: insertError } = await supabase.from("players").insert(rows);
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onImported();
    onClose();
  }

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4" onClick={onClose}>
    <section className="w-full max-w-2xl rounded-xl border border-border bg-cardAlt p-5" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-semibold text-textBright">PSD/Excel importeren</h2><p className="mt-1 text-sm text-textMuted">Voeg spelers toe aan {teamName}. Bestaande clubspelers worden bijgewerkt of hergebruikt.</p></div>
        <button type="button" onClick={onClose} className="text-sm text-textMuted hover:text-textPrimary">{t("common.close")}</button>
      </div>
      <label className="mt-5 flex items-start gap-2 rounded-lg border border-border bg-cardDeep p-3 text-sm text-textSecondary">
        <input type="checkbox" checked={gdprConfirmed} onChange={(event) => setGdprConfirmed(event.target.checked)} className="mt-1" />
        <span>{t("team.gdprConfirm")}</span>
      </label>
      <label className={`mt-4 inline-flex rounded-lg border border-borderButton px-4 py-2 text-sm font-semibold ${gdprConfirmed ? "cursor-pointer bg-button text-textPrimary hover:border-accent" : "cursor-not-allowed text-textMuted opacity-50"}`}>
        {t("team.chooseExcel")}
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={!gdprConfirmed || saving} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = ""; }} />
      </label>
      {fileName && <p className="mt-2 text-xs text-textMuted">{fileName}</p>}
      {status && <p className="mt-2 text-sm text-accent">{status}</p>}
      {!!players.length && <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-border">
        {players.map((player, index) => <div key={`${player.firstName}-${player.lastName}-${index}`} className="flex justify-between gap-3 border-t border-borderSubtle px-3 py-2 first:border-0"><span className="text-sm text-textPrimary">{player.firstName} {player.lastName}</span><span className="text-xs text-textMuted">{player.email}</span></div>)}
      </div>}
      {error && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-textSecondary">{t("common.cancel")}</button>
        <button type="button" disabled={!players.length || saving} onClick={() => void save()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:opacity-50">{saving ? t("common.saving") : `${players.length} spelers toevoegen`}</button>
      </div>
    </section>
  </div>;
}
