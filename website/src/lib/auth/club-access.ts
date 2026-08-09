import { cache } from "react";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_PERMISSION_OPTIONS, defaultPermissionsForRole, type ClubPermissionKey, type TeamScope } from "@/lib/club-access-options";

const readDefaults = new Set<ClubPermissionKey>(["teams.view", "games.view", "training.view", "intradesk.view"]);
const trainerDefaults = new Set<ClubPermissionKey>([...readDefaults, "video.view", "games.create", "games.planning.manage", "games.selection.view", "games.selection.manage", "games.tag_link.create", "games.tag", "training.manage", "injuries.view"]);
const analystDefaults = new Set<ClubPermissionKey>([...readDefaults, "video.view", "games.view_counts", "games.tag", "clips.share"]);
const communicationsDefaults = new Set<ClubPermissionKey>([...readDefaults, "games.communication.manage", "clips.share"]);
const commercialDefaults = new Set<ClubPermissionKey>(defaultPermissionsForRole("commercial_manager"));
const sponsorViewerDefaults = new Set<ClubPermissionKey>(defaultPermissionsForRole("sponsor_viewer"));
const scoutDefaults = new Set<ClubPermissionKey>([...readDefaults, "games.scouting.view", "games.scouting.manage"]);
const coordinatorDefaults = new Set<ClubPermissionKey>(["teams.view", "teams.view_all", "teams.manage", "teams.manage_all", "teams.import", "games.view", "training.view", "training.manage", "intradesk.view", "injuries.view", "injuries.manage"]);

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
    : ["youth_coordinator", "head_youth_development", "technical_director"].includes(membership.function_role ?? "")
      ? new Set(coordinatorDefaults)
    : ["doctor", "physiotherapist"].includes(membership.function_role ?? "")
      ? new Set(defaultPermissionsForRole(membership.function_role ?? ""))
    : ["goalkeeper_coach", "team_manager"].includes(membership.function_role ?? "")
      ? new Set<ClubPermissionKey>(["teams.view", ...defaultPermissionsForRole(membership.function_role ?? "")])
    : membership.function_role === "communications"
      ? new Set(communicationsDefaults)
    : membership.function_role === "commercial_manager"
      ? new Set(commercialDefaults)
    : membership.function_role === "sponsor_viewer"
      ? new Set(sponsorViewerDefaults)
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
  if (permissions.has("sponsors.manage")) permissions.add("sponsors.view");
  if (permissions.has("sponsors.internal.manage")) permissions.add("sponsors.internal.view");
  if (permissions.has("sponsors.scopes.manage")) permissions.add("sponsors.scopes.view");
  if (permissions.has("sponsors.matches.manage")) permissions.add("sponsors.matches.view");
  const teamIds = new Set((selected ?? []).map((row) => row.club_team_id));
  if (membership.team_scope === "assigned" && trainer) {
    const { data: assignments } = await admin.from("club_trainer_teams")
      .select("club_team_id, club_teams!inner(club_seasons!club_teams_season_id_fkey!inner(status, trainers_visible_from))")
      .eq("trainer_id", trainer.id).eq("status", "active");
    for (const assignment of assignments ?? []) {
      const team = assignment.club_teams as unknown as { club_seasons: { status: string; trainers_visible_from: string | null } | null } | null;
      const season = team?.club_seasons;
      if (season?.status === "ACTIVE" || (season?.status === "PREPARATION" && season.trainers_visible_from && new Date(season.trainers_visible_from) <= new Date())) teamIds.add(assignment.club_team_id);
    }
  }
  let goalkeeperPlayerIds: Set<string> | null = null;
  if (membership.function_role === "goalkeeper_coach") {
    const { data: playerAssignments } = trainer
      ? await admin.from("player_group_staff").select("player_groups!inner(active, player_group_players(player_id, valid_until))").eq("trainer_id", trainer.id).eq("player_groups.active", true)
      : { data: [] };
    goalkeeperPlayerIds = new Set((playerAssignments ?? []).flatMap((row) => {
      const group = row.player_groups as unknown as { player_group_players: { player_id: string; valid_until: string | null }[] } | null;
      return (group?.player_group_players ?? []).filter(member => !member.valid_until).map(member => member.player_id);
    }));
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

export function canManagePlayer(access: Awaited<ReturnType<typeof getClubAccess>>, playerId: string) {
  return access.goalkeeperPlayerIds === null || access.goalkeeperPlayerIds.has(playerId);
}
