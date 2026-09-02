"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PLAYER_TEST_TYPES, formatTestFieldValue } from "@/lib/player-tests";
import { isValidSecondsComponent, isValidVamevalDurationSeconds, toDurationSeconds } from "@/lib/vameval";

type TestRecord = { id: string; player_id: string; test_type: string; tested_on: string; results: Record<string, number>; note: string | null; created_at: string };
type RosterPlayer = { id: string; first_name: string; last_name: string };

export function TeamTests({ teamId }: { teamId: string }) {
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedType, setSelectedType] = useState(Object.keys(PLAYER_TEST_TYPES)[0]);
  const [entryOpen, setEntryOpen] = useState(false);
  const [testedOn, setTestedOn] = useState(new Date().toISOString().slice(0, 10));
  const [simpleValues, setSimpleValues] = useState<Record<string, Record<string, string>>>({});
  const [vamevalValues, setVamevalValues] = useState<Record<string, { minutes: string; seconds: string }>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/teams/${teamId}/tests`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) { setError(body?.error || "Testresultaten konden niet geladen worden."); return; }
    setPlayers(body.players ?? []);
    setTests(body.tests ?? []);
    setCanManage(!!body.canManage);
  }
  useEffect(() => { void load(); }, [teamId]);

  const config = PLAYER_TEST_TYPES[selectedType];
  const entries = useMemo(() => tests.filter((test) => test.test_type === selectedType), [tests, selectedType]);
  const dates = useMemo(() => [...new Set(entries.map((entry) => entry.tested_on))].sort(), [entries]);
  const entryByPlayerAndDate = useMemo(() => {
    const map = new Map<string, TestRecord>();
    for (const entry of entries) map.set(`${entry.player_id}|${entry.tested_on}`, entry);
    return map;
  }, [entries]);

  function openEntry() {
    setSimpleValues({});
    setVamevalValues({});
    setNote("");
    setTestedOn(new Date().toISOString().slice(0, 10));
    setError("");
    setEntryOpen(true);
  }

  function vamevalDuration(playerId: string) {
    const raw = vamevalValues[playerId];
    if (!raw || raw.minutes === "" || raw.seconds === "") return null;
    const minutes = Number(raw.minutes);
    const seconds = Number(raw.seconds);
    if (!Number.isInteger(minutes) || minutes < 0 || !isValidSecondsComponent(seconds)) return null;
    const duration = toDurationSeconds(minutes, seconds);
    return isValidVamevalDurationSeconds(duration) ? duration : null;
  }

  const filledCount = config.kind === "vameval"
    ? players.filter((player) => vamevalDuration(player.id) !== null).length
    : players.filter((player) => Object.values(simpleValues[player.id] ?? {}).some((value) => value.trim() !== "")).length;

  async function submitEntry() {
    setBusy(true);
    setError("");
    const entriesPayload: Record<string, Record<string, number | string>> = {};
    for (const player of players) {
      if (config.kind === "vameval") {
        const duration = vamevalDuration(player.id);
        if (duration !== null) entriesPayload[player.id] = { duration_seconds: duration };
      } else {
        const values = simpleValues[player.id] ?? {};
        if (Object.values(values).some((value) => value.trim() !== "")) entriesPayload[player.id] = values;
      }
    }
    const response = await fetch(`/api/teams/${teamId}/tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testType: selectedType, testedOn, note, entries: entriesPayload }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) { setError(body?.error || "Testresultaten konden niet worden bewaard."); return; }
    setEntryOpen(false);
    await load();
  }

  async function remove(testId: string) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/players/${tests.find((test) => test.id === testId)?.player_id}/tests`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId }) });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) { setError(body?.error || "Testresultaat kon niet worden verwijderd."); return; }
    await load();
  }

  if (loading) return <p className="rounded-xl border border-border bg-card p-5 text-sm text-textMuted">Testresultaten laden...</p>;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap gap-1.5">
          {Object.entries(PLAYER_TEST_TYPES).map(([key, typeConfig]) => (
            <button key={key} type="button" onClick={() => { setSelectedType(key); setEntryOpen(false); }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${selectedType === key ? "bg-accent text-page" : "border border-borderButton text-textSecondary hover:border-accent"}`}>
              {typeConfig.label}
            </button>
          ))}
        </nav>
        {canManage && !entryOpen && <button type="button" onClick={openEntry} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">+ Nieuwe testronde</button>}
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {entryOpen && (
        <div className="mb-5 rounded-xl border border-borderSubtle bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-textSecondary">Datum
              <input type="date" max={new Date().toISOString().slice(0, 10)} value={testedOn} onChange={(event) => setTestedOn(event.target.value)} className={input} />
              <span className="mt-1 block text-xs font-normal text-textMuted">Ook data van vorige seizoenen kunnen hier ingegeven worden.</span>
            </label>
            <label className="flex-1 text-sm text-textSecondary" style={{ minWidth: 200 }}>Notitie (optioneel)
              <input type="text" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} className={input} />
            </label>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-borderSubtle">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead className="bg-cardDeep text-xs uppercase tracking-wide text-textMuted">
                <tr>
                  <th className="px-3 py-2">Speler</th>
                  {config.kind === "simple" ? config.fields.map((field) => <th key={field.key} className="px-3 py-2">{field.label} ({field.unit})</th>)
                    : <th className="px-3 py-2" colSpan={2}>Totale looptijd (min:sec)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-borderSubtle">
                {players.map((player) => (
                  <tr key={player.id}>
                    <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-textPrimary">{player.last_name} {player.first_name}</td>
                    {config.kind === "simple" ? config.fields.map((field) => (
                      <td key={field.key} className="px-3 py-1.5">
                        <input type="number" step="0.1" min={field.min} max={field.max} value={simpleValues[player.id]?.[field.key] ?? ""}
                          onChange={(event) => setSimpleValues((current) => ({ ...current, [player.id]: { ...current[player.id], [field.key]: event.target.value } }))}
                          className={inputCompact} />
                      </td>
                    )) : (
                      <>
                        <td className="px-3 py-1.5">
                          <input type="number" step="1" min={0} placeholder="min" value={vamevalValues[player.id]?.minutes ?? ""}
                            onChange={(event) => setVamevalValues((current) => ({ ...current, [player.id]: { minutes: event.target.value, seconds: current[player.id]?.seconds ?? "" } }))}
                            className={inputCompact} />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" step="1" min={0} max={59} placeholder="sec" value={vamevalValues[player.id]?.seconds ?? ""}
                            onChange={(event) => setVamevalValues((current) => ({ ...current, [player.id]: { minutes: current[player.id]?.minutes ?? "", seconds: event.target.value } }))}
                            className={inputCompact} />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button type="button" disabled={busy || filledCount === 0} onClick={() => void submitEntry()} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? "Bezig..." : `Opslaan voor ${filledCount} speler${filledCount === 1 ? "" : "s"}`}
            </button>
            <button type="button" disabled={busy} onClick={() => setEntryOpen(false)} className="rounded-lg border border-borderButton px-4 py-2 text-sm font-semibold text-textPrimary hover:border-accent">Annuleren</button>
          </div>
        </div>
      )}

      {players.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Geen spelers in dit team.</p>
      ) : dates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Nog geen resultaten voor {config.label.toLowerCase()}.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-accent text-[11px] uppercase tracking-wide text-page">
              <tr>
                <th className="sticky left-0 z-10 bg-accent px-3 py-2">Speler</th>
                {dates.map((date) => <th key={date} className="px-3 py-2 text-center">{new Date(`${date}T12:00:00`).toLocaleDateString("nl-BE")}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-borderSubtle">
              {players.map((player) => (
                <tr key={player.id} className="bg-card hover:bg-cardHover">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-inherit px-3 py-2 font-semibold">
                    <Link href={`/dashboard/teams/players/${player.id}`} className="text-textPrimary underline decoration-accent/60 underline-offset-2 hover:text-accent">{player.last_name} {player.first_name}</Link>
                  </td>
                  {dates.map((date) => {
                    const entry = entryByPlayerAndDate.get(`${player.id}|${date}`);
                    return (
                      <td key={date} className="px-3 py-2 text-center text-textSecondary">
                        {entry ? (
                          <span className="group relative inline-flex items-center gap-1.5">
                            <span>
                              {(config.kind === "simple" ? config.fields : [config.chartField]).map((field) => entry.results[field.key] !== undefined ? formatTestFieldValue(field, entry.results[field.key]) : null).filter(Boolean).join(" · ")}
                            </span>
                            {canManage && <button type="button" title="Verwijderen" aria-label="Verwijderen" disabled={busy} onClick={() => void remove(entry.id)} className="hidden text-xs font-bold text-red-400 hover:text-red-300 group-hover:inline disabled:opacity-40">✕</button>}
                          </span>
                        ) : "–"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const input = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";
const inputCompact = "w-24 rounded-lg border border-border bg-input px-2 py-1 text-textPrimary";
