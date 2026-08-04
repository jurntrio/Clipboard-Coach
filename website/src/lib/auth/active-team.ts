export const ACTIVE_TEAM_COOKIE = "clipboard_coach_active_team";

/** Persisted cookie value meaning "the user explicitly asked to see every accessible team". */
export const ALL_TEAMS_VALUE = "all";

export type ActiveTeamSelection = {
  /** A validated, explicitly chosen team id, or null if none is set. */
  teamId: string | null;
  /** True only when the user explicitly picked "alle ploegen" (as opposed to never having chosen anything). */
  explicitAll: boolean;
};

/** `validTeamIds` must be the concrete set of club_team ids the caller may see (already resolved for admins/full-scope roles), never null. */
export function readActiveTeamSelection(cookieValue: string | undefined, validTeamIds: Set<string>): ActiveTeamSelection {
  if (!cookieValue) return { teamId: null, explicitAll: false };
  if (cookieValue === ALL_TEAMS_VALUE) return { teamId: null, explicitAll: true };
  if (!validTeamIds.has(cookieValue)) return { teamId: null, explicitAll: false };
  return { teamId: cookieValue, explicitAll: false };
}
