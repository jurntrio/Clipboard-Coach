import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const access = await getClubAccess(context.activeClubId, context.user);
  if (access.readOnly || !hasClubPermission(access, "training.manage")) return NextResponse.json({ error: "Je mag trainingen niet indelen." }, { status: 403 });
  const body = await request.json().catch(() => null) as { trainingId?: string; teamId?: string | null } | null;
  if (!body?.trainingId) return NextResponse.json({ error: "Training ontbreekt." }, { status: 400 });
  const admin = createAdminClient();
  const { data: training } = await admin.from("club_trainings").select("id").eq("id", body.trainingId).eq("club_id", context.activeClubId).maybeSingle();
  if (!training) return NextResponse.json({ error: "Training niet gevonden." }, { status: 404 });
  let seasonId: string | null = null;
  if (body.teamId) {
    const { data: team } = await admin.from("club_teams").select("id,season_id").eq("id", body.teamId).eq("club_id", context.activeClubId).maybeSingle();
    if (!team || !canAccessTeam(access, team.id)) return NextResponse.json({ error: "Geen toegang tot deze ploeg." }, { status: 403 });
    seasonId = team.season_id;
  }
  const { error } = await admin.from("club_trainings").update({ club_team_id: body.teamId || null, season_id: seasonId, updated_at: new Date().toISOString(), updated_by: context.user.id }).eq("id", body.trainingId).eq("club_id", context.activeClubId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, seasonId });
}
