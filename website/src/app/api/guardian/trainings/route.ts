import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeAttendanceStatus } from "@/lib/training-statistics";

type GuardianPlayer = { player_id: string; first_name: string; last_name: string; team_id: string | null; team_name: string | null };

async function guardianPlayers() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, players: [] as GuardianPlayer[] };
  const { data } = await supabase.rpc("guardian_dashboard_players");
  return { user, players: (data ?? []) as GuardianPlayer[] };
}

export async function GET() {
  const { user, players } = await guardianPlayers();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const teamIds = [...new Set(players.map(player => player.team_id).filter((id): id is string => !!id))];
  const { data: teams } = teamIds.length ? await admin.from("teams").select("id, club_team_id").in("id", teamIds) : { data: [] };
  const clubTeamByTeam = new Map((teams ?? []).map(team => [team.id, team.club_team_id]));
  const clubTeamIds = [...new Set((teams ?? []).map(team => team.club_team_id).filter(Boolean))];
  const playerIds = players.map(player => player.player_id);
  const { data: groupMemberships } = playerIds.length ? await admin.from("player_group_players").select("player_id, group_id").in("player_id", playerIds) : { data: [] };
  const groupIds = [...new Set((groupMemberships ?? []).map(link => link.group_id))];
  const { data: teamSessions, error: teamError } = clubTeamIds.length
    ? await admin.from("team_training_sessions").select("id, club_team_id, player_group_id, training_date, start_time, field_option_id, locker_room_option_id, attendance_confirmed_at, club_teams(name), player_groups(name, icon)")
        .in("club_team_id", clubTeamIds).gte("training_date", new Date().toISOString().slice(0, 10)).order("training_date").order("start_time")
    : { data: [], error: null };
  const { data: groupSessions, error: groupError } = groupIds.length
    ? await admin.from("team_training_sessions").select("id, club_team_id, player_group_id, training_date, start_time, field_option_id, locker_room_option_id, attendance_confirmed_at, club_teams(name), player_groups(name, icon)").in("player_group_id", groupIds).gte("training_date", new Date().toISOString().slice(0, 10)).order("training_date").order("start_time")
    : { data: [], error: null };
  if (teamError || groupError) return NextResponse.json({ error: (teamError || groupError)!.message }, { status: 400 });
  const sessions = [...(teamSessions ?? []), ...(groupSessions ?? [])];
  const sessionIds = (sessions ?? []).map(session => session.id);
  const [{ data: attendance }, { data: options }] = await Promise.all([
    sessionIds.length && playerIds.length
      ? admin.from("team_training_attendance").select("training_session_id, player_id, attendance_status, absence_reason_id, note").in("training_session_id", sessionIds).in("player_id", playerIds)
      : Promise.resolve({ data: [] }),
    clubTeamIds.length
      ? admin.from("club_match_options").select("id, label, option_type").eq("active", true)
      : Promise.resolve({ data: [] })
  ]);
  const rows = players.flatMap(player => {
    const clubTeamId = player.team_id ? clubTeamByTeam.get(player.team_id) : null;
    const playerGroupIds = new Set((groupMemberships ?? []).filter(link => link.player_id === player.player_id).map(link => link.group_id));
    return sessions.filter(session => session.club_team_id === clubTeamId || (!!session.player_group_id && playerGroupIds.has(session.player_group_id))).map(session => ({
      ...session,
      player_id: player.player_id,
      player_name: `${player.first_name} ${player.last_name}`.trim(),
      attendance: attendance?.find(row => row.training_session_id === session.id && row.player_id === player.player_id) ?? null,
      can_update: !session.attendance_confirmed_at
    }));
  });
  return NextResponse.json({ trainings: rows, options: options ?? [] });
}

export async function PUT(request: Request) {
  const { user, players } = await guardianPlayers();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { sessionId?: string; playerId?: string; status?: "present" | "absent"; reasonId?: string | null; note?: string | null } | null;
  if (!body?.sessionId || !body.playerId || !["present", "absent"].includes(body.status ?? "") || !players.some(player => player.player_id === body.playerId)) {
    return NextResponse.json({ error: "Ongeldige beschikbaarheid." }, { status: 400 });
  }
  const admin = createAdminClient();
  const player = players.find(item => item.player_id === body.playerId)!;
  const { data: team } = player.team_id ? await admin.from("teams").select("club_team_id").eq("id", player.team_id).maybeSingle() : { data: null };
  const { data: session } = await admin.from("team_training_sessions").select("id, club_id, club_team_id, player_group_id, attendance_confirmed_at").eq("id", body.sessionId).maybeSingle();
  const { count: groupMembership } = session?.player_group_id ? await admin.from("player_group_players").select("group_id", { count: "exact", head: true }).eq("group_id", session.player_group_id).eq("player_id", body.playerId) : { count: 0 };
  if (!session || (!groupMembership && (!team || session.club_team_id !== team.club_team_id))) return NextResponse.json({ error: "Training niet gevonden voor deze speler." }, { status: 404 });
  if (session.attendance_confirmed_at) return NextResponse.json({ error: "De aanwezigheden zijn al bevestigd." }, { status: 409 });
  let reason: { id: string; label: string } | null = null;
  if (body.status === "absent" && body.reasonId) {
    const result = await admin.from("club_match_options").select("id, label").eq("id", body.reasonId).eq("club_id", session.club_id).eq("option_type", "non_selection_reason").eq("active", true).maybeSingle();
    reason = result.data;
    if (!reason) return NextResponse.json({ error: "Ongeldige afwezigheidsreden." }, { status: 400 });
  }
  const attendanceStatus = normalizeAttendanceStatus(body.status!, reason?.label);
  const { data, error } = await admin.from("team_training_attendance").upsert({
    training_session_id: session.id, player_id: body.playerId, attendance_status: attendanceStatus,
    absence_reason_id: body.status === "absent" ? body.reasonId || null : null,
    note: body.status === "absent" ? body.note?.trim().slice(0, 500) || null : null,
    updated_by: user.id, updated_at: new Date().toISOString()
  }).select("training_session_id, player_id, attendance_status, absence_reason_id, note").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from("training_availability_notifications").insert({
    training_session_id: session.id, player_id: body.playerId, contact_profile_id: user.id, attendance_status: body.status
  });
  return NextResponse.json({ attendance: data });
}
