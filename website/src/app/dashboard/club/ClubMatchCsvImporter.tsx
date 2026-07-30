"use client";

import { useState } from "react";

export function ClubMatchCsvImporter({ teams, readOnly, onImported }: {
  teams: { id: string; name: string }[];
  readOnly: boolean;
  onImported: () => Promise<void>;
}) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function importCsv() {
    if (!teamId || !file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/club/matches/csv-import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, csv: await file.text() })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "De wedstrijden konden niet geïmporteerd worden.");
      setMessage(`${body.imported} nieuwe wedstrijden toegevoegd, ${body.updated} bijgewerkt.`);
      await onImported();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "De wedstrijden konden niet geïmporteerd worden.");
    } finally { setBusy(false); }
  }

  return <div className="mt-4 rounded-lg border border-borderSubtle bg-cardDeep p-4">
    <h3 className="font-semibold text-textPrimary">Wedstrijden importeren uit CSV</h3>
    <p className="mt-1 text-sm text-textMuted">Kies de clubploeg en upload een CSV uit Voetbal Vlaanderen. Een herhaalde import werkt bestaande wedstrijden bij.</p>
    <div className={`mt-3 grid gap-3 ${teams.length > 1 ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
      {teams.length > 1 && <select value={teamId} disabled={readOnly || busy} onChange={(event) => setTeamId(event.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-textPrimary disabled:opacity-60">
        <option value="">Kies een ploeg</option>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>}
      <input type="file" accept=".csv,text/csv" disabled={readOnly || busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary file:mr-3 file:rounded file:border-0 file:bg-button file:px-3 file:py-1 file:text-textPrimary disabled:opacity-60" />
      <button type="button" disabled={readOnly || busy || !teamId || !file} onClick={() => void importCsv()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:opacity-50">{busy ? "Importeren…" : "Importeren"}</button>
    </div>
    {message && <p className="mt-3 text-sm text-accent">{message}</p>}
    {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
  </div>;
}
