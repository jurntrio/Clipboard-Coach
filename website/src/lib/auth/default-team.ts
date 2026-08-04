import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Picks a sensible default active team when the user hasn't chosen one yet:
 * the first team they actually train, otherwise the first accessible team.
 * `accessibleTeamIds` should already be ordered by relevance (e.g. display_order).
 */
export async function resolveDefaultTeamId(admin: ReturnType<typeof createAdminClient>, clubId: string, userId: string, accessibleTeamIds: string[]): Promise<string | null> {
  if (!accessibleTeamIds.length) return null;
  const { data: trainer } = await admin.from("club_trainers").select("id").eq("club_id", clubId).eq("profile_id", userId).maybeSingle();
  if (trainer) {
    const { data: assignments } = await admin.from("club_trainer_teams").select("club_team_id")
      .eq("trainer_id", trainer.id).eq("status", "active").order("created_at");
    const accessible = new Set(accessibleTeamIds);
    const match = (assignments ?? []).find((assignment) => accessible.has(assignment.club_team_id));
    if (match) return match.club_team_id;
  }
  return accessibleTeamIds[0];
}
