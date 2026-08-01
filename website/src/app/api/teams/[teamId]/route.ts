import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
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
  let goalkeeperPlayerIds: Set<string> | null = null;
  if (context.activeClubId && clubTeam?.club_id === context.activeClubId) {
    const access = await getClubAccess(context.activeClubId, user);
    allowed = hasClubPermission(access, "teams.view") && canAccessTeam(access, clubTeam.id);
    goalkeeperPlayerIds = access.goalkeeperPlayerIds;
  } else if (!allowed) {
    const { data: membership } = await admin.from("team_staff_members").select("id")
      .eq("team_id", team.id).eq("user_id", user.id).maybeSingle();
    allowed = !!membership;
  }
  if (!allowed) return NextResponse.json({ error: "Geen toegang tot dit team." }, { status: 403 });

  const visiblePlayers = goalkeeperPlayerIds === null
    ? (team.players ?? [])
    : (team.players ?? []).filter((player: { id: string }) => goalkeeperPlayerIds?.has(player.id));
  const [enriched] = await addPlayerContacts(admin, [{ ...team, players: visiblePlayers }]);

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
