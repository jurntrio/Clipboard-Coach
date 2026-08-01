import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function GET() {
  const context = await getClubContext();
  const user = context.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const access = context.activeClubId ? await getClubAccess(context.activeClubId, user) : null;
  const fullAdmin = isAdminEmail(user.email) || access?.role === "platform_admin" || access?.role === "club_admin" || access?.role === "club_admin_viewer";
  const allowed = fullAdmin || !!(access && (hasClubPermission(access, "teams.manage") || hasClubPermission(access, "teams.import")));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clubIds = context.activeClubId ? [context.activeClubId] : [];
  if (!clubIds.length) return NextResponse.json({ clubs: [] });

  const [{ data: clubs }, { data: teams }, { data: trainers }, { data: matches }, { data: clubMemberships }, { data: moduleEntitlements }, { data: trainingSettings }, { data: memberPermissions }, { data: memberTeamAccess }, { data: rolePermissionDefaults }, { data: matchOptions }] = await Promise.all([
    admin.from("clubs").select("*").in("id", clubIds).order("name"),
    admin.from("club_teams").select("*, club_trainer_teams(trainer_id, role, status), teams(id, players(*))").in("club_id", clubIds).neq("status", "merged").order("name"),
    admin.from("club_trainers").select("*, profiles(email), club_trainer_teams(club_team_id), club_trainer_players(player_id)").in("club_id", clubIds).order("display_name"),
    admin.from("matches").select("id, club_id, club_team_id, team_a_name, team_b_name, match_date, start_time, status, score_a, score_b, external_source").in("club_id", clubIds).order("match_date", { ascending: false }),
    admin.from("club_memberships").select("club_id, profile_id, role, function_role, custom_role_name, team_scope").in("club_id", clubIds),
    admin.from("club_module_entitlements").select("club_id, module_key, enabled").in("club_id", clubIds),
    admin.from("club_training_settings").select("*").in("club_id", clubIds),
    admin.from("club_member_permissions").select("club_id, profile_id, permission_key, enabled").in("club_id", clubIds),
    admin.from("club_member_team_access").select("club_id, profile_id, club_team_id").in("club_id", clubIds),
    admin.from("club_role_permission_defaults").select("club_id, function_role, permission_key, enabled").in("club_id", clubIds),
    admin.from("club_match_options").select("id, club_id, option_type, label").in("club_id", clubIds).eq("active", true).order("label")
  ]);
  const matchIds = (matches ?? []).map((match) => match.id);
  const { data: assignments } = matchIds.length
    ? await admin.from("club_match_assignments").select("*").in("match_id", matchIds)
    : { data: [] };

  // Openstaande "kies primair team"-reviewgevallen (Fase 2b, resolve_primary_membership).
  // Vooraf server-side samengevoegd met kandidaat-teams zodat ClubTeamsManager niet zelf
  // door player_team_memberships/teams/club_teams heen hoeft te joinen.
  const { data: migrationIssuesRaw } = await admin
    .from("club_player_migration_issues")
    .select("id, club_id, candidate_club_player_id, details, club_players(first_name, last_name)")
    .in("club_id", clubIds).eq("status", "open").eq("issue_type", "unassigned_primary_team");
  const candidateIds = Array.from(new Set(
    (migrationIssuesRaw ?? []).map((issue) => issue.candidate_club_player_id).filter((id): id is string => !!id)
  ));
  const { data: candidateMemberships } = candidateIds.length
    ? await admin.from("player_team_memberships")
        .select("club_player_id, team_id, season_id, membership_type, teams(name)")
        .in("club_player_id", candidateIds).eq("status", "active")
    : { data: [] };
  const migrationIssues = (migrationIssuesRaw ?? []).map((issue) => {
    const seasonId = (issue.details as Record<string, unknown> | null)?.season_id as string | undefined;
    const player = issue.club_players as unknown as { first_name: string; last_name: string } | null;
    const candidates = (candidateMemberships ?? [])
      .filter((membership) => membership.club_player_id === issue.candidate_club_player_id
        && (!seasonId || membership.season_id === seasonId))
      .map((membership) => ({
        teamId: membership.team_id,
        teamName: (membership.teams as unknown as { name: string } | null)?.name ?? "",
        membershipType: membership.membership_type
      }));
    return {
      id: issue.id,
      clubId: issue.club_id,
      clubPlayerId: issue.candidate_club_player_id,
      playerName: player ? `${player.first_name} ${player.last_name}`.trim() : "",
      seasonId: seasonId ?? null,
      candidates
    };
  });

  const visibleTeams = (fullAdmin || !access ? (teams ?? []) : (teams ?? []).filter((team) => canAccessTeam(access, team.id))).map((team) => ({
    ...team,
    teams: access?.goalkeeperPlayerIds === null || !access
      ? team.teams
      : (team.teams ?? []).map((operationalTeam: any) => ({
          ...operationalTeam,
          players: (operationalTeam.players ?? []).filter((player: any) => access.goalkeeperPlayerIds?.has(player.id))
        }))
  }));
  return NextResponse.json({
    clubs: clubs ?? [], teams: visibleTeams, trainers: trainers ?? [], matches: fullAdmin ? matches ?? [] : [],
    assignments: fullAdmin ? assignments ?? [] : [], memberships: fullAdmin ? clubMemberships ?? [] : (clubMemberships ?? []).filter((membership) => membership.profile_id === user.id), moduleEntitlements: moduleEntitlements ?? [],
    trainingSettings: fullAdmin ? trainingSettings ?? [] : [], memberPermissions: fullAdmin ? memberPermissions ?? [] : [],
    memberTeamAccess: fullAdmin ? memberTeamAccess ?? [] : [], rolePermissionDefaults: fullAdmin ? rolePermissionDefaults ?? [] : [], matchOptions: matchOptions ?? [], migrationIssues: fullAdmin ? migrationIssues : [],
    currentAccess: access ? { role: access.role, functionRole: access.functionRole, permissions: Array.from(access.permissions) } : null
  });
}
