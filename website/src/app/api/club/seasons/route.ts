import { NextRequest, NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function adminContext() {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return null;
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!["club_admin", "platform_admin"].includes(access.role)) return null;
  return { user: context.user, clubId: context.activeClubId };
}

export async function GET() {
  const context = await adminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();
  const [{ data: seasons, error }, { data: teams }, { data: decisions }, { data: staff }] = await Promise.all([
    admin.from("club_seasons").select("*").eq("club_id", context.clubId).order("starts_on", { ascending: false }),
    admin.from("club_teams").select("id, name, season_id, status, display_order").eq("club_id", context.clubId).neq("status", "merged"),
    admin.from("season_player_decisions").select("season_id, decision").eq("club_id", context.clubId),
    admin.from("club_trainer_teams").select("season_id, club_team_id, status").eq("status", "active")
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seasons: (seasons ?? []).map(season => {
    const seasonTeams = (teams ?? []).filter(team => team.season_id === season.id);
    const seasonDecisions = (decisions ?? []).filter(decision => decision.season_id === season.id);
    const staffed = new Set((staff ?? []).filter(item => item.season_id === season.id).map(item => item.club_team_id));
    return { ...season, teams: seasonTeams.sort((a, b) => a.display_order - b.display_order).map(team => ({ id: team.id, name: team.name })), metrics: { teams: seasonTeams.length, assigned: seasonDecisions.filter(item => item.decision === "TEAM").length,
      undecided: seasonDecisions.filter(item => item.decision === "UNDECIDED").length,
      leaving: seasonDecisions.filter(item => item.decision === "LEAVING").length,
      staffedTeams: seasonTeams.filter(team => staffed.has(team.id)).length } };
  }) });
}

export async function POST(request: NextRequest) {
  const context = await adminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const supabase = createClient();
  if (body.action === "prepare") {
    const { data, error } = await supabase.rpc("prepare_club_season", { target_club_id: context.clubId,
      season_name: body.name, starts_on: body.startsOn, ends_on: body.endsOn,
      source_season_id: body.sourceSeasonId || null, copy_groups: body.copyGroups !== false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ seasonId: data });
  }
  if (body.action === "copyTeams") {
    const { data, error } = await supabase.rpc("copy_season_team_names", { target_club_id: context.clubId,
      source_season_id: body.sourceSeasonId, target_season_id: body.seasonId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }
  if (body.action === "addTeam") {
    const { data, error } = await supabase.rpc("add_preparation_season_team", { target_club_id: context.clubId,
      target_season_id: body.seasonId, team_name: body.name });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ teamId: data });
  }
  if (body.action === "renameTeam") {
    const { error } = await supabase.rpc("rename_preparation_season_team", { target_club_id: context.clubId,
      target_season_id: body.seasonId, target_team_id: body.teamId, team_name: body.name });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "deleteTeam") {
    const { error } = await supabase.rpc("delete_preparation_season_team", { target_club_id: context.clubId,
      target_season_id: body.seasonId, target_team_id: body.teamId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "delete") {
    const { error } = await supabase.rpc("delete_preparation_season", { target_club_id: context.clubId,
      target_season_id: body.seasonId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "preflight") {
    const { data, error } = await supabase.rpc("season_preflight", { target_club_id: context.clubId, target_season_id: body.seasonId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ checks: data });
  }
  if (body.action === "activate") {
    const { data, error } = await supabase.rpc("activate_club_season", { target_club_id: context.clubId, target_season_id: body.seasonId, source: "MANUAL" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
