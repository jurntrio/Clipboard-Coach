export type PlayerTestField = { key: string; label: string; unit: string; min: number; max: number };

export type SimplePlayerTestTypeConfig = { kind: "simple"; label: string; fields: PlayerTestField[] };
export type VamevalPlayerTestTypeConfig = { kind: "vameval"; label: string; chartField: PlayerTestField };
export type PlayerTestTypeConfig = SimplePlayerTestTypeConfig | VamevalPlayerTestTypeConfig;

export const PLAYER_TEST_TYPES: Record<string, PlayerTestTypeConfig> = {
  body_measurements: {
    kind: "simple",
    label: "Lengte & gewicht",
    fields: [
      { key: "height_cm", label: "Lengte", unit: "cm", min: 50, max: 250 },
      { key: "weight_kg", label: "Gewicht", unit: "kg", min: 10, max: 300 },
    ],
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
