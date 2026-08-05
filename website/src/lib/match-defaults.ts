export type MatchFormat = "5v5" | "8v8" | "11v11";

export type MatchDefaults = {
  format: MatchFormat;
  periodCount: number;
  periodMinutes: number;
  minimumPlayers: number;
};

export const AGE_CATEGORIES = [
  "U7", "U8", "U9", "U10", "U11", "U12", "U13",
  "U14", "U15", "U16", "U17", "U18", "U19", "Senioren"
] as const;

export function defaultsForAgeCategory(category: string | null | undefined): MatchDefaults | null {
  const normalized = category?.trim().toLocaleUpperCase("nl-BE") ?? "";
  if (normalized === "SENIOREN" || normalized === "OUDEREN") {
    return { format: "11v11", periodCount: 2, periodMinutes: 45, minimumPlayers: 11 };
  }
  const match = normalized.match(/^U(\d{1,2})$/);
  if (!match) return null;
  const age = Number(match[1]);
  if (age >= 7 && age <= 9) return { format: "5v5", periodCount: 4, periodMinutes: 15, minimumPlayers: 5 };
  if (age >= 10 && age <= 11) return { format: "8v8", periodCount: 4, periodMinutes: 15, minimumPlayers: 8 };
  if (age >= 12 && age <= 13) return { format: "8v8", periodCount: 4, periodMinutes: 20, minimumPlayers: 8 };
  if (age >= 14 && age <= 19) return { format: "11v11", periodCount: 4, periodMinutes: 20, minimumPlayers: 11 };
  return null;
}

export function isMatchFormat(value: unknown): value is MatchFormat {
  return value === "5v5" || value === "8v8" || value === "11v11";
}
