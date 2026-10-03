import { cache } from "react";
import { isAdminEmail } from "@/lib/auth/admin";
import { getAccountProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_PERMISSION_OPTIONS, defaultPermissionsForRole, type ClubPermissionKey, type TeamScope } from "@/lib/club-access-options";

const readDefaults = new Set<ClubPermissionKey>(["teams.view", "games.view", "training.view", "intradesk.view"]);
const trainerDefaults = new Set<ClubPermissionKey>([...readDefaults, "video.view", "games.create", "games.video_sources.manage", "games.planning.manage", "games.selection.view", "games.selection.manage", "games.tag_link.create", "games.tag", "training.manage", "injuries.view", "tests.view", "tests.manage"]);
const analystDefaults = new Set<ClubPermissionKey>([...readDefaults, "video.view", "games.video_sources.manage", "games.view_counts", "games.tag", "clips.share"]);
const communicationsDefaults = new Set<ClubPermissionKey>([...readDefaults, "games.communication.manage", "clips.share"]);
const commercialDefaults = new Set<ClubPermissionKey>(defaultPermissionsForRole("commercial_manager"));
const sponsorViewerDefaults = new Set<ClubPermissionKey>(defaultPermissionsForRole("sponsor_viewer"));
const scoutDefaults = new Set<ClubPermissionKey>([...readDefaults, "games.scouting.view", "games.scouting.manage"]);
const coordinatorDefaults = new Set<ClubPermissionKey>(["teams.view", "teams.view_all", "teams.manage", "teams.manage_all", "teams.import", "games.view", "training.view", "training.manage", "intradesk.view", "injuries.view", "injuries.manage", "tests.view", "tests.manage"]);


type PermissionRow = { permission_key: string; enabled: boolean };
type AccessRole = {
  id: string; role_type: string; club_team_id: string | null; team_scope: string;
  valid_from: string; valid_until: string | null;
  club_role_permission_overrides: PermissionRow[];
};
type AccessBundle = {
  profile: { account_role: string | null } | null;
  clubPerson: { id: string } | null;
  roles: AccessRole[];
  configuredDefaults: (PermissionRow & { function_role: string })[];
  playerAssignments: { player_groups: { player_group_players: { player_id: string; valid_until: string | null }[] } | null }[];
};

