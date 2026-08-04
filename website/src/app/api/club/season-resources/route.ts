import { NextRequest, NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function authorized() {
  const context = await getClubContext(); if (!context.user || !context.activeClubId) return null;
  const access = await getClubAccess(context.activeClubId, context.user);
  return ["club_admin", "platform_admin"].includes(access.role) ? { clubId: context.activeClubId } : null;
}

export async function GET(request: NextRequest) {
  const auth = await authorized(); if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const seasonId = request.nextUrl.searchParams.get("seasonId"); if (!seasonId) return NextResponse.json({ error: "Seizoen ontbreekt." }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: teams }, { data: trainers }, { data: groups }, { data: players }] = await Promise.all([
    admin.from("club_teams").select("id,name,season_id,club_trainer_teams(trainer_id,role,status)").eq("club_id",auth.clubId).eq("season_id",seasonId).neq("status","merged").order("display_order").order("name"),
    admin.from("club_trainers").select("id,display_name,profile_id").eq("club_id",auth.clubId).order("display_name"),
    admin.from("player_groups").select("id,name,group_type,icon,player_group_players(player_id,valid_until),player_group_staff(trainer_id)").eq("club_id",auth.clubId).eq("season_id",seasonId).order("name"),
    admin.from("players").select("id,first_name,last_name,membership_id,player_team_memberships!inner(season_id,status,teams(club_team_id,club_teams(name)))").eq("player_team_memberships.season_id",seasonId).eq("player_team_memberships.status","active").eq("role","player")
  ]);
  return NextResponse.json({ teams: teams ?? [], trainers: trainers ?? [], groups: (groups ?? []).map(group => ({ ...group, player_group_players: group.player_group_players.filter(member => !member.valid_until) })), players: (players ?? []).map(player => {
    const membership = player.player_team_memberships as unknown as { teams: { club_teams: { name: string } | null } | null };
    return { id: player.id, name: `${player.first_name} ${player.last_name}`.trim(), teamName: membership.teams?.club_teams?.name ?? "" };
  }) });
}

export async function POST(request: NextRequest) {
  const auth = await authorized(); if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json(); const supabase = createClient();
  if (body.action === "teamStaff") {
    const { data,error }=await supabase.rpc("set_season_team_staff",{target_club_id:auth.clubId,target_season_id:body.seasonId,target_club_team_id:body.teamId,target_trainer_ids:body.trainerIds,staff_role:body.role||"coach"});
    if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({assigned:data});
  }
  if(body.action==="groupComposition"){
    const {data,error}=await supabase.rpc("set_season_group_composition",{target_club_id:auth.clubId,target_season_id:body.seasonId,target_group_id:body.groupId,target_player_ids:body.playerIds,target_trainer_ids:body.trainerIds});
    if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data);
  }
  return NextResponse.json({error:"Unknown action"},{status:400});
}
