import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_PERMISSION_OPTIONS, type ClubPermissionKey, type TeamScope } from "@/lib/club-access-options";

const readDefaults = new Set<ClubPermissionKey>(["teams.view", "games.view", "training.view", "intradesk.view"]);
const trainerDefaults = new Set<ClubPermissionKey>([...readDefaults, "video.view", "games.create", "games.tag_link.create", "games.tag", "training.manage"]);
const analystDefaults = new Set<ClubPermissionKey>([...readDefaults, "video.view", "games.view_counts", "games.tag", "clips.share"]);

export async function getClubAccess(clubId: string, user: { id: string; email?: string | null }) {
  if (isAdminEmail(user.email)) return {
    exists: true, role: "platform_admin", functionRole: "platform_admin", teamScope: "all" as TeamScope,
    readOnly: false, permissions: new Set(CLUB_PERMISSION_OPTIONS.map(([key]) => key)), teamIds: null as Set<string> | null
  };
  const admin = createAdminClient();
  const [{ data: membership }, { data: explicit }, { data: selected }, { data: trainer }] = await Promise.all([
    admin.from("club_memberships").select("role, status, function_role, team_scope").eq("club_id", clubId).eq("profile_id", user.id).maybeSingle(),
    admin.from("club_member_permissions").select("permission_key, enabled").eq("club_id", clubId).eq("profile_id", user.id),
    admin.from("club_member_team_access").select("club_team_id").eq("club_id", clubId).eq("profile_id", user.id),
    admin.from("club_trainers").select("id").eq("club_id", clubId).eq("profile_id", user.id).maybeSingle()
  ]);
  if (!membership || membership.status !== "active") return { exists: false, role: "", functionRole: "", teamScope: "none" as TeamScope, readOnly: true, permissions: new Set<ClubPermissionKey>(), teamIds: new Set<string>() };
  const readOnly = membership.role === "club_admin_viewer";
  let permissions = membership.role === "club_admin" || readOnly
    ? new Set(CLUB_PERMISSION_OPTIONS.map(([key]) => key))
    : membership.role === "analyst" || membership.function_role === "video_analyst"
      ? new Set(analystDefaults) : membership.role === "trainer" || membership.role === "coach"
        ? new Set(trainerDefaults) : new Set(readDefaults);
  if (readOnly) permissions = new Set([...permissions].filter((key) => !key.endsWith(".manage") && !["games.create", "games.tag_link.create", "games.tag", "clips.share", "teams.import"].includes(key)));
  if (!["club_admin", "club_admin_viewer"].includes(membership.role)) {
    for (const row of explicit ?? []) {
      if (row.enabled) permissions.add(row.permission_key as ClubPermissionKey);
      else permissions.delete(row.permission_key as ClubPermissionKey);
    }
  }
  const teamIds = new Set((selected ?? []).map((row) => row.club_team_id));
  if (membership.team_scope === "assigned" && trainer) {
    const { data: assignments } = await admin.from("club_trainer_teams").select("club_team_id").eq("trainer_id", trainer.id).eq("status", "active");
    for (const assignment of assignments ?? []) teamIds.add(assignment.club_team_id);
  }
  return {
    exists: true, role: membership.role, functionRole: membership.function_role,
    teamScope: membership.team_scope as TeamScope, readOnly, permissions,
    teamIds: membership.role === "club_admin" || readOnly || membership.team_scope === "all" ? null : teamIds
  };
}

export function canAccessTeam(access: Awaited<ReturnType<typeof getClubAccess>>, clubTeamId: string | null | undefined) {
  return access.exists && (access.teamIds === null || (!!clubTeamId && access.teamIds.has(clubTeamId)));
}

export function hasClubPermission(access: Awaited<ReturnType<typeof getClubAccess>>, permission: ClubPermissionKey) {
  return access.exists && access.permissions.has(permission);
}
