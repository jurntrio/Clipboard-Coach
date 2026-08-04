import { NextRequest, NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function context() {
  const value = await getClubContext();
  if (!value.user || !value.activeClubId) return null;
  const access = await getClubAccess(value.activeClubId, value.user);
  return ["club_admin", "platform_admin"].includes(access.role) ? { clubId: value.activeClubId } : null;
}

export async function GET(request: NextRequest) {
  const current = await context(); if (!current) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sourceSeasonId = request.nextUrl.searchParams.get("sourceSeasonId"); const targetSeasonId = request.nextUrl.searchParams.get("targetSeasonId");
  const sourceTeamId = request.nextUrl.searchParams.get("sourceTeamId");
  if (!sourceSeasonId || !targetSeasonId) return NextResponse.json({ error: "Seizoenen ontbreken." }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: teams }, { data: pathways }, { data: memberships }, { data: decisions }] = await Promise.all([
    admin.from("club_teams").select("id,name,season_id,copied_from_team_id,teams(id)").eq("club_id", current.clubId).in("season_id", [sourceSeasonId, targetSeasonId]).neq("status", "merged").order("display_order").order("name"),
    admin.from("season_team_pathways").select("source_team_id,target_team_id,priority").order("priority"),
    sourceTeamId ? admin.from("player_team_memberships").select("club_player_id,team_id,club_players(first_name,last_name)").eq("season_id", sourceSeasonId).eq("team_id", sourceTeamId).eq("status", "active") : Promise.resolve({ data: [] }),
    admin.from("season_player_decisions").select("club_player_id,decision,membership_id,player_team_memberships(team_id,teams(club_team_id,club_teams(name)))").eq("season_id", targetSeasonId)
  ]);
  const decisionMap = new Map((decisions ?? []).map(item => [item.club_player_id, item]));
  return NextResponse.json({ teams: teams ?? [], pathways: pathways ?? [], players: (memberships ?? []).map(item => {
    const person = item.club_players as unknown as { first_name: string; last_name: string } | null; const decision = decisionMap.get(item.club_player_id);
    const future = decision?.player_team_memberships as unknown as { teams: { club_teams: { name: string } | null } | null } | null;
    return { id: item.club_player_id, name: `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim(), decision: decision?.decision ?? "UNDECIDED", futureTeamName: future?.teams?.club_teams?.name ?? null };
  }) });
}

export async function POST(request: NextRequest) {
  const current = await context(); if (!current) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json(); const supabase = createClient();
  if (body.action === "seed") {
    const { data, error } = await supabase.rpc("seed_season_player_decisions", { target_club_id: current.clubId, source_season_id: body.sourceSeasonId, target_season_id: body.targetSeasonId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ inserted: data });
  }
  const { data, error } = await supabase.rpc("advance_season_players", { target_club_id: current.clubId, target_season_id: body.targetSeasonId,
    club_player_ids: body.playerIds, new_decision: body.decision, target_club_team_id: body.targetTeamId || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json(data);
}
