import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

type TeamRow = Record<string, unknown> & { players?: Array<Record<string, unknown> & { id: string; membership_id?: string | null }> };

async function addPlayerContacts(admin: ReturnType<typeof createAdminClient>, rows: TeamRow[]): Promise<TeamRow[]> {
  const players = rows.flatMap((team) => team.players ?? []);
  const playerIds = players.map((player) => player.id);
  const membershipIds = players.flatMap((player) => player.membership_id ? [player.membership_id] : []);
  const { data: memberships } = membershipIds.length
    ? await admin.from("player_team_memberships").select("id, club_player_id").in("id", membershipIds)
    : { data: [] };
  const clubPlayerByMembership = new Map((memberships ?? []).map((membership) => [membership.id, membership.club_player_id]));
  const clubPlayerIds = [...new Set((memberships ?? []).map((membership) => membership.club_player_id).filter((id): id is string => !!id))];
  const [{ data: directContacts }, { data: clubContacts }] = await Promise.all([
    playerIds.length
      ? admin.from("player_guardians").select("id, player_id, profiles(full_name, email, phone_number)").in("player_id", playerIds).is("revoked_at", null).order("created_at")
      : Promise.resolve({ data: [] }),
    clubPlayerIds.length
      ? admin.from("player_guardians").select("id, club_player_id, profiles(full_name, email, phone_number)").in("club_player_id", clubPlayerIds).is("revoked_at", null).order("created_at")
      : Promise.resolve({ data: [] })
  ]);
  const contactsByPlayer = new Map<string, Array<{ id: string; full_name: string; email: string | null; phone_number: string | null }>>();
  for (const player of players) {
    const clubPlayerId = player.membership_id ? clubPlayerByMembership.get(player.membership_id) : null;
    const guardians = clubPlayerId
      ? (clubContacts ?? []).filter((contact) => contact.club_player_id === clubPlayerId)
      : (directContacts ?? []).filter((contact) => contact.player_id === player.id);
    contactsByPlayer.set(player.id, guardians.slice(0, 2).map((contact) => {
      const profile = contact.profiles as unknown as { full_name: string | null; email: string | null; phone_number: string | null } | null;
      return { id: contact.id, full_name: profile?.full_name?.trim() || "Naam niet ingevuld", email: profile?.email ?? null, phone_number: profile?.phone_number ?? null };
    }));
  }
  return rows.map((team) => ({
    ...team,
    players: (team.players ?? []).map((player) => ({ ...player, contacts: contactsByPlayer.get(player.id) ?? [] }))
  }) as TeamRow);
}

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
      ? await admin.from("teams").select("*, players(*), club_teams!inner(trainers_can_edit_roster)").in("club_team_id", allowedIds)
      : { data: [] };
    const { data: trainerAssignments } = allowedIds.length
      ? await admin.from("club_trainer_teams")
        .select("club_team_id, trainer_id, club_trainers(profile_id, display_name)")
        .in("club_team_id", allowedIds).eq("status", "active")
      : { data: [] };
    const staffByClubTeam = new Map<string, Array<{ id: string; user_id: string; full_name: string; removable: boolean }>>();
    for (const assignment of trainerAssignments ?? []) {
      const trainer = assignment.club_trainers as unknown as { profile_id: string | null; display_name: string | null } | null;
      if (!trainer) continue;
      const current = staffByClubTeam.get(assignment.club_team_id) ?? [];
      current.push({
        id: `${assignment.club_team_id}:${assignment.trainer_id}`,
        user_id: trainer.profile_id ?? assignment.trainer_id,
        full_name: trainer.display_name?.trim() || "Trainer",
        removable: false
      });
      staffByClubTeam.set(assignment.club_team_id, current);
    }
    const restrictedTeams = (teams ?? []).map((team) => ({
      ...team,
      players: authorization.goalkeeperPlayerIds === null
        ? team.players
        : (team.players ?? []).filter((player: { id: string }) => authorization.goalkeeperPlayerIds?.has(player.id))
    }));
    const enrichedTeams = await addPlayerContacts(admin, restrictedTeams as TeamRow[]);
    return NextResponse.json({ teams: enrichedTeams.map((team) => {
      const settings = team.club_teams as unknown as { trainers_can_edit_roster: boolean };
      const privilegedRosterRole = ["youth_coordinator", "head_youth_development"].includes(authorization.functionRole ?? "");
      const canEdit = teamsManageEnabled && hasClubPermission(authorization, "teams.manage")
        && (authorization.role === "platform_admin" || authorization.role === "club_admin" || privilegedRosterRole || settings.trainers_can_edit_roster);
      return {
        ...team,
        linked_staff: staffByClubTeam.get(team.club_team_id as string) ?? [],
        can_edit_roster: canEdit,
        can_import_roster: canEdit && teamsImportEnabled && hasClubPermission(authorization, "teams.import"),
        club_managed: true
      };
    }) });
  }

  const admin = createAdminClient();
  const [{ data: owned }, { data: staff }, { data: clubTrainer }] = await Promise.all([
    admin.from("teams").select("*, players(*)").eq("coach_id", user.id),
    admin.from("team_staff_members").select("team_id").eq("user_id", user.id),
    admin.from("club_trainers").select("id").eq("profile_id", user.id)
  ]);

  const staffIds = (staff ?? []).map((item) => item.team_id);
  const { data: staffTeams } = staffIds.length
    ? await admin.from("teams").select("*, players(*)").in("id", staffIds)
    : { data: [] };
  const trainerIds = (clubTrainer ?? []).map((item) => item.id);
  const { data: assignments } = trainerIds.length
    ? await admin.from("club_trainer_teams").select("club_team_id").in("trainer_id", trainerIds).eq("status", "active")
    : { data: [] };
  const clubTeamIds = (assignments ?? []).map((item) => item.club_team_id);
  const { data: clubTeams } = clubTeamIds.length
    ? await admin.from("teams").select("*, players(*), club_teams!inner(trainers_can_edit_roster)").in("club_team_id", clubTeamIds)
    : { data: [] };

  const byId = new Map<string, Record<string, unknown>>();
  for (const team of [...(owned ?? []), ...(staffTeams ?? [])]) {
    byId.set(team.id, { ...team, can_edit_roster: team.coach_id === user.id, club_managed: false });
  }
  for (const team of clubTeams ?? []) {
    const settings = team.club_teams as unknown as { trainers_can_edit_roster: boolean };
    byId.set(team.id, { ...team, can_edit_roster: settings.trainers_can_edit_roster, club_managed: true });
  }

  return NextResponse.json({ teams: await addPlayerContacts(admin, Array.from(byId.values()) as TeamRow[]) });
}
