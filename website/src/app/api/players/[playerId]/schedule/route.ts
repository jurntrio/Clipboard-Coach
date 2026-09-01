import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function GET(_request: Request, { params }: { params: { playerId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });

  const admin = createAdminClient();
  const { data: player } = await admin.from("players").select("id, team_id, membership_id, teams(name, coach_id, club_team_id)").eq("id", params.playerId).maybeSingle();
  const team = Array.isArray(player?.teams) ? player?.teams[0] : player?.teams;
  if (!player || !team?.club_team_id) return NextResponse.json({ trainings: [], matches: [], optionNames: {} });

  // A player can hold memberships on several teams at once (e.g. playing up for another
  // age group) — each membership has its own `players` row, so matches must be gathered
  // across every team tied to the same underlying club_players identity, not just this row.
  const matchTeamIds = new Set<string>([player.team_id]);
  const matchClubTeamIds = new Set<string>([team.club_team_id]);
  if (player.membership_id) {
    const { data: ownMembership } = await admin.from("player_team_memberships").select("club_player_id").eq("id", player.membership_id).maybeSingle();
    if (ownMembership?.club_player_id) {
      const { data: siblingMemberships } = await admin.from("player_team_memberships").select("team_id, teams(club_team_id)").eq("club_player_id", ownMembership.club_player_id);
      for (const membership of siblingMemberships ?? []) {
        matchTeamIds.add(membership.team_id);
        const siblingClubTeamId = Array.isArray(membership.teams) ? membership.teams[0]?.club_team_id : (membership.teams as { club_team_id: string | null } | null)?.club_team_id;
        if (siblingClubTeamId) matchClubTeamIds.add(siblingClubTeamId);
      }
    }
  }

  const { data: clubTeam } = await admin.from("club_teams").select("club_id").eq("id", team.club_team_id).maybeSingle();
  if (!clubTeam) return NextResponse.json({ error: "Ploeg niet gevonden." }, { status: 404 });

  const access = await getClubAccess(clubTeam.club_id, user);
  let allowed = isAdminEmail(user.email) || team.coach_id === user.id;
  if (!allowed) allowed = canAccessTeam(access, team.club_team_id) && hasClubPermission(access, "teams.view");
  if (!allowed) return NextResponse.json({ error: "Geen toegang tot deze speler." }, { status: 403 });
  const canEditAttendance = isAdminEmail(user.email) || Boolean(access && canAccessTeam(access, team.club_team_id) && !access.readOnly && hasClubPermission(access, "training.manage"));

  const { data: groupMemberships } = await admin.from("player_group_players").select("group_id, player_groups(name, icon, active)").eq("player_id", player.id);
  const groupIds = (groupMemberships ?? []).filter(link => (link.player_groups as unknown as { active: boolean } | null)?.active !== false).map(link => link.group_id);
  const { data: ownTrainer } = await admin.from("club_trainers").select("id").eq("club_id", clubTeam.club_id).eq("profile_id", user.id).maybeSingle();
  const { data: managedGroups } = ownTrainer && groupIds.length ? await admin.from("player_group_staff").select("group_id").eq("trainer_id", ownTrainer.id).in("group_id", groupIds) : { data: [] };
  const managedGroupIds = new Set((managedGroups ?? []).map(link => link.group_id));

  const [trainingResult, groupTrainingResult, matchResult, optionResult, evaluationResult] = await Promise.all([
    admin.from("team_training_sessions")
      .select("id, club_team_id, player_group_id, training_date, start_time, field_option_id, locker_room_option_id, attendance_confirmed_at, club_teams(name), player_groups(name, icon)")
      .eq("club_team_id", team.club_team_id),
    groupIds.length ? admin.from("team_training_sessions")
      .select("id, club_team_id, player_group_id, training_date, start_time, field_option_id, locker_room_option_id, attendance_confirmed_at, club_teams(name), player_groups(name, icon)")
      .in("player_group_id", groupIds) : Promise.resolve({ data: [], error: null }),
    admin.from("matches")
      .select("id, club_team_id, team_a_id, team_b_id, team_a_name, team_b_name, match_date, start_time, status, score_a, score_b, is_home_match")
      .or(`club_team_id.in.(${[...matchClubTeamIds].join(",")}),team_a_id.in.(${[...matchTeamIds].join(",")}),team_b_id.in.(${[...matchTeamIds].join(",")})`),
    admin.from("club_match_options").select("id, label").eq("club_id", clubTeam.club_id).eq("active", true),
    admin.from("player_group_evaluations").select("id, score, note, evaluated_at, player_groups(name, icon), player_group_evaluation_criteria(name), profiles(full_name)").eq("player_id", player.id).order("evaluated_at", { ascending: false })
  ]);

  const trainings = [...(trainingResult.data ?? []), ...(groupTrainingResult.data ?? [])].sort((a, b) => `${a.training_date}${a.start_time}`.localeCompare(`${b.training_date}${b.start_time}`));
  const trainingIds = trainings.map(training => training.id);
  const attendanceResult = trainingIds.length
    ? await admin.from("team_training_attendance").select("training_session_id, attendance_status").eq("player_id", player.id).in("training_session_id", trainingIds)
    : { data: [], error: null };
  const error = trainingResult.error || groupTrainingResult.error || matchResult.error || optionResult.error || evaluationResult.error || attendanceResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    trainings: trainings.map(training => ({
      ...training,
      attendance_status: attendanceResult.data?.find(row => row.training_session_id === training.id)?.attendance_status ?? "unknown",
      can_edit_attendance: (training.player_group_id ? (isAdminEmail(user.email) || managedGroupIds.has(training.player_group_id)) : canEditAttendance) && !training.attendance_confirmed_at
    })),
    extraGroups: (groupMemberships ?? []).map(link => ({ id: link.group_id, ...(link.player_groups as unknown as { name: string; icon: string | null; active: boolean }) })).filter(group => group.active),
    evaluations: evaluationResult.data ?? [],
    matches: matchResult.data ?? [],
    optionNames: Object.fromEntries((optionResult.data ?? []).map(option => [option.id, option.label]))
  });
}
