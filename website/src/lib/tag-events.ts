export type TagEventKind = "goal";

export function getTagEventKind(name: string): TagEventKind | null {
  return /^goal(?:\s|$)/i.test(name.trim()) ? "goal" : null;
}

export function defaultGoalEventType(name: string, ownTeamIsHome: boolean): "goal_for" | "goal_against" {
  const normalized = name.trim().toLocaleLowerCase("nl");
  if (/\b(thuis|home)\b/.test(normalized)) return ownTeamIsHome ? "goal_for" : "goal_against";
  if (/\b(uit|away)\b/.test(normalized)) return ownTeamIsHome ? "goal_against" : "goal_for";
  return "goal_for";
}

export const DEFAULT_CLIP_PROFILES: Record<string, { start: number; end: number }> = {
  goal: { start: -10, end: 3 },
  kans: { start: -10, end: 3 },
  opbouw: { start: -5, end: 10 },
  positiespel: { start: -10, end: 5 },
  hoekschop: { start: -3, end: 10 },
  "vrije trap": { start: -3, end: 10 }
};
