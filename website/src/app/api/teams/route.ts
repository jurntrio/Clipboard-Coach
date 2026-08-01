import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function GET() {
  const context = await getClubContext();
  const user = context.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (context.activeClubId) {
    const admin = createAdminClient();
    const access = context.clubs.find((club) => club.id === context.activeClubId);
    if (!access) return NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 });
    const authorization = await getClubAccess(context.activeClubId, user);
    if (!hasClubPermission(authorization, "teams.view")) return NextResponse.json({ error: "Geen toegang tot Teams." }, { status: 403 });
    const [{ data: clubTeams }, { data: permissions }] = await Promise.all([
      admin.from("club_teams").select("id, trainers_can_edit_roster").eq("club_id", context.activeClubId).eq("status", "active"),
      admin.from("club_module_entitlements").select("module_key, enabled").eq("club_id", context.activeClubId)
        .in("module_key", ["teams_manage", "teams_import"])
    ]);
    const teamsManageEnabled = permissions?.find((item) => item.module_key === "teams_manage")?.enabled !== false;
    const teamsImportEnabled = teamsManageEnabled && permissions?.find((item) => item.module_key === "teams_import")?.enabled !== false;
    let allowedIds = (clubTeams ?? []).map((team) => team.id);
    const clubWide = authorization.teamIds === null;
    if (!clubWide) {
      allowedIds = allowedIds.filter((id) => canAccessTeam(authorization, id));
    }
    const { data: teams } = allowedIds.length
      ? await admin.from("teams").select("*, club_teams!inner(trainers_can_edit_roster)").in("club_team_id", allowedIds)
      : { data: [] };
    return NextResponse.json({ teams: (teams ?? []).map((team) => {
      const settings = team.club_teams as unknown as { trainers_can_edit_roster: boolean };
      const privilegedRosterRole = ["youth_coordinator", "head_youth_development"].includes(authorization.functionRole ?? "");
      const canEdit = teamsManageEnabled && hasClubPermission(authorization, "teams.manage")
        && (authorization.role === "platform_admin" || authorization.role === "club_admin" || privilegedRosterRole || settings.trainers_can_edit_roster);
      return {
        ...team,
        players: [],
        details_loaded: false,
        can_edit_roster: canEdit,
        can_import_roster: canEdit && teamsImportEnabled && hasClubPermission(authorization, "teams.import"),
        club_managed: true
      };
    }) });
  }

  const admin = createAdminClient();
  const [{ data: owned }, { data: staff }, { data: clubTrainer }] = await Promise.all([
    admin.from("teams").select("*").eq("coach_id", user.id),
    admin.from("team_staff_members").select("team_id").eq("user_id", user.id),
    admin.from("club_trainers").select("id").eq("profile_id", user.id)
  ]);

  const staffIds = (staff ?? []).map((item) => item.team_id);
  const { data: staffTeams } = staffIds.length
    ? await admin.from("teams").select("*").in("id", staffIds)
    : { data: [] };
  const trainerIds = (clubTrainer ?? []).map((item) => item.id);
  const { data: assignments } = trainerIds.length
    ? await admin.from("club_trainer_teams").select("club_team_id").in("trainer_id", trainerIds).eq("status", "active")
    : { data: [] };
  const clubTeamIds = (assignments ?? []).map((item) => item.club_team_id);
  const { data: clubTeams } = clubTeamIds.length
    ? await admin.from("teams").select("*, club_teams!inner(trainers_can_edit_roster)").in("club_team_id", clubTeamIds)
    : { data: [] };

  const byId = new Map<string, Record<string, unknown>>();
  for (const team of [...(owned ?? []), ...(staffTeams ?? [])]) {
    byId.set(team.id, { ...team, players: [], details_loaded: false, can_edit_roster: team.coach_id === user.id, club_managed: false });
  }
  for (const team of clubTeams ?? []) {
    const settings = team.club_teams as unknown as { trainers_can_edit_roster: boolean };
    byId.set(team.id, { ...team, players: [], details_loaded: false, can_edit_roster: settings.trainers_can_edit_roster, club_managed: true });
  }

  return NextResponse.json({ teams: Array.from(byId.values()) });
}