function calculateClubAccess(bundle: AccessBundle, userEmail: string | null) {
  const { profile: platformProfile, clubPerson, roles, configuredDefaults, playerAssignments } = bundle;
  if (isAdminEmail(userEmail) || platformProfile?.account_role === "platform_admin") return {
    exists: true, role: "platform_admin", functionRole: "platform_admin", teamScope: "all" as TeamScope,
    readOnly: false, permissions: new Set(CLUB_PERMISSION_OPTIONS.map(([key]) => key)), teamIds: null as Set<string> | null,
    goalkeeperPlayerIds: null as Set<string> | null
  };
  if (!clubPerson || !roles?.length) return { exists: false, role: "", functionRole: "", teamScope: "none" as TeamScope, readOnly: true, permissions: new Set<ClubPermissionKey>(), teamIds: new Set<string>(), goalkeeperPlayerIds: null as Set<string> | null };
  const rolePriority = ["club_admin", "club_admin_viewer", "technical_director", "head_youth_development", "youth_coordinator", "trainer", "video_analyst"];
  const baseRoles = roles.filter((item) => !item.club_team_id);
  const primary = [...(baseRoles.length ? baseRoles : roles)].sort((a, b) => {
    const ai = rolePriority.indexOf(a.role_type);
    const bi = rolePriority.indexOf(b.role_type);
    return (ai < 0 ? rolePriority.length : ai) - (bi < 0 ? rolePriority.length : bi);
  })[0];
  const role = primary.role_type === "video_analyst" ? "analyst"
    : primary.role_type === "assistant_trainer" ? "trainer" : primary.role_type;
  const functionRole = primary.role_type;
  const readOnly = primary.role_type === "club_admin_viewer";
  let permissions = new Set<ClubPermissionKey>();
  for (const assignment of roles) {
    const assignmentRole = assignment.role_type;
    const roleConfiguration = (configuredDefaults ?? []).filter((item) => item.function_role === assignmentRole);
    const defaults = roleConfiguration.length
      ? roleConfiguration.filter((item) => item.enabled).map((item) => item.permission_key as ClubPermissionKey)
      : assignmentRole === "club_admin" || assignmentRole === "club_admin_viewer"
      ? CLUB_PERMISSION_OPTIONS.map(([key]) => key)
      : ["youth_coordinator", "head_youth_development", "technical_director"].includes(assignmentRole)
        ? [...coordinatorDefaults]
        : assignmentRole === "video_analyst" ? [...analystDefaults]
        : ["trainer", "assistant_trainer"].includes(assignmentRole) ? [...trainerDefaults]
        : assignmentRole === "communications" ? [...communicationsDefaults]
        : assignmentRole === "commercial_manager" ? [...commercialDefaults]
        : assignmentRole === "sponsor_viewer" ? [...sponsorViewerDefaults]
        : assignmentRole === "scout" ? [...scoutDefaults]
        : defaultPermissionsForRole(assignmentRole);
    for (const permission of defaults) permissions.add(permission);
  }
  const explicit = baseRoles.flatMap((assignment) => assignment.club_role_permission_overrides ?? []);
  if (readOnly) permissions = new Set([...permissions].filter((key) => !key.endsWith(".manage") && !["games.create", "games.tag_link.create", "games.tag", "clips.share", "teams.import"].includes(key)));
  if (!["club_admin", "club_admin_viewer"].includes(primary.role_type)) {
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
  const teamIds = new Set(roles.flatMap((assignment) => assignment.club_team_id ? [assignment.club_team_id] : []));
  const teamScope: TeamScope = primary.role_type === "club_admin" || readOnly || baseRoles.some((item) => item.team_scope === "all") || permissions.has("teams.view_all")
    ? "all" : baseRoles.some((item) => item.team_scope === "assigned") ? "assigned" : "none";
  let goalkeeperPlayerIds: Set<string> | null = null;
  if (roles.some((assignment) => assignment.role_type === "goalkeeper_coach")) {
    goalkeeperPlayerIds = new Set((playerAssignments ?? []).flatMap((row) => {
      const group = row.player_groups as unknown as { player_group_players: { player_id: string; valid_until: string | null }[] } | null;
      return (group?.player_group_players ?? []).filter(member => !member.valid_until).map(member => member.player_id);
    }));
  }
  return {
    exists: true, role, functionRole,
    teamScope, readOnly, permissions,
    teamIds: teamScope === "all" ? null : teamIds,
    goalkeeperPlayerIds
  };
}

async function loadLegacyClubAccess(clubId: string, userId: string, userEmail: string | null) {
  const admin = createAdminClient();
  const { data: platformProfile } = isAdminEmail(userEmail)
    ? { data: { account_role: "platform_admin" } }
    : { data: await getAccountProfile(userId) };
  if (isAdminEmail(userEmail) || platformProfile?.account_role === "platform_admin") return {
    exists: true, role: "platform_admin", functionRole: "platform_admin", teamScope: "all" as TeamScope,
    readOnly: false, permissions: new Set(CLUB_PERMISSION_OPTIONS.map(([key]) => key)), teamIds: null as Set<string> | null,
    goalkeeperPlayerIds: null as Set<string> | null
  };
  const { data: account } = await admin.from("person_accounts").select("person_id")
    .eq("profile_id", userId).eq("status", "active").is("revoked_at", null).maybeSingle();
  const { data: clubPerson } = account
    ? await admin.from("club_people").select("id").eq("club_id", clubId)
      .eq("person_id", account.person_id).eq("status", "active").maybeSingle()
    : { data: null };
  if (!clubPerson) return { exists: false, role: "", functionRole: "", teamScope: "none" as TeamScope, readOnly: true, permissions: new Set<ClubPermissionKey>(), teamIds: new Set<string>(), goalkeeperPlayerIds: null as Set<string> | null };

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: roles }, { data: trainer }, { data: configuredDefaults }] = await Promise.all([
    admin.from("club_role_assignments")
      .select("id, role_type, club_team_id, team_scope, valid_from, valid_until, club_role_permission_overrides(permission_key, enabled)")
      .eq("club_person_id", clubPerson.id).eq("status", "active")
      .lte("valid_from", today).or(`valid_until.is.null,valid_until.gte.${today}`),
    admin.from("club_trainers").select("id").eq("club_id", clubId).eq("club_person_id", clubPerson.id).maybeSingle(),
    admin.from("club_role_permission_defaults").select("function_role, permission_key, enabled").eq("club_id", clubId)
  ]);
  if (!roles?.length) return { exists: false, role: "", functionRole: "", teamScope: "none" as TeamScope, readOnly: true, permissions: new Set<ClubPermissionKey>(), teamIds: new Set<string>(), goalkeeperPlayerIds: null as Set<string> | null };

  const { data: playerAssignments } = trainer && roles.some(assignment => assignment.role_type === "goalkeeper_coach")
    ? await admin.from("player_group_staff").select("player_groups!inner(active, player_group_players(player_id, valid_until))").eq("trainer_id", trainer.id).eq("player_groups.active", true)
    : { data: [] };
  return calculateClubAccess({ profile: platformProfile, clubPerson, roles, configuredDefaults: configuredDefaults ?? [], playerAssignments: (playerAssignments ?? []) as unknown as AccessBundle["playerAssignments"] }, userEmail);
}

async function loadClubAccess(clubId: string, userId: string, userEmail: string | null) {
  // Preserve the emergency allowlist's existing database-independent path.
  if (isAdminEmail(userEmail)) return calculateClubAccess({ profile: null, clubPerson: null,
    roles: [], configuredDefaults: [], playerAssignments: [] }, userEmail);
  const { data, error } = await createAdminClient().rpc("club_access_bundle", { p_club_id: clubId, p_user_id: userId });
  if (error) {
    // Only an undeployed migration may use the legacy query path.
    if (error.code === "42883" || error.code === "PGRST202") return loadLegacyClubAccess(clubId, userId, userEmail);
    throw new Error("Club access bundle failed", { cause: error });
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.roles) || !Array.isArray(data.configuredDefaults) || !Array.isArray(data.playerAssignments)) {
    throw new Error("Invalid club access bundle");
  }
  return calculateClubAccess(data as AccessBundle, userEmail);
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
