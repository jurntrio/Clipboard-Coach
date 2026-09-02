import { calculateVamevalMas, formatMasKmh, isValidVamevalDurationSeconds } from "@/lib/vameval";

export type PlayerTestField = { key: string; label: string; unit: string; min: number; max: number };

export type SimplePlayerTestTypeConfig = { kind: "simple"; label: string; fields: PlayerTestField[] };
export type VamevalPlayerTestTypeConfig = { kind: "vameval"; label: string; chartField: PlayerTestField };
export type PlayerTestTypeConfig = SimplePlayerTestTypeConfig | VamevalPlayerTestTypeConfig;

export const PLAYER_TEST_TYPES: Record<string, PlayerTestTypeConfig> = {
  height: {
    kind: "simple",
    label: "Lengte",
    fields: [{ key: "height_cm", label: "Lengte", unit: "cm", min: 50, max: 250 }],
  },
  weight: {
    kind: "simple",
    label: "Gewicht",
    fields: [{ key: "weight_kg", label: "Gewicht", unit: "kg", min: 10, max: 300 }],
  },
  vameval: {
    kind: "vameval",
    label: "VAMEVAL",
    chartField: { key: "mas_kmh", label: "MAS", unit: "km/u", min: 5, max: 25 },
  },
  // Nieuwe eenvoudige testtypes met numerieke velden kunnen hier zonder migratie worden
  // toegevoegd (kind: "simple"), bv.:
  // cooper: { kind: "simple", label: "Cooper-test", fields: [{ key: "distance_m", label: "Afstand", unit: "m", min: 500, max: 5000 }] },

  // Een testtype met een eigen berekening (zoals VAMEVAL) volgt het "vameval"-patroon:
  // een apart bestand met zuivere rekenfuncties (zie src/lib/vameval.ts), server-side
  // hervalidatie/herberekening in de API-route, en een eigen UI-tak in PlayerTests.tsx.
};

export function isKnownTestType(testType: string): boolean {
  return Object.prototype.hasOwnProperty.call(PLAYER_TEST_TYPES, testType);
}

/**
 * Server-side (re)validation of raw test results for a given test type. Never trust
 * client-supplied derived values (e.g. VAMEVAL's MAS) — always recompute from raw input.
 * An empty `rawResults` yields an empty `results` object; callers decide whether that's
 * an error (single-entry forms) or means "skip this player" (bulk team entry).
 */
export function validateTestResults(config: PlayerTestTypeConfig, rawResults: unknown): { results: Record<string, number> } | { error: string } {
  const raw = (rawResults && typeof rawResults === "object" ? rawResults : {}) as Record<string, unknown>;
  if (config.kind === "vameval") {
    if (raw.duration_seconds === undefined || raw.duration_seconds === null || raw.duration_seconds === "") return { results: {} };
    const durationSeconds = Number(raw.duration_seconds);
    if (!isValidVamevalDurationSeconds(durationSeconds)) return { error: "Controleer de totale looptijd (minstens 2:00, en realistisch)." };
    return { results: { duration_seconds: durationSeconds, mas_kmh: calculateVamevalMas(durationSeconds) } };
  }
  const results: Record<string, number> = {};
  for (const field of config.fields) {
    const value = raw[field.key];
    if (value === undefined || value === null || value === "") continue;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < field.min || numeric > field.max) return { error: `Controleer de waarde voor ${field.label} (${field.min}-${field.max} ${field.unit}).` };
    results[field.key] = numeric;
  }
  return { results };
}

export function formatTestFieldValue(field: { key: string; unit: string }, value: number): string {
  if (field.key === "mas_kmh") return `${formatMasKmh(value)} ${field.unit}`;
  if (field.key === "height_cm") {
    const meters = Math.floor(value / 100);
    const cm = Math.round(value - meters * 100);
    return `${meters}m ${cm.toString().padStart(2, "0")}`;
  }
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  return `${rounded} ${field.unit}`;
}
