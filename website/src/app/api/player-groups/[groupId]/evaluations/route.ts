import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

async function groupContext(groupId: string) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: group } = await admin.from("player_groups").select("id, club_id, name").eq("id", groupId).eq("club_id", context.activeClubId).maybeSingle();
  if (!group) return { response: NextResponse.json({ error: "Extra groep niet gevonden." }, { status: 404 }) };
  const access = await getClubAccess(group.club_id, context.user);
  const { data: trainer } = await admin.from("club_trainers").select("id").eq("club_id", group.club_id).eq("profile_id", context.user.id).maybeSingle();
  const { count } = trainer ? await admin.from("player_group_staff").select("group_id", { count: "exact", head: true }).eq("group_id", groupId).eq("trainer_id", trainer.id) : { count: 0 };
  const adminRole = context.isPlatformAdmin || access.role === "platform_admin" || access.role === "club_admin";
  if ((!adminRole && !count) || access.readOnly || !hasClubPermission(access, "training.manage")) return { response: NextResponse.json({ error: "Geen evaluatierechten voor deze Extra groep." }, { status: 403 }) };
  return { context, admin, group };
}

export async function GET(request: Request, { params }: { params: { groupId: string } }) {
  const ctx = await groupContext(params.groupId);
  if ("response" in ctx) return ctx.response;
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const [{ data: criteria }, { data: evaluations }] = await Promise.all([
    ctx.admin.from("player_group_evaluation_criteria").select("id, name, description, sort_order").eq("group_id", params.groupId).eq("active", true).order("sort_order"),
    sessionId ? ctx.admin.from("player_group_evaluations").select("id, criterion_id, player_id, score, note, evaluated_at").eq("group_id", params.groupId).eq("training_session_id", sessionId) : Promise.resolve({ data: [] })
  ]);
  return NextResponse.json({ criteria: criteria ?? [], evaluations: evaluations ?? [] });
}

export async function PUT(request: Request, { params }: { params: { groupId: string } }) {
  const ctx = await groupContext(params.groupId);
  if ("response" in ctx) return ctx.response;
  const body = await request.json().catch(() => null) as { playerId?: string; criterionId?: string; sessionId?: string; score?: number; note?: string } | null;
  if (!body?.playerId || !body.criterionId || !body.sessionId || !Number.isInteger(body.score) || body.score! < 1 || body.score! > 5) return NextResponse.json({ error: "Ongeldige evaluatie." }, { status: 400 });
  const [{ count: playerCount }, { count: criterionCount }, { count: sessionCount }] = await Promise.all([
    ctx.admin.from("player_group_players").select("group_id", { count: "exact", head: true }).eq("group_id", params.groupId).eq("player_id", body.playerId),
    ctx.admin.from("player_group_evaluation_criteria").select("id", { count: "exact", head: true }).eq("id", body.criterionId).eq("group_id", params.groupId).eq("active", true),
    ctx.admin.from("team_training_sessions").select("id", { count: "exact", head: true }).eq("id", body.sessionId).eq("player_group_id", params.groupId)
  ]);
  if (!playerCount || !criterionCount || !sessionCount) return NextResponse.json({ error: "Speler, criterium of training behoort niet tot deze Extra groep." }, { status: 400 });
  const { data, error } = await ctx.admin.from("player_group_evaluations").upsert({ group_id: params.groupId, player_id: body.playerId, criterion_id: body.criterionId, training_session_id: body.sessionId, evaluator_id: ctx.context.user!.id, score: body.score, note: body.note?.trim().slice(0, 1000) || null, evaluated_at: new Date().toISOString() }, { onConflict: "group_id,criterion_id,player_id,training_session_id" }).select("id, criterion_id, player_id, score, note, evaluated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ evaluation: data });
}
