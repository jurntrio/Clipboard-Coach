import { cache } from "react";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_PERMISSION_OPTIONS, defaultPermissionsForRole, type ClubPermissionKey, type TeamScope } from "@/lib/club-access-options";

const readDefaults = new Set<ClubPermissionKey>(["teams.view", "games.view", "training.view", "intradesk.view"]);
const trainerDefaults = new Set<ClubPermissionKey>([...readDefaults, "video.view", "games.create", "games.planning.manage", "games.selection.view", "games.selection.manage", "games.tag_link.create", "games.tag", "training.manage"]);
const analystDefaults = new Set<ClubPermissionKey>([...readDefaults, "video.view", "games.view_counts", "games.tag", "clips.share"]);
const communicationsDefaults = new Set<ClubPermissionKey>([...readDefaults, "games.communication.manage", "clips.share"]);
const scoutDefaults = new Set<ClubPermissionKey>([...readDefaults, "games.scouting.view", "games.scouting.manage"]);
const coordinatorDefaults = new Set<ClubPermissionKey>(["teams.view", "teams.view_all", "teams.manage", "teams.manage_all", "teams.import", "games.view", "training.view", "intradesk.view"]);

async function loadClubAccess(clubId: string, userId: string, userEmail: string | null) {
  const admin = createAdminClient();
  const { data: platformProfile } = isAdminEmail(userEmail)
    ? { data: { account_role: "platform_admin" } }
    : await admin.from("profiles").select("account_role").eq("id", userId).maybeSingle();
  if (isAdminEmail(userEmail) || platformProfile?.account_role === "platform_admin") return {
    exists: true, role: "platform_admin", functionRole: "platform_admin", teamScope: "all" as TeamScope,
    readOnly: false, permissions: new Set(CLUB_PERMISSION_OPTIONS.map(([key]) => key)), teamIds: null as Set<string> | null,
    goalkeeperPlayerIds: null as Set<string> | null
  };
  const [{ data: membership }, { data: explicit }, { data: selected }, { data: trainer }] = await Promise.all([
    admin.from("club_memberships").select("role, status, function_role, team_scope").eq("club_id", clubId).eq("profile_id", userId).maybeSingle(),
    admin.from("club_member_permissions").select("permission_key, enabled").eq("club_id", clubId).eq("profile_id", userId),
    admin.from("club_member_team_access").select("club_team_id").eq("club_id", clubId).eq("profile_id", userId),
    admin.from("club_trainers").select("id").eq("club_id", clubId).eq("profile_id", userId).maybeSingle()
  ]);
  if (!membership || membership.status !== "active") return { exists: false, role: "", functionRole: "", teamScope: "none" as TeamScope, readOnly: true, permissions: new Set<ClubPermissionKey>(), teamIds: new Set<string>(), goalkeeperPlayerIds: null as Set<string> | null };
  const readOnly = membership.role === "club_admin_viewer";
  let permissions = membership.role === "club_admin" || readOnly
    ? new Set(CLUB_PERMISSION_OPTIONS.map(([key]) => key))
    : ["youth_coordinator", "head_youth_development"].includes(membership.function_role ?? "")
      ? new Set(coordinatorDefaults)
    : ["goalkeeper_coach", "team_manager"].includes(membership.function_role ?? "")
      ? new Set<ClubPermissionKey>(["teams.view", ...defaultPermissionsForRole(membership.function_role ?? "")])
    : membership.function_role === "communications"
      ? new Set(communicationsDefaults)
      : membership.function_role === "scout"
        ? new Set(scoutDefaults)
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
  if (permissions.has("teams.manage_all")) {
    permissions.add("teams.view_all");
    permissions.add("teams.view");
    permissions.add("teams.manage");
  } else if (permissions.has("teams.view_all")) {
    permissions.add("teams.view");
  }
  if (permissions.has("games.scouting.manage")) permissions.add("games.scouting.view");
  if (permissions.has("games.report.manage")) permissions.add("games.report.view");
  const teamIds = new Set((selected ?? []).map((row) => row.club_team_id));
  if (membership.team_scope === "assigned" && trainer) {
    const { data: assignments } = await admin.from("club_trainer_teams").select("club_team_id").eq("trainer_id", trainer.id).eq("status", "active");
    for (const assignment of assignments ?? []) teamIds.add(assignment.club_team_id);
  }
  let goalkeeperPlayerIds: Set<string> | null = null;
  if (membership.function_role === "goalkeeper_coach") {
    const { data: playerAssignments } = trainer
      ? await admin.from("club_trainer_players").select("player_id").eq("trainer_id", trainer.id)
      : { data: [] };
    goalkeeperPlayerIds = new Set((playerAssignments ?? []).map((row) => row.player_id));
  }
  return {
    exists: true, role: membership.role, functionRole: membership.function_role,
    teamScope: membership.team_scope as TeamScope, readOnly, permissions,
    teamIds: membership.role === "club_admin" || readOnly || membership.team_scope === "all" || permissions.has("teams.view_all") ? null : teamIds,
    goalkeeperPlayerIds
  };
}

const getCachedClubAccess = cache(loadClubAccess);

export function getClubAccess(clubId: string, user: { id: string; email?: string | null }) {
  return getCachedClubAccess(clubId, user.id, user.email ?? null);
}

export function canAccessTeam(access: Awaited<ReturnType<typeof getClubAccess>>, clubTeamId: string | null | undefined) {
  return access.exists && (access.teamIds === null || (!!clubTeamId && access.teamIds.has(clubTeamId)));
}

export function hasClubPermission(access: Awaited<ReturnType<typeof getClubAccess>>, permission: ClubPermissionKey) {
  return access.exists && access.permissions.has(permission);
}
