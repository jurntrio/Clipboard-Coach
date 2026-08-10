"use client";

import { useMemo, useState } from "react";

type Team = { id: string; name: string };
type Fixture = {
  key: string; division: string; date: string; time: string; homeTeam: string; awayTeam: string;
  ownIsHome: boolean; scoreHome: number | null; scoreAway: number | null; sourceFile: "results" | "designations";
};

function ageToken(value: string) {
  return value.toUpperCase().match(/(?:^|[^A-Z0-9])(U\d{1,2})(?:[^A-Z0-9]|$)/)?.[1] ?? "";
}

function suggestedTeamId(fixture: Fixture, teams: Team[]) {
  const ownName = fixture.ownIsHome ? fixture.homeTeam : fixture.awayTeam;
  const normalizedDivision = fixture.division.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const seniorSuffix = normalizedDivision === "2A"
    ? "A"
    : ownName.match(/KM\s+Torhout\s+([AB])\s*$/i)?.[1]?.toUpperCase();
  if (seniorSuffix) {
    const senior = teams.filter(team => team.name.toUpperCase() === `KMT ${seniorSuffix}`);
    if (senior.length === 1) return senior[0].id;
  }
  const age = ageToken(fixture.division) || ageToken(ownName);
  if (!age) return "";
  const candidates = teams.filter(team => ageToken(team.name) === age);
  return candidates.length === 1 ? candidates[0].id : "";
}

export function OfficialRbfaDownloadImporter({ clubId, teams, readOnly, onImported }: {
  clubId: string; teams: Team[]; readOnly: boolean; onImported: () => Promise<void>;
}) {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const unresolved = useMemo(() => fixtures.filter(fixture => !assignments[fixture.key]).length, [fixtures, assignments]);
  const assignedCount = fixtures.length - unresolved;

  async function checkDownloads() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/club/matches/rbfa-download?clubId=${encodeURIComponent(clubId)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "De officiële downloads konden niet gelezen worden.");
      const nextFixtures = body.fixtures as Fixture[];
      setFixtures(nextFixtures);
      setAssignments(Object.fromEntries(nextFixtures.map(fixture => [fixture.key, suggestedTeamId(fixture, teams)]).filter(([, teamId]) => teamId)));
      setMessage(`${nextFixtures.length} SVS-wedstrijden gevonden. Controleer de ploegtoewijzingen vóór import.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "De officiële downloads konden niet gelezen worden.");
    } finally { setBusy(false); }
  }

  async function importAssigned() {
    const selected = fixtures.filter(fixture => assignments[fixture.key]).map(fixture => ({ fixtureKey: fixture.key, teamId: assignments[fixture.key] }));
    if (!selected.length) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/club/matches/rbfa-download", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, assignments: selected })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "De wedstrijden konden niet geïmporteerd worden.");
      setMessage(`${body.imported} wedstrijden toegevoegd en ${body.updated} bijgewerkt.${unresolved ? ` ${unresolved} wachten nog op een ploegkeuze.` : ""}`);
      await onImported();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "De wedstrijden konden niet geïmporteerd worden.");
    } finally { setBusy(false); }
  }

  return <div className="rounded-lg border border-borderSubtle bg-cardDeep p-4">
    <h3 className="font-semibold text-textPrimary">Officiële Voetbal Vlaanderen-downloads</h3>
    <p className="mt-1 text-sm text-textMuted">Downloadt de officiële ZIP-bestanden, filtert uitsluitend op het stamnummer van deze club en laat dubbelzinnige jeugdwedstrijden eerst aan de juiste ploeg koppelen.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={readOnly || busy || !clubId} onClick={() => void checkDownloads()} className="rounded-lg bg-button px-4 py-2 text-sm font-semibold text-textPrimary disabled:opacity-50">{busy ? "Controleren…" : "Officiële downloads controleren"}</button>
      {!!fixtures.length && <button type="button" disabled={readOnly || busy || assignedCount === 0} onClick={() => void importAssigned()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page disabled:opacity-50">Bevestigen en {assignedCount} toegewezen wedstrijd{assignedCount === 1 ? "" : "en"} importeren</button>}
    </div>
    {message && <p className="mt-3 text-sm text-accent">{message}</p>}
    {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    {!!fixtures.length && <div className="mt-4 max-h-[34rem] overflow-auto rounded-lg border border-border">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="sticky top-0 bg-cardDeep text-xs uppercase text-textMuted"><tr><th className="p-3">Datum</th><th className="p-3">Reeks</th><th className="p-3">Wedstrijd</th><th className="p-3">SVS-ploeg</th></tr></thead>
        <tbody className="divide-y divide-borderSubtle">
          {[...fixtures].sort((a, b) => Number(!!assignments[a.key]) - Number(!!assignments[b.key]) || `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map(fixture => <tr key={fixture.key} className={!assignments[fixture.key] ? "bg-amber-500/5" : ""}>
            <td className="p-3 whitespace-nowrap">{fixture.date} · {fixture.time}</td>
            <td className="p-3 text-textMuted">{fixture.division || "Vriendschappelijk"}</td>
            <td className="p-3 font-medium text-textPrimary">{fixture.homeTeam} – {fixture.awayTeam}</td>
            <td className="p-3"><select value={assignments[fixture.key] ?? ""} disabled={readOnly || busy} onChange={event => setAssignments(current => ({ ...current, [fixture.key]: event.target.value }))} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary">
              <option value="">Kies ploeg…</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select></td>
          </tr>)}
        </tbody>
      </table>
    </div>}
    {!!fixtures.length && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borderSubtle bg-cardDeep p-3">
      <p className="text-sm text-textMuted">{assignedCount} toegewezen · {unresolved} nog te koppelen</p>
      <button type="button" disabled={readOnly || busy || assignedCount === 0} onClick={() => void importAssigned()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page disabled:opacity-50">Bevestigen en importeren</button>
    </div>}
  </div>;
}
