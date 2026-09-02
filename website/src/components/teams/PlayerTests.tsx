"use client";
import { useEffect, useState } from "react";
import { PLAYER_TEST_TYPES, formatTestFieldValue, type PlayerTestTypeConfig } from "@/lib/player-tests";
import { calculateMasTrainingZones, formatTestDuration, type TrainingZone } from "@/lib/vameval";

type TestRecord = { id: string; test_type: string; tested_on: string; results: Record<string, number>; note: string | null; created_at: string };

const lineColors = ["#7dd3fc", "#fca5a5", "#86efac", "#fcd34d"];

// Read-only: test results are entered per team, in bulk, on the club's Testen tab
// (see TeamTests.tsx) — not per individual player.
export function PlayerTests({ playerId, focusType }: { playerId: string; focusType?: string }) {
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedZonesId, setExpandedZonesId] = useState<string | null>(null);
  const [autoExpanded, setAutoExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/players/${playerId}/tests`, { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: await response.json().catch(() => null) }))
      .then(({ ok, body }) => { if (!ok) { setError(body?.error || "Testresultaten konden niet geladen worden."); return; } setTests(body.tests ?? []); })
      .finally(() => setLoading(false));
  }, [playerId]);

  const vamevalEntries = tests.filter((test) => test.test_type === "vameval");
  useEffect(() => {
    if (focusType === "vameval" && !autoExpanded && vamevalEntries.length) {
      setExpandedZonesId(vamevalEntries[vamevalEntries.length - 1].id);
      setAutoExpanded(true);
    }
  }, [focusType, autoExpanded, vamevalEntries]);

  return (
    <section className="rounded-xl border border-border bg-cardDeep p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-textBright">Testen</h2>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {loading ? (
        <p className="mt-3 text-sm text-textMuted">Testresultaten laden...</p>
      ) : (
        <div className="mt-4 space-y-4">
          {Object.entries(PLAYER_TEST_TYPES).map(([key, config]) => (
            <TestTypeRow key={key} config={config} entries={tests.filter((test) => test.test_type === key)} expandedZonesId={expandedZonesId} onToggleZones={(id) => setExpandedZonesId((current) => current === id ? null : id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function TestTypeRow({ config, entries, expandedZonesId, onToggleZones }: { config: PlayerTestTypeConfig; entries: TestRecord[]; expandedZonesId: string | null; onToggleZones: (id: string) => void }) {
  const chartField = config.kind === "simple" ? config.fields[0] : config.chartField;
  const chartFieldEntries = entries.filter((entry) => typeof entry.results[chartField.key] === "number");
  const expandedEntry = entries.find((entry) => entry.id === expandedZonesId);

  return (
    <div className="rounded-xl border border-borderSubtle bg-card p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-textBright">{config.label}</h3>
        <span className="rounded-full bg-accentDim px-2 py-0.5 text-xs text-accent">{entries.length}</span>
      </div>

      {!entries.length ? (
        <p className="mt-2 text-sm text-textMuted">Nog geen resultaten voor {config.label.toLowerCase()}.</p>
      ) : (
        <>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {entries.map((entry) => (
              <div key={entry.id} className="min-w-[108px] rounded-lg border border-borderSubtle bg-cardDeep px-3 py-2 text-sm">
                <p className="whitespace-nowrap text-xs text-textMuted">{new Date(`${entry.tested_on}T12:00:00`).toLocaleDateString("nl-BE")}</p>
                <p className="whitespace-nowrap font-semibold text-textPrimary">
                  {config.kind === "simple"
                    ? config.fields.map((field) => entry.results[field.key] !== undefined ? formatTestFieldValue(field, entry.results[field.key]) : null).filter(Boolean).join(" · ")
                    : formatTestDuration(entry.results.duration_seconds)}
                </p>
                {entry.note && <p className="mt-1 text-xs text-textMuted">{entry.note}</p>}
                {config.kind === "vameval" && (
                  <button type="button" onClick={() => onToggleZones(entry.id)} className="mt-1 whitespace-nowrap text-xs font-semibold text-accent hover:underline">
                    {expandedZonesId === entry.id ? "Verberg zones" : "Bekijk zones"}
                  </button>
                )}
              </div>
            ))}
          </div>
          {config.kind === "vameval" && expandedEntry && <ZoneTable zones={calculateMasTrainingZones(expandedEntry.results.mas_kmh)} />}
          {chartFieldEntries.length >= 2 && <FieldChart entries={chartFieldEntries} field={chartField} />}
        </>
      )}
    </div>
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

function FieldChart({ entries, field }: { entries: TestRecord[]; field: { key: string; unit: string } }) {
  const width = 560, height = 120, padding = 24;
  const points = [...entries]
    .map((entry) => ({ time: new Date(`${entry.tested_on}T12:00:00`).getTime(), value: entry.results[field.key] }))
    .sort((a, b) => a.time - b.time);
  const minTime = Math.min(...points.map((p) => p.time));
  const maxTime = Math.max(...points.map((p) => p.time));
  const timeRange = maxTime - minTime || 1;
  const values = points.map((p) => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const x = (time: number) => padding + ((time - minTime) / timeRange) * (width - padding * 2);
  const y = (value: number) => height - padding - ((value - min) / range) * (height - padding * 2);
  const path = points.map((p) => `${x(p.time)},${y(p.value)}`).join(" ");
  const color = lineColors[0];

  return (
    <div className="mt-3 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[280px]">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border)" strokeWidth={1} />
        <polyline points={path} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p, i) => <circle key={i} cx={x(p.time)} cy={y(p.value)} r={3} fill={color} />)}
      </svg>
    </div>
  );
}
