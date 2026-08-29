import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { calculatePhaseRanges, canManageTrainingPhases, phaseForTrainingDate, type SeasonPhaseInput } from "@/lib/training-season-phases";

type SessionInput = { date?: string; time?: string; fieldOptionId?: string | null; lockerRoomOptionId?: string | null; staffIds?: string[] };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

async function contextFor(groupId: string, mutate = false) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: group } = await admin.from("player_groups").select("id, club_id").eq("id", groupId).eq("club_id", context.activeClubId).maybeSingle();
  if (!group) return { response: NextResponse.json({ error: "Extra groep niet gevonden." }, { status: 404 }) };
  const access = await getClubAccess(context.activeClubId, context.user);
  const { data: trainer } = await admin.from("club_trainers").select("id").eq("club_id", group.club_id).eq("profile_id", context.user.id).maybeSingle();
  const { count } = trainer ? await admin.from("player_group_staff").select("group_id", { count: "exact", head: true }).eq("group_id", groupId).eq("trainer_id", trainer.id) : { count: 0 };
  const adminRole = canManageTrainingPhases(access.role, context.isPlatformAdmin);
  if ((!adminRole && !count) || !hasClubPermission(access, "training.view") || (mutate && (access.readOnly || !hasClubPermission(access, "training.manage")))) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin, group, user: context.user, canManagePhases: adminRole };
}

export async function GET(_request: Request, { params }: { params: { groupId: string } }) {
  const ctx = await contextFor(params.groupId);
  if ("response" in ctx) return ctx.response;
  const { data, error } = await ctx.admin.from("team_training_sessions").select("id, club_id, player_group_id, training_date, start_time, season_phase, field_option_id, locker_room_option_id, staff_ids, series_id").eq("player_group_id", params.groupId).order("training_date").order("start_time");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trainings: data ?? [], canManagePhases: ctx.canManagePhases });
}

export async function POST(request: Request, { params }: { params: { groupId: string } }) {
  const ctx = await contextFor(params.groupId, true);
  if ("response" in ctx) return ctx.response;
  if (!ctx.canManagePhases) return NextResponse.json({ error: "Alleen een clubbeheerder kan trainingen met seizoensfases aanmaken." }, { status: 403 });
  const body = await request.json().catch(() => null) as { sessions?: SessionInput[]; series?: boolean; phases?: SeasonPhaseInput[] } | null;
  const sessions = body?.sessions ?? [];
  if (!sessions.length || sessions.length > 370) return NextResponse.json({ error: "Voeg minstens één geldige training toe." }, { status: 400 });
  const phaseResult = calculatePhaseRanges(body?.phases ?? []);
  if (phaseResult.error) return NextResponse.json({ error: phaseResult.error }, { status: 400 });
  const sessionPhases = sessions.map(item => item.date ? phaseForTrainingDate(item.date, phaseResult.ranges) : null);
  if (sessionPhases.some(phase => !phase)) return NextResponse.json({ error: "Iedere trainingsdatum moet binnen exact één seizoensfase vallen." }, { status: 400 });
  const optionIds = new Set(sessions.flatMap(item => [item.fieldOptionId, item.lockerRoomOptionId]).filter((id): id is string => !!id));
  const staffIds = new Set(sessions.flatMap(item => item.staffIds ?? []));
  const [{ data: options }, { data: staff }] = await Promise.all([
    optionIds.size ? ctx.admin.from("club_match_options").select("id, option_type").eq("club_id", ctx.group.club_id).eq("active", true).in("id", [...optionIds]) : Promise.resolve({ data: [] }),
    staffIds.size ? ctx.admin.from("club_trainers").select("id").eq("club_id", ctx.group.club_id).in("id", [...staffIds]) : Promise.resolve({ data: [] })
  ]);
  const optionTypes = new Map((options ?? []).map(option => [option.id, option.option_type]));
  if ([...staffIds].some(id => !(staff ?? []).some(person => person.id === id))) return NextResponse.json({ error: "Ongeldige staffselectie." }, { status: 400 });
  try {
    const seriesId = body?.series ? crypto.randomUUID() : null;
    const rows = sessions.map((item, index) => {
      if (!item.date || !datePattern.test(item.date) || !item.time || !timePattern.test(item.time)) throw new Error("Datum en uur zijn verplicht.");
      if (item.fieldOptionId && optionTypes.get(item.fieldOptionId) !== "field") throw new Error("Selecteer een geldig veld.");
      if (item.lockerRoomOptionId && optionTypes.get(item.lockerRoomOptionId) !== "locker_room") throw new Error("Selecteer een geldige kleedkamer.");
      return { club_id: ctx.group.club_id, club_team_id: null, player_group_id: params.groupId, training_date: item.date, season_phase: sessionPhases[index]!, start_time: item.time, field_option_id: item.fieldOptionId || null, locker_room_option_id: item.lockerRoomOptionId || null, staff_ids: item.staffIds ?? [], series_id: seriesId, created_by: ctx.user.id, updated_at: new Date().toISOString() };
    });
    const { data, error } = await ctx.admin.from("team_training_sessions").insert(rows).select("*");
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Op één van deze momenten bestaat al een training." : error.message }, { status: 400 });
    return NextResponse.json({ trainings: data ?? [] }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Trainingen konden niet worden toegevoegd." }, { status: 400 }); }
}

export async function DELETE(request: Request, { params }: { params: { groupId: string } }) {
  const ctx = await contextFor(params.groupId, true);
  if ("response" in ctx) return ctx.response;
  const body = await request.json().catch(() => null) as { trainingId?: string } | null;
  const { error } = await ctx.admin.from("team_training_sessions").delete().eq("id", body?.trainingId ?? "").eq("player_group_id", params.groupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
