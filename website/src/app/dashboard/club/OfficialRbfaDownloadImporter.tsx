"use client";

import { useState } from "react";
import { suggestRbfaTeamId, type RbfaSuggestionTeam } from "@/lib/rbfa-team-suggestions";

type Series = { divisionCode: string; fixtureCount: number; unlinkedCount: number; assignedTeamId: string | null };
type Fixture = { key: string; divisionCode: string; date: string; time: string; homeTeam: string; awayTeam: string; ownIsHome: boolean; linked: boolean; assignedTeamId: string | null };

export function OfficialRbfaDownloadImporter({ clubId, teams, readOnly, onImported }: {
  clubId: string; teams: RbfaSuggestionTeam[]; readOnly: boolean; onImported: () => Promise<void>;
}) {
  const [series, setSeries] = useState<Series[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [fixtureSelections, setFixtureSelections] = useState<Record<string, string>>({});
  const [checkedFixtures, setCheckedFixtures] = useState<Record<string, boolean>>({});
  const [checkedSeries, setCheckedSeries] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function checkDownloads() {
    setBusy("check"); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/club/matches/rbfa-download?clubId=${encodeURIComponent(clubId)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "De officiële downloads konden niet gelezen worden.");
      const nextSeries = body.series as Series[];
      const nextSelections = Object.fromEntries(nextSeries.map(item => [item.divisionCode, item.assignedTeamId || suggestRbfaTeamId(item.divisionCode, teams)]));
      setSeries(nextSeries);
      const nextFixtures = body.fixtures as Fixture[];
      setFixtures(nextFixtures);
      setSelections(nextSelections);
      setFixtureSelections(Object.fromEntries(nextFixtures.map(item => [item.key, item.assignedTeamId || suggestRbfaTeamId(item.divisionCode, teams)])));
      setCheckedFixtures({});
      setCheckedSeries(Object.fromEntries(nextSeries.map(item => {
        const selected = nextSelections[item.divisionCode];
        return [item.divisionCode, !!selected && (!item.assignedTeamId || item.assignedTeamId !== selected || item.unlinkedCount > 0)];
      })));
      const pending = nextSeries.filter(item => !item.assignedTeamId).length;
      setMessage(`${nextSeries.length} officiële reeksen gevonden.${pending ? ` ${pending} wachten op bevestiging.` : " Alle reeksen zijn definitief gekoppeld."}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "De officiële downloads konden niet gelezen worden.");
    } finally { setBusy(""); }
  }

  async function confirmSelectedFixtures() {
    const selectedFixtures = fixtures.filter(item => !item.linked && checkedFixtures[item.key] && fixtureSelections[item.key]);
    if (!selectedFixtures.length) return;
    setBusy("fixtures"); setError(""); setMessage("");
    let imported = 0; let updated = 0;
    try {
      for (const item of selectedFixtures) {
        const response = await fetch("/api/club/matches/rbfa-download", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clubId, fixtureKey: item.key, teamId: fixtureSelections[item.key] })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || `De wedstrijd van ${item.date} kon niet worden geïmporteerd.`);
        imported += body.imported ?? 0; updated += body.updated ?? 0;
        setFixtures(current => current.map(row => row.key === item.key ? { ...row, linked: true } : row));
        setCheckedFixtures(current => ({ ...current, [item.key]: false }));
      }
      setMessage(`${selectedFixtures.length} wedstrijd(en) verwerkt. ${imported} toegevoegd, ${updated} bijgewerkt.`);
      await onImported();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "De geselecteerde wedstrijden konden niet worden geïmporteerd.");
      await onImported();
    } finally { setBusy(""); }
  }

  async function confirmSelectedSeries() {
    const selectedSeries = series.filter(item => {
      const teamId = selections[item.divisionCode];
      const changed = teamId !== (item.assignedTeamId ?? "");
      return checkedSeries[item.divisionCode] && !!teamId && (!item.assignedTeamId || changed || item.unlinkedCount > 0);
    });
    if (!selectedSeries.length) return;

    setBusy("selected"); setError(""); setMessage("");
    let imported = 0;
    let updated = 0;
    const confirmedCodes: string[] = [];
    try {
      for (const item of selectedSeries) {
        const teamId = selections[item.divisionCode];
        const response = await fetch("/api/club/matches/rbfa-download", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clubId, divisionCode: item.divisionCode, teamId })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || `De wedstrijden uit ${item.divisionCode} konden niet worden goedgekeurd.`);
        imported += body.imported ?? 0;
        updated += body.updated ?? 0;
        confirmedCodes.push(item.divisionCode);
        setSeries(current => current.map(row => row.divisionCode === item.divisionCode ? { ...row, assignedTeamId: teamId, unlinkedCount: 0 } : row));
        setCheckedSeries(current => ({ ...current, [item.divisionCode]: false }));
      }
      setMessage(`${selectedSeries.length} ${selectedSeries.length === 1 ? "aangevinkte reeks is" : "aangevinkte reeksen zijn"} goedgekeurd. ${imported} wedstrijden toegevoegd, ${updated} bijgewerkt.`);
      await onImported();
    } catch (reason) {
      const completed = confirmedCodes.length ? ` ${confirmedCodes.length} ${confirmedCodes.length === 1 ? "reeks werd" : "reeksen werden"} al verwerkt.` : "";
      setError(`${reason instanceof Error ? reason.message : "De aangevinkte wedstrijden konden niet worden goedgekeurd."}${completed}`);
      if (confirmedCodes.length) await onImported();
    } finally { setBusy(""); }
  }

  return <div className="rounded-lg border border-borderSubtle bg-cardDeep p-4">
    <h3 className="font-semibold text-textPrimary">Officiële reeksen koppelen</h3>
    <p className="mt-1 text-sm text-textMuted">SVS groepeert de Voetbal Vlaanderen-download per DIV-reeks. Controleer het voorstel of kies een andere ploeg; na bevestiging worden bestaande en nieuwe wedstrijden uit die reeks automatisch bij die ploeg gezet.</p>
    <button type="button" disabled={readOnly || !!busy || !clubId} onClick={() => void checkDownloads()} className="mt-3 rounded-lg bg-button px-4 py-2 text-sm font-semibold text-textPrimary disabled:cursor-not-allowed disabled:opacity-50">{busy === "check" ? "Reeksen zoeken…" : "Officiële reeksen controleren"}</button>
    {message && <p className="mt-3 text-sm text-accent">{message}</p>}
    {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    {!!series.length && <div className="mt-4 overflow-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-cardDeep text-xs uppercase text-textMuted"><tr><th className="p-3">DIV-reeks</th><th className="p-3">Wedstrijden</th><th className="p-3">Ploeg</th><th className="p-3">Status</th><th className="p-3 text-center">Goedkeuren</th></tr></thead>
        <tbody className="divide-y divide-borderSubtle">{series.map(item => {
          const selected = selections[item.divisionCode] ?? "";
          const changed = selected !== (item.assignedTeamId ?? "");
          return <tr key={item.divisionCode} className={!item.assignedTeamId ? "bg-amber-500/5" : ""}>
            <td className="p-3 font-bold text-textPrimary">{item.divisionCode || "Zonder reeks"}</td>
            <td className="p-3 text-textMuted">{item.fixtureCount}{item.unlinkedCount ? ` · ${item.unlinkedCount} nog te importeren` : ""}</td>
            <td className="p-3"><select value={selected} disabled={readOnly || !!busy} onChange={event => {
              const teamId = event.target.value;
              setSelections(current => ({ ...current, [item.divisionCode]: teamId }));
              setCheckedSeries(current => ({ ...current, [item.divisionCode]: !!teamId && (!item.assignedTeamId || teamId !== item.assignedTeamId || item.unlinkedCount > 0) }));
            }} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary disabled:cursor-not-allowed disabled:opacity-50">
              <option value="">Kies ploeg…</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select></td>
            <td className="p-3">{item.assignedTeamId ? <span className="text-emerald-300">Definitief bevestigd</span> : selected ? <span className="text-amber-300">Voorstel</span> : <span className="text-textMuted">Geen voorstel</span>}</td>
            <td className="p-3 text-center"><input type="checkbox" aria-label={`Keur wedstrijden uit ${item.divisionCode} goed`} checked={checkedSeries[item.divisionCode] ?? false} disabled={readOnly || !!busy || !selected || (!!item.assignedTeamId && !changed && item.unlinkedCount === 0)} onChange={event => setCheckedSeries(current => ({ ...current, [item.divisionCode]: event.target.checked }))} className="h-5 w-5 accent-accent disabled:cursor-not-allowed disabled:opacity-40" /></td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
    {!!series.length && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borderSubtle bg-cardDeep p-3">
      <p className="text-sm text-textMuted">{series.filter(item => checkedSeries[item.divisionCode] && !!selections[item.divisionCode] && (!item.assignedTeamId || selections[item.divisionCode] !== item.assignedTeamId || item.unlinkedCount > 0)).length} aangevinkt</p>
      <button type="button" disabled={readOnly || !!busy || !series.some(item => checkedSeries[item.divisionCode] && !!selections[item.divisionCode] && (!item.assignedTeamId || selections[item.divisionCode] !== item.assignedTeamId || item.unlinkedCount > 0))} onClick={() => void confirmSelectedSeries()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page disabled:cursor-not-allowed disabled:opacity-50">{busy === "selected" ? "Aangevinkte wedstrijden goedkeuren…" : "Keur alle aangevinkte wedstrijden goed"}</button>
    </div>}
    {!!fixtures.length && <details className="mt-4 rounded-lg border border-border bg-card" open>
      <summary className="cursor-pointer px-4 py-3 font-semibold text-textPrimary">Wedstrijd per wedstrijd koppelen</summary>
      <p className="px-4 pb-3 text-sm text-textMuted">Kies voor iedere nog niet geïmporteerde wedstrijd afzonderlijk de juiste SVS-ploeg. Reeds geïmporteerde wedstrijden blijven zichtbaar maar kunnen niet dubbel worden toegevoegd.</p>
      <div className="overflow-auto border-t border-border"><table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-cardDeep text-xs uppercase text-textMuted"><tr><th className="p-3">Datum</th><th className="p-3">Wedstrijd</th><th className="p-3">Reeks</th><th className="p-3">SVS-ploeg</th><th className="p-3">Status</th><th className="p-3 text-center">Importeren</th></tr></thead>
        <tbody className="divide-y divide-borderSubtle">{fixtures.map(item => {
          const selected = fixtureSelections[item.key] ?? "";
          return <tr key={item.key} className={item.linked ? "opacity-60" : ""}>
            <td className="whitespace-nowrap p-3 text-textSecondary">{new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${item.date}T12:00:00`))}<div className="text-xs text-textMuted">{item.time}</div></td>
            <td className="p-3 text-textPrimary"><strong>{item.homeTeam}</strong><span className="mx-2 text-textMuted">–</span><strong>{item.awayTeam}</strong><div className="mt-0.5 text-xs text-textMuted">{item.ownIsHome ? "Thuiswedstrijd" : "Uitwedstrijd"}</div></td>
            <td className="p-3 text-textSecondary">{item.divisionCode}</td>
            <td className="p-3"><select value={selected} disabled={readOnly || !!busy || item.linked} onChange={event => { const teamId = event.target.value; setFixtureSelections(current => ({ ...current, [item.key]: teamId })); setCheckedFixtures(current => ({ ...current, [item.key]: !!teamId })); }} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary disabled:cursor-not-allowed disabled:opacity-50"><option value="">Kies ploeg…</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></td>
            <td className="p-3">{item.linked ? <span className="text-emerald-300">Reeds geïmporteerd</span> : <span className="text-amber-300">Nog te importeren</span>}</td>
            <td className="p-3 text-center"><input type="checkbox" aria-label={`Importeer wedstrijd ${item.homeTeam} tegen ${item.awayTeam}`} checked={checkedFixtures[item.key] ?? false} disabled={readOnly || !!busy || item.linked || !selected} onChange={event => setCheckedFixtures(current => ({ ...current, [item.key]: event.target.checked }))} className="h-5 w-5 accent-accent disabled:cursor-not-allowed disabled:opacity-40" /></td>
          </tr>;
        })}</tbody>
      </table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3"><p className="text-sm text-textMuted">{fixtures.filter(item => !item.linked && checkedFixtures[item.key] && fixtureSelections[item.key]).length} wedstrijd(en) aangevinkt</p><button type="button" disabled={readOnly || !!busy || !fixtures.some(item => !item.linked && checkedFixtures[item.key] && fixtureSelections[item.key])} onClick={() => void confirmSelectedFixtures()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page disabled:cursor-not-allowed disabled:opacity-50">{busy === "fixtures" ? "Wedstrijden importeren…" : "Importeer aangevinkte wedstrijden"}</button></div>
    </details>}
  </div>;
}
