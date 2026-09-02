"use client";
import { useEffect, useState } from "react";
import { PLAYER_TEST_TYPES } from "@/lib/player-tests";
import { calculateMasTrainingZones, calculateVamevalMas, formatMasKmh, formatTestDuration, isValidSecondsComponent, isValidVamevalDurationSeconds, toDurationSeconds, type TrainingZone } from "@/lib/vameval";

type TestRecord = { id: string; test_type: string; tested_on: string; results: Record<string, number>; note: string | null; created_at: string };

const lineColors = ["#7dd3fc", "#fca5a5", "#86efac", "#fcd34d"];

export function PlayerTests({ playerId, focusType }: { playerId: string; focusType?: string }) {
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedType, setSelectedType] = useState(focusType && PLAYER_TEST_TYPES[focusType] ? focusType : Object.keys(PLAYER_TEST_TYPES)[0]);
  const [showChart, setShowChart] = useState(false);
  const [testedOn, setTestedOn] = useState(new Date().toISOString().slice(0, 10));
  const [values, setValues] = useState<Record<string, string>>({});
  const [vamevalMinutes, setVamevalMinutes] = useState("");
  const [vamevalSeconds, setVamevalSeconds] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedZonesId, setExpandedZonesId] = useState<string | null>(null);
  const [autoExpanded, setAutoExpanded] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/players/${playerId}/tests`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) { setError(body?.error || "Testresultaten konden niet geladen worden."); return; }
    setTests(body.tests ?? []);
    setCanManage(!!body.canManage);
  }
  useEffect(() => { void load(); }, [playerId]);

  const config = PLAYER_TEST_TYPES[selectedType];
  const entries = tests.filter((test) => test.test_type === selectedType);

  useEffect(() => {
    if (focusType === "vameval" && !autoExpanded && entries.length) {
      setExpandedZonesId(entries[entries.length - 1].id);
      setAutoExpanded(true);
    }
  }, [focusType, autoExpanded, entries]);

  const vamevalMinutesValue = Number(vamevalMinutes);
  const vamevalSecondsValue = Number(vamevalSeconds);
  const vamevalDurationSeconds = toDurationSeconds(Number.isFinite(vamevalMinutesValue) ? vamevalMinutesValue : 0, Number.isFinite(vamevalSecondsValue) ? vamevalSecondsValue : 0);
  const vamevalDurationValid = vamevalMinutes !== "" && vamevalSeconds !== "" && Number.isInteger(vamevalMinutesValue) && vamevalMinutesValue >= 0 && isValidSecondsComponent(vamevalSecondsValue) && isValidVamevalDurationSeconds(vamevalDurationSeconds);
  const previewMas = vamevalDurationValid ? calculateVamevalMas(vamevalDurationSeconds) : null;

  async function submit() {
    setBusy(true);
    setError("");
    const results = config.kind === "vameval" ? { duration_seconds: vamevalDurationSeconds } : values;
    const response = await fetch(`/api/players/${playerId}/tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testType: selectedType, testedOn, note, results }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) { setError(body?.error || "Testresultaat kon niet worden bewaard."); return; }
    setValues({});
    setVamevalMinutes("");
    setVamevalSeconds("");
    setNote("");
    await load();
  }

  async function remove(testId: string) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/players/${playerId}/tests`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId }) });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) { setError(body?.error || "Testresultaat kon niet worden verwijderd."); return; }
    await load();
  }

  const canSubmit = config.kind === "vameval" ? vamevalDurationValid : Object.values(values).some((value) => value.trim() !== "");

  return (
    <section className="rounded-xl border border-border bg-cardDeep p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-textBright">Testen</h2>
      </div>
      <nav className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(PLAYER_TEST_TYPES).map(([key, typeConfig]) => (
          <button key={key} type="button" onClick={() => { setSelectedType(key); setShowChart(false); }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${selectedType === key ? "bg-accent text-page" : "border border-borderButton text-textSecondary hover:border-accent"}`}>
            {typeConfig.label}
          </button>
        ))}
      </nav>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {canManage && (
        <div className="mt-4 rounded-xl border border-borderSubtle bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-textSecondary">Datum
              <input type="date" max={new Date().toISOString().slice(0, 10)} value={testedOn} onChange={(event) => setTestedOn(event.target.value)} className={input} />
            </label>
            <div />
            {config.kind === "simple" ? (
              config.fields.map((field) => (
                <label key={field.key} className="text-sm text-textSecondary">{field.label} ({field.unit})
                  <input type="number" step="0.1" min={field.min} max={field.max} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className={input} />
                </label>
              ))
            ) : (
              <>
                <label className="text-sm text-textSecondary">Totale looptijd — minuten
                  <input type="number" step="1" min={0} value={vamevalMinutes} onChange={(event) => setVamevalMinutes(event.target.value)} className={input} />
                </label>
                <label className="text-sm text-textSecondary">Totale looptijd — seconden (0-59)
                  <input type="number" step="1" min={0} max={59} value={vamevalSeconds} onChange={(event) => setVamevalSeconds(event.target.value)} className={input} />
                </label>
              </>
            )}
            <label className="text-sm text-textSecondary sm:col-span-2">Notitie (optioneel)
              <textarea maxLength={500} rows={2} value={note} onChange={(event) => setNote(event.target.value)} className={input} />
            </label>
          </div>

          {config.kind === "vameval" && (
            <div className="mt-3 rounded-lg border border-dashed border-border p-3">
              {previewMas !== null ? (
                <>
                  <p className="text-sm font-semibold text-textPrimary">Berekende MAS: <span className="text-accent">{formatMasKmh(previewMas)} km/u</span></p>
                  <ZoneTable zones={calculateMasTrainingZones(previewMas)} />
                </>
              ) : (
                <p className="text-sm text-textMuted">Vul een geldige totale looptijd in (minstens 2:00) om de MAS en trainingszones te zien.</p>
              )}
            </div>
          )}

          <div className="mt-3">
            <button type="button" disabled={busy || !canSubmit} onClick={() => void submit()} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? "Bezig..." : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-accentDim px-2 py-0.5 text-xs text-accent">{entries.length}</span>
          {entries.length >= 2 && (
            <button type="button" onClick={() => setShowChart((current) => !current)} className="rounded-lg border border-borderButton px-3 py-1.5 text-xs font-semibold text-accent transition hover:border-accent">
              {showChart ? "Verberg grafiek" : "Bekijk grafiek"}
            </button>
          )}
        </div>

        {showChart && entries.length >= 2 && <TestChart entries={entries} fields={config.kind === "simple" ? config.fields : [config.chartField]} />}

        {loading ? (
          <p className="text-sm text-textMuted">Testresultaten laden...</p>
        ) : entries.length ? (
          <div className="space-y-2">
            {[...entries].reverse().map((entry) => (
              <div key={entry.id} className="rounded-lg border border-borderSubtle bg-card px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-textPrimary">{new Date(`${entry.tested_on}T12:00:00`).toLocaleDateString("nl-BE")}</span>
                    {config.kind === "simple" ? (
                      <span className="ml-3 text-textSecondary">{config.fields.map((field) => entry.results[field.key] !== undefined ? `${field.label}: ${entry.results[field.key]} ${field.unit}` : null).filter(Boolean).join(" · ")}</span>
                    ) : (
                      <span className="ml-3 text-textSecondary">Looptijd: {formatTestDuration(entry.results.duration_seconds)} · MAS: {formatMasKmh(entry.results.mas_kmh)} km/u</span>
                    )}
                    {entry.note && <p className="mt-1 text-xs text-textMuted">{entry.note}</p>}
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    {config.kind === "vameval" && (
                      <button type="button" onClick={() => setExpandedZonesId((current) => current === entry.id ? null : entry.id)} className="rounded-lg border border-borderButton px-2.5 py-1 text-xs font-semibold text-accent hover:border-accent">
                        {expandedZonesId === entry.id ? "Verberg zones" : "Bekijk zones"}
                      </button>
                    )}
                    {canManage && <button type="button" disabled={busy} onClick={() => void remove(entry.id)} className="rounded-lg border border-red-500/40 px-2.5 py-1 text-xs font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-40">Verwijderen</button>}
                  </div>
                </div>
                {config.kind === "vameval" && expandedZonesId === entry.id && <ZoneTable zones={calculateMasTrainingZones(entry.results.mas_kmh)} />}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Nog geen resultaten voor {config.label.toLowerCase()}.</p>
        )}
      </div>
    </section>
  );
}

function ZoneTable({ zones }: { zones: TrainingZone[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left text-xs">
        <thead>
          <tr className="text-textMuted">
            <th className="pb-1 pr-3 font-semibold uppercase tracking-wide">Zone</th>
            <th className="pb-1 pr-3 font-semibold uppercase tracking-wide">Trainingsvorm</th>
            <th className="pb-1 pr-3 font-semibold uppercase tracking-wide">%</th>
            <th className="pb-1 pr-3 font-semibold uppercase tracking-wide">km/u</th>
            <th className="pb-1 font-semibold uppercase tracking-wide">Doel</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => (
            <tr key={zone.zone} className="border-t border-borderSubtle">
              <td className="py-1.5 pr-3 font-semibold text-textPrimary">{zone.name}</td>
              <td className="py-1.5 pr-3 text-textPrimary">{zone.trainingForm}</td>
              <td className="py-1.5 pr-3 text-textSecondary">{zone.percentMin}-{zone.percentMax}%</td>
              <td className="py-1.5 pr-3 text-textSecondary">{zone.lowerKmh.toFixed(1)}-{zone.upperKmh.toFixed(1)}</td>
              <td className="py-1.5 text-textMuted">{zone.goal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TestChart({ entries, fields }: { entries: TestRecord[]; fields: { key: string; label: string; unit: string }[] }) {
  const width = 600, height = 220, padding = 32;
  const points = entries.map((entry) => ({ time: new Date(`${entry.tested_on}T12:00:00`).getTime(), results: entry.results }));
  const minTime = Math.min(...points.map((p) => p.time));
  const maxTime = Math.max(...points.map((p) => p.time));
  const timeRange = maxTime - minTime || 1;
  const x = (time: number) => padding + ((time - minTime) / timeRange) * (width - padding * 2);

  return (
    <div className="mb-4 overflow-x-auto rounded-xl border border-borderSubtle bg-card p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[480px]">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border)" strokeWidth={1} />
        {fields.map((field, fieldIndex) => {
          const fieldValues = points.map((p) => p.results[field.key]).filter((v): v is number => typeof v === "number");
          if (fieldValues.length < 2) return null;
          const min = Math.min(...fieldValues), max = Math.max(...fieldValues);
          const range = max - min || 1;
          const y = (value: number) => height - padding - ((value - min) / range) * (height - padding * 2);
          const path = points.filter((p) => typeof p.results[field.key] === "number").map((p) => `${x(p.time)},${y(p.results[field.key])}`).join(" ");
          const color = lineColors[fieldIndex % lineColors.length];
          return (
            <g key={field.key}>
              <polyline points={path} fill="none" stroke={color} strokeWidth={2} />
              {points.filter((p) => typeof p.results[field.key] === "number").map((p, i) => <circle key={i} cx={x(p.time)} cy={y(p.results[field.key])} r={3} fill={color} />)}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3">
        {fields.map((field, fieldIndex) => (
          <span key={field.key} className="flex items-center gap-1.5 text-xs text-textSecondary">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lineColors[fieldIndex % lineColors.length] }} />
            {field.label} ({field.unit})
          </span>
        ))}
      </div>
    </div>
  );
}

const input = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";
