import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, canAccessTeam, hasClubPermission } from "@/lib/auth/club-access";
import { calculatePhaseRanges, canManageTrainingPhases, phaseForTrainingDate, type SeasonPhaseInput } from "@/lib/training-season-phases";

type SessionInput = {
  date?: string;
  time?: string;
  fieldOptionId?: string | null;
  lockerRoomOptionId?: string | null;
  staffIds?: string[];
  workloadSchemeId?: string | null;
  workloadSequenceNumber?: number | null;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

async function contextFor(teamId: string, mutate = false) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: team } = await admin.from("club_teams").select("id, club_id").eq("id", teamId).eq("club_id", context.activeClubId).maybeSingle();
  if (!team) return { response: NextResponse.json({ error: "Team not found." }, { status: 404 }) };
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!canAccessTeam(access, teamId) || (mutate && (access.readOnly || !hasClubPermission(access, "teams.manage")))) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin, team, user: context.user, canManagePhases: canManageTrainingPhases(access.role, context.isPlatformAdmin) };
}

export async function GET(_request: Request, { params }: { params: { teamId: string } }) {
  const ctx = await contextFor(params.teamId);
  if ("response" in ctx) return ctx.response;
  const { data, error } = await ctx.admin.from("team_training_sessions")
    .select("id, club_id, club_team_id, training_date, start_time, season_phase, field_option_id, locker_room_option_id, staff_ids, series_id")
    .eq("club_team_id", params.teamId).order("training_date").order("start_time");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trainings: data ?? [], canManagePhases: ctx.canManagePhases });
}

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  const ctx = await contextFor(params.teamId, true);
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
  const workloadSchemeIds = new Set(sessions.map(item => item.workloadSchemeId).filter((id): id is string => !!id));
  const [{ data: options }, { data: staff }, { data: schemes }] = await Promise.all([
    optionIds.size ? ctx.admin.from("club_match_options").select("id, option_type").eq("club_id", ctx.team.club_id).eq("active", true).in("id", [...optionIds]) : Promise.resolve({ data: [] }),
    staffIds.size ? ctx.admin.from("club_trainers").select("id").eq("club_id", ctx.team.club_id).in("id", [...staffIds]) : Promise.resolve({ data: [] }),
    workloadSchemeIds.size ? ctx.admin.from("club_workload_schemes").select("id,current_version").eq("club_id", ctx.team.club_id).in("id", [...workloadSchemeIds]) : Promise.resolve({ data: [] })
  ]);
  const optionTypes = new Map((options ?? []).map(option => [option.id, option.option_type]));
  const validStaff = new Set((staff ?? []).map(person => person.id));
  if ([...staffIds].some(id => !validStaff.has(id))) return NextResponse.json({ error: "Ongeldige staffselectie." }, { status: 400 });
  const validSchemes = new Map((schemes ?? []).map(scheme => [scheme.id, scheme.current_version]));
  if ([...workloadSchemeIds].some(id => !validSchemes.has(id))) return NextResponse.json({ error: "Ongeldig workloadschema." }, { status: 400 });

  const seriesId = body?.series ? crypto.randomUUID() : null;
  const rows = sessions.map((item, index) => {
    if (!item.date || !datePattern.test(item.date) || !item.time || !timePattern.test(item.time)) throw new Error("Datum en uur zijn verplicht.");
    if (item.fieldOptionId && optionTypes.get(item.fieldOptionId) !== "field") throw new Error("Selecteer een geldig veld.");
    if (item.lockerRoomOptionId && optionTypes.get(item.lockerRoomOptionId) !== "locker_room") throw new Error("Selecteer een geldige kleedkamer.");
    return {
      club_id: ctx.team.club_id,
      club_team_id: params.teamId,
      training_date: item.date,
      season_phase: sessionPhases[index]!,
      start_time: item.time,
      field_option_id: item.fieldOptionId || null,
      locker_room_option_id: item.lockerRoomOptionId || null,
      staff_ids: item.staffIds ?? [],
      series_id: seriesId,
      created_by: ctx.user.id,
      updated_at: new Date().toISOString()
    };
  });

  try {
    const { data, error } = await ctx.admin.from("team_training_sessions").insert(rows).select("*");
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Op één van deze momenten bestaat al een training." : error.message }, { status: 400 });
    const workloadInputs = sessions.map((item, index) => ({ item, training: data?.[index] })).filter(entry => entry.item.workloadSchemeId && entry.training);
    if (workloadInputs.length) {
      const versionKeys = [...new Set(workloadInputs.map(entry => `${entry.item.workloadSchemeId}:${validSchemes.get(entry.item.workloadSchemeId!)}`))];
      const { data: versions, error: versionsError } = await ctx.admin.from("club_workload_scheme_versions").select("id,scheme_id,version_number").in("scheme_id", [...workloadSchemeIds]);
      if (versionsError) { await ctx.admin.from("team_training_sessions").delete().in("id", (data ?? []).map(item => item.id)); return NextResponse.json({ error: versionsError.message }, { status: 400 }); }
      const currentVersions = new Map((versions ?? []).filter(version => versionKeys.includes(`${version.scheme_id}:${version.version_number}`)).map(version => [version.scheme_id, version.id]));
      const { data: schemeSessions, error: sessionsError } = await ctx.admin.from("club_workload_scheme_sessions").select("id,week_number,session_number,club_workload_scheme_phases!inner(scheme_version_id,display_order)").in("club_workload_scheme_phases.scheme_version_id", [...currentVersions.values()]);
      if (sessionsError) { await ctx.admin.from("team_training_sessions").delete().in("id", (data ?? []).map(item => item.id)); return NextResponse.json({ error: sessionsError.message }, { status: 400 }); }
      const orderedByVersion = new Map<string, string[]>();
      for (const entry of (schemeSessions ?? []) as any[]) { const versionId = entry.club_workload_scheme_phases.scheme_version_id as string; const list = orderedByVersion.get(versionId) ?? []; list.push(entry.id); orderedByVersion.set(versionId, list); }
      for (const [versionId, list] of orderedByVersion) list.sort((a, b) => { const left = (schemeSessions ?? []).find((item: any) => item.id === a) as any; const right = (schemeSessions ?? []).find((item: any) => item.id === b) as any; return left.club_workload_scheme_phases.display_order - right.club_workload_scheme_phases.display_order || left.week_number - right.week_number || left.session_number - right.session_number; });
      const workloadRows = workloadInputs.map(({ item, training }) => { const versionId = currentVersions.get(item.workloadSchemeId!)!; const sequence = Math.max(1, Number(item.workloadSequenceNumber) || 1); const available = orderedByVersion.get(versionId) ?? []; return { training_session_id: training.id, workload_scheme_id: item.workloadSchemeId!, scheme_version_id: versionId, scheme_session_id: available.length ? available[(sequence - 1) % available.length] : null, sequence_number: sequence }; });
      const { error: workloadError } = await ctx.admin.from("team_training_session_workloads").insert(workloadRows);
      if (workloadError) { await ctx.admin.from("team_training_sessions").delete().in("id", (data ?? []).map(item => item.id)); return NextResponse.json({ error: workloadError.message }, { status: 400 }); }
    }
    return NextResponse.json({ trainings: data ?? [] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trainingen konden niet worden toegevoegd." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: { teamId: string } }) {
  const ctx = await contextFor(params.teamId, true);
  if ("response" in ctx) return ctx.response;
  const body = await request.json().catch(() => null) as { trainingId?: string } | null;
  const { error } = await ctx.admin.from("team_training_sessions").delete().eq("id", body?.trainingId ?? "").eq("club_team_id", params.teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
