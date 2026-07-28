export type TagEventKind = "goal";

export function getTagEventKind(name: string): TagEventKind | null {
  return name.trim().toLocaleLowerCase() === "goal" ? "goal" : null;
}

export const DEFAULT_CLIP_PROFILES: Record<string, { start: number; end: number }> = {
  goal: { start: -10, end: 3 },
  kans: { start: -10, end: 3 },
  opbouw: { start: -5, end: 10 },
  positiespel: { start: -10, end: 5 },
  hoekschop: { start: -3, end: 10 },
  "vrije trap": { start: -3, end: 10 }
};
