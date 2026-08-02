import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, canManagePlayer, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { addPlayerContacts } from "@/lib/teams/player-contacts";

export async function GET(_request: Request, { params }: { params: { teamId: string } }) {
  const context = await getClubContext();
  const user = context.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: team } = await admin.from("teams")
    .select("*, players(*), club_teams(id, club_id, trainers_can_edit_roster)")
    .eq("id", params.teamId).maybeSingle();
  if (!team) return NextResponse.json({ error: "Team niet gevonden." }, { status: 404 });

  const clubTeam = team.club_teams as unknown as { id: string; club_id: string; trainers_can_edit_roster: boolean } | null;
  let allowed = team.coach_id === user.id;
  let access: Awaited<ReturnType<typeof getClubAccess>> | null = null;
  let canEditRoster = allowed;
  if (context.activeClubId && clubTeam?.club_id === context.activeClubId) {
    access = await getClubAccess(context.activeClubId, user);
    allowed = hasClubPermission(access, "teams.view") && canAccessTeam(access, clubTeam.id);
    const privilegedRosterRole = ["youth_coordinator", "head_youth_development"].includes(access.functionRole ?? "");
    canEditRoster = allowed && hasClubPermission(access, "teams.manage")
      && (["platform_admin", "club_admin"].includes(access.role) || privilegedRosterRole || clubTeam.trainers_can_edit_roster === true);
  } else if (!allowed) {
    const { data: membership } = await admin.from("team_staff_members").select("id")
      .eq("team_id", team.id).eq("user_id", user.id).maybeSingle();
    allowed = !!membership;
  }
  if (!allowed) return NextResponse.json({ error: "Geen toegang tot dit team." }, { status: 403 });

  const allPlayers = (team.players ?? []) as Array<Record<string, unknown> & { id: string }>;
  const privatePlayers = access?.goalkeeperPlayerIds === null || !access
    ? allPlayers
    : allPlayers.filter((player) => canManagePlayer(access!, player.id));
  const [enrichedPrivate] = await addPlayerContacts(admin, [{ ...team, players: privatePlayers }]);
  const privateById = new Map(((enrichedPrivate.players ?? []) as Array<Record<string, unknown> & { id: string }>).map((player) => [player.id, player]));
  const visiblePlayers = allPlayers.map((player) => {
    const privatePlayer = privateById.get(player.id);
    if (privatePlayer) return { ...privatePlayer, can_manage: canEditRoster };
    return {
      id: player.id,
      team_id: player.team_id,
      first_name: player.first_name,
      last_name: player.last_name,
      initials: player.initials,
      position: player.position,
      jersey_number: player.jersey_number,
      role: player.role,
      is_goalkeeper: player.is_goalkeeper,
      email: null,
      date_of_birth: null,
      phone_numbers: [],
      membership_id: null,
      created_at: player.created_at,
      contacts: [],
      can_manage: false
    };
  });
  const enriched = { ...enrichedPrivate, players: visiblePlayers };

  let linkedStaff: Array<{ id: string; user_id: string; full_name: string; removable: boolean }> = [];
  if (clubTeam) {
    const { data: assignments } = await admin.from("club_trainer_teams")
      .select("club_team_id, trainer_id, club_trainers(profile_id, display_name)")
      .eq("club_team_id", clubTeam.id).eq("status", "active");
    linkedStaff = (assignments ?? []).flatMap((assignment) => {
      const trainer = assignment.club_trainers as unknown as { profile_id: string | null; display_name: string | null } | null;
      return trainer ? [{
        id: `${clubTeam.id}:${assignment.trainer_id}`,
        user_id: trainer.profile_id ?? assignment.trainer_id,
        full_name: trainer.display_name?.trim() || "Trainer",
        removable: false
      }] : [];
    });
  } else {
    const { data: memberships } = await admin.from("team_staff_members")
      .select("id, user_id").eq("team_id", team.id);
    const profileIds = (memberships ?? []).map((membership) => membership.user_id);
    const { data: profiles } = profileIds.length
      ? await admin.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] };
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
    linkedStaff = (memberships ?? []).map((membership) => ({
      id: membership.id,
      user_id: membership.user_id,
      full_name: names.get(membership.user_id)?.trim() || "Registered staff",
      removable: team.coach_id === user.id && membership.user_id !== team.coach_id
    }));
  }

  const { data: clips } = await admin.from("clips")
    .select("id, team_id, audience_type, audience_player_ids, clip_segments(tags(player_ids))")
    .eq("team_id", team.id);

  return NextResponse.json({ team: { ...enriched, linked_staff: linkedStaff, details_loaded: true }, clips: clips ?? [] });
}
