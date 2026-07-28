export const TRAINING_AGE_CATEGORIES = [
  "U6", "U7", "U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17",
  "U19", "Beloften", "A Ploeg"
] as const;

export type TrainingAgeCategory = typeof TRAINING_AGE_CATEGORIES[number];

// TeamTactics TT1–TT10 volgt het Belgische topsportjaarplan en is daarom
// bewust geen generieke trainingsmodule voor clubs uit andere landen.
export function supportsBelgianTeamTactics(country: unknown): boolean {
  if (typeof country !== "string") return false;
  return ["BE", "BEL", "BELGIUM", "BELGIË", "BELGIE", "BELGIQUE"].includes(country.trim().toUpperCase());
}

export function isTrainingAgeCategory(value: unknown): value is TrainingAgeCategory {
  return typeof value === "string" && TRAINING_AGE_CATEGORIES.includes(value as TrainingAgeCategory);
}
