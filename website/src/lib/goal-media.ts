export type ReportGoal = {
  id: string; liveTagId?: string; team: "home" | "away"; scoreAfter: string; minute: number | null;
  scorerType: "" | "player" | "own_goal" | "custom"; scorerPlayerId: string; scorerName: string;
  assistType: "player" | "own_goal" | "custom" | "none"; assistPlayerId: string; assistName: string; description: string;
};

export type GoalMedia = {
  id: string; goal_id: string; tag_id: string | null; clip_id: string | null;
  start_time: number | null; end_time: number | null;
  clips: { id: string; render_status: string; render_error?: string | null; rendered_segments: unknown[] | null } | null;
};

export function normalizeReportGoals(saved: ReportGoal[], total: number): ReportGoal[] {
  const byPosition = new Map<number, ReportGoal>();
  saved.forEach((goal, index) => {
    const score = /^\d{1,2}-\d{1,2}$/.test(goal.scoreAfter) ? goal.scoreAfter.split("-").map(Number) : null;
    const namedPosition = /^goal-([1-9]\d*)$/.exec(goal.id);
    const position = score ? score[0] + score[1] : namedPosition ? Number(namedPosition[1]) : index + 1;
    byPosition.set(position, goal);
  });
  const length = Math.min(60, Math.max(total, saved.length, ...byPosition.keys(), 0));
  return Array.from({ length }, (_, index) => byPosition.get(index + 1) ?? {
    id: `goal-${index + 1}`, team: "home", scoreAfter: "", minute: null,
    scorerType: "", scorerPlayerId: "", scorerName: "", assistType: "none", assistPlayerId: "", assistName: "", description: ""
  });
}

export function validateGoalRange(start: unknown, end: unknown, duration?: number | null) {
  if (typeof start !== "number" || typeof end !== "number" || !Number.isFinite(start) || !Number.isFinite(end)
    || start < 0 || end <= start || end - start > 180 || (duration != null && duration > 0 && end > duration)) {
    throw new Error("Kies een geldig fragment van maximaal 180 seconden binnen de video.");
  }
  return { start, end };
}

export function makeReportGoal(input: { scoreAfter: unknown; team: unknown; minute?: unknown; scorerId?: unknown; assistId?: unknown }): ReportGoal {
  if (typeof input.scoreAfter !== "string" || !/^\d{1,2}-\d{1,2}$/.test(input.scoreAfter)) throw new Error("Vul de stand na het doelpunt in.");
  const [home, away] = input.scoreAfter.split("-").map(Number);
  if (home > 30 || away > 30 || home + away === 0 || !["home", "away"].includes(String(input.team))
    || (input.team === "home" ? home === 0 : away === 0)) throw new Error("Controleer de stand en de scorende ploeg.");
  if (input.minute != null && (!Number.isInteger(input.minute) || Number(input.minute) < 0 || Number(input.minute) > 120)) throw new Error("Controleer de wedstrijdminuut.");
  const scorer = typeof input.scorerId === "string" ? input.scorerId : "";
  const assist = typeof input.assistId === "string" ? input.assistId : "";
  if (scorer && scorer === assist) throw new Error("De doelpuntenmaker kan niet ook de assistgever zijn.");
  return { id: `goal-${home + away}`, scoreAfter: `${home}-${away}`, team: input.team as "home" | "away", minute: input.minute == null ? null : Number(input.minute),
    scorerType: scorer ? "player" : "", scorerPlayerId: scorer, scorerName: "", assistType: assist ? "player" : "none", assistPlayerId: assist, assistName: "", description: "" };
}

export function goalMediaState(media: GoalMedia, tag?: { start_time: number; end_time: number }) {
  if (!media.clip_id || !media.clips) return "Nog geen bewaarde clip";
  if (media.clips.render_status === "failed") return "Bewaren mislukt";
  if (media.clips.render_status !== "ready" || !media.clips.rendered_segments?.length) return "Clip wordt bewaard";
  if (tag && (tag.start_time !== media.start_time || tag.end_time !== media.end_time)) return "Clip bewaard · tijden gewijzigd, opnieuw bevestigen";
  return "Clip bewaard";
}
