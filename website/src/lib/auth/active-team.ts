export const ACTIVE_TEAM_COOKIE = "clipboard_coach_active_team";

/** `validTeamIds` must be the concrete set of club_team ids the caller may see (already resolved for admins/full-scope roles), never null. */
export function resolveActiveTeamId(cookieValue: string | undefined, validTeamIds: Set<string>): string | null {
  if (!cookieValue || !validTeamIds.has(cookieValue)) return null;
  return cookieValue;
}
