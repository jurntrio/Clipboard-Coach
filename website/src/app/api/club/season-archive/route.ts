import { NextRequest, NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

type Person={id:string;first_name:string;last_name:string};
const array=<T,>(value:T|T[]|null):T[]=>value?Array.isArray(value)?value:[value]:[];

export async function GET(request:NextRequest){
  const context=await getClubContext();if(!context.user||!context.activeClubId)return NextResponse.json({error:"Niet aangemeld."},{status:401});
  const access=await getClubAccess(context.activeClubId,context.user);if(!["club_admin","club_admin_viewer","platform_admin"].includes(access.role))return NextResponse.json({error:"Geen toegang tot het seizoensarchief."},{status:403});
  const seasonId=request.nextUrl.searchParams.get("seasonId");const requestedTeamId=request.nextUrl.searchParams.get("teamId");if(!seasonId)return NextResponse.json({error:"Seizoen ontbreekt."},{status:400});
  const admin=createAdminClient();const {data:season}=await admin.from("club_seasons").select("id,name,status,starts_on,ends_on").eq("id",seasonId).eq("club_id",context.activeClubId).maybeSingle();
  if(!season||season.status!=="ARCHIVED")return NextResponse.json({error:"Alleen gearchiveerde seizoenen zijn hier beschikbaar."},{status:404});
  const {data:teams}=await admin.from("club_teams").select("id,name,display_order,teams(id)").eq("club_id",context.activeClubId).eq("season_id",seasonId).neq("status","merged").order("display_order").order("name");
  const team=(teams??[]).find(item=>item.id===requestedTeamId)??(teams??[])[0]??null;if(!team)return NextResponse.json({season,teams:[],team:null});
  const operationalIds=array(team.teams as unknown as {id:string}|{id:string}[]|null).map(item=>item.id);
  const [{data:memberships},{data:staff},{data:sessions},{data:matches},{data:groups}]=await Promise.all([
    operationalIds.length?admin.from("player_team_memberships").select("team_id,joined_at,left_at,valid_from,valid_until,membership_type,status,players!players_membership_id_fkey(id,first_name,last_name)").eq("season_id",seasonId).in("team_id",operationalIds):Promise.resolve({data:[]}),
    admin.from("club_trainer_teams").select("role,status,club_trainers(display_name)").eq("season_id",seasonId).eq("club_team_id",team.id),
    admin.from("team_training_sessions").select("id,training_date,start_time,trainer_info,club_training_id,attendance_confirmed_at").eq("season_id",seasonId).eq("club_team_id",team.id).order("training_date",{ascending:false}),
    admin.from("matches").select("id,team_a_name,team_b_name,match_date,start_time,status,score_a,score_b,match_dossiers(lineup_notes,general_report,positives,improvements,highlights,goals,cards,chances),match_videos(id)").eq("season_id",seasonId).eq("club_team_id",team.id).order("match_date",{ascending:false}),
    admin.from("player_groups").select("id,name,icon,group_type,player_group_players(player_id,valid_from,valid_until),player_group_staff(club_trainers(display_name))").eq("season_id",seasonId).eq("club_id",context.activeClubId).order("name")
  ]);
  const sessionIds=(sessions??[]).map(item=>item.id);const {data:attendance}=sessionIds.length?await admin.from("team_training_attendance").select("training_session_id,player_id,attendance_status").in("training_session_id",sessionIds):{data:[]};
  const sessionDate=new Map((sessions??[]).map(item=>[item.id,item.training_date]));
  const roster=(memberships??[]).flatMap(membership=>array(membership.players as unknown as Person|Person[]|null).map(person=>{
    const from=membership.valid_from??membership.joined_at;const until=membership.valid_until??membership.left_at;const eligible=(attendance??[]).filter(row=>row.player_id===person.id&&sessionDate.get(row.training_session_id)!>=from&&(!until||sessionDate.get(row.training_session_id)!<=until));
    const present=eligible.filter(row=>row.attendance_status==="present").length;const injured=eligible.filter(row=>row.attendance_status==="injured").length;const absent=eligible.filter(row=>row.attendance_status==="absent").length;const total=present+injured+absent;
    return{id:person.id,name:`${person.first_name} ${person.last_name}`.trim(),membershipType:membership.membership_type,validFrom:from,validUntil:until,statistics:{trainings:total,present,injured,absent,percentage:total?Math.round(present/total*1000)/10:0}};
  }));
  const evaluationsPlayerIds=new Set((groups??[]).flatMap(group=>group.player_group_players.map(member=>member.player_id)));const {data:evaluations}=evaluationsPlayerIds.size?await admin.from("player_group_evaluations").select("id,group_id,player_id,score,note,evaluated_at,player_group_evaluation_criteria(name),profiles(email)").eq("season_id",seasonId).in("player_id",[...evaluationsPlayerIds]).order("evaluated_at",{ascending:false}):{data:[]};
  return NextResponse.json({season,teams:(teams??[]).map(item=>({id:item.id,name:item.name})),team:{id:team.id,name:team.name},roster,staff:(staff??[]).map(item=>({role:item.role,status:item.status,name:(item.club_trainers as unknown as {display_name:string}|null)?.display_name??""})),sessions:sessions??[],matches:matches??[],groups:groups??[],evaluations:evaluations??[]});
}
