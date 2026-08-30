import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORKLOAD_PHASES } from "@/lib/training-workload";

async function authorize(write = false) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return null;
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!access.exists || (write && !["club_admin", "platform_admin"].includes(access.role))) return null;
  return { clubId: context.activeClubId, userId: context.user.id };
}

export async function GET() {
  const auth = await authorize();
  if (!auth) return NextResponse.json({ error: "Geen toegang tot workloadschema’s." }, { status: 403 });
  const { data, error } = await createAdminClient().from("club_workload_schemes")
    .select("id,club_id,system_id,name,description,status,current_version,updated_at,club_workload_scheme_versions(id,version_number,change_note,created_at,club_workload_scheme_phases(id,phase_kind,display_order,duration_weeks,trainings_per_week,training_mode,resume_policy,club_workload_scheme_sessions(id,week_number,session_number,warmup,note,club_workload_scheme_session_blocks(id,category_id,modality_id,display_order,progression_step,match_format,duration_value,duration_unit,repetitions,sets,rest_between_repetitions_seconds,rest_between_sets_seconds,parameters,note))))")
    .eq("club_id", auth.clubId).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ schemes: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorize(true);
  if (!auth) return NextResponse.json({ error: "Alleen een clubbeheerder kan workloadschema’s bewaren." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const systemId = typeof body?.systemId === "string" ? body.systemId : "";
  const phases = Array.isArray(body?.phases) ? body.phases : [];
  if (!name || !systemId || !phases.length) return NextResponse.json({ error: "Geef een naam, systeem en minstens één fase op." }, { status: 400 });
  const normalized = phases.map((phase: any, index: number) => ({
    phase_kind: WORKLOAD_PHASES.includes(phase.phaseKind) ? phase.phaseKind : null,
    display_order: index + 1,
    duration_weeks: Number(phase.durationWeeks),
    trainings_per_week: Number(phase.trainingsPerWeek),
    training_mode: ["regular", "no_training", "running_plan"].includes(phase.trainingMode) ? phase.trainingMode : null,
    resume_policy: ["continue", "restart"].includes(phase.resumePolicy) ? phase.resumePolicy : null
  }));
  if (normalized.some((phase: any) => !phase.phase_kind || !Number.isInteger(phase.duration_weeks) || phase.duration_weeks < 1 || !Number.isInteger(phase.trainings_per_week) || phase.trainings_per_week < 0 || phase.trainings_per_week > 14 || !phase.training_mode || !phase.resume_policy)) {
    return NextResponse.json({ error: "Controleer de fases en het aantal weken." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: system } = await admin.from("club_workload_systems").select("id").eq("id", systemId).eq("club_id", auth.clubId).maybeSingle();
  if (!system) return NextResponse.json({ error: "Workloadsysteem niet gevonden." }, { status: 404 });
  const { data: scheme, error: schemeError } = await admin.from("club_workload_schemes").insert({ club_id: auth.clubId, system_id: systemId, name: name.slice(0, 160), description: typeof body.description === "string" ? body.description.trim().slice(0, 500) : "", created_by: auth.userId, updated_by: auth.userId }).select("id").single();
  if (schemeError || !scheme) return NextResponse.json({ error: schemeError?.message ?? "Schema kon niet worden gemaakt." }, { status: 400 });
  const { data: version, error: versionError } = await admin.from("club_workload_scheme_versions").insert({ scheme_id: scheme.id, version_number: 1, change_note: "Eerste versie", created_by: auth.userId }).select("id").single();
  if (versionError || !version) { await admin.from("club_workload_schemes").delete().eq("id", scheme.id); return NextResponse.json({ error: versionError?.message ?? "Schemaversie kon niet worden gemaakt." }, { status: 400 }); }
  const { data: savedPhases, error: phasesError } = await admin.from("club_workload_scheme_phases").insert(normalized.map((phase: any) => ({ ...phase, scheme_version_id: version.id }))).select("id,display_order");
  if (phasesError || !savedPhases) { await admin.from("club_workload_schemes").delete().eq("id", scheme.id); return NextResponse.json({ error: phasesError?.message ?? "Fases konden niet worden gemaakt." }, { status: 400 }); }
  const phaseIdByOrder = new Map(savedPhases.map(phase => [phase.display_order, phase.id]));
  const sessionInputs = phases.flatMap((phase: any, phaseIndex: number) => Array.isArray(phase.sessions) ? phase.sessions.map((session: any) => ({ phaseIndex, session })) : []);
  const sessionRows = sessionInputs.map(({ phaseIndex, session }: any) => ({ scheme_phase_id: phaseIdByOrder.get(phaseIndex + 1), week_number: Number(session.weekNumber), session_number: Number(session.sessionNumber), warmup: typeof session.warmup === "string" ? session.warmup.trim().slice(0, 300) : "", note: typeof session.note === "string" ? session.note.trim().slice(0, 500) : "" }));
  if (sessionRows.some((row: { scheme_phase_id?: string; week_number: number; session_number: number }) => !row.scheme_phase_id || !Number.isInteger(row.week_number) || row.week_number < 1 || !Number.isInteger(row.session_number) || row.session_number < 1)) { await admin.from("club_workload_schemes").delete().eq("id", scheme.id); return NextResponse.json({ error: "Controleer de trainingen in iedere fase." }, { status: 400 }); }
  if (sessionRows.length) {
    const { data: savedSessions, error: sessionError } = await admin.from("club_workload_scheme_sessions").insert(sessionRows).select("id,scheme_phase_id,week_number,session_number");
    if (sessionError || !savedSessions) { await admin.from("club_workload_schemes").delete().eq("id", scheme.id); return NextResponse.json({ error: sessionError?.message ?? "Trainingen konden niet worden gemaakt." }, { status: 400 }); }
    const sessionId = new Map(savedSessions.map(session => [`${session.scheme_phase_id}:${session.week_number}:${session.session_number}`, session.id]));
    const blockRows = sessionInputs.flatMap(({ phaseIndex, session }: any) => (Array.isArray(session.blocks) ? session.blocks : []).map((block: any, blockIndex: number) => ({ scheme_session_id: sessionId.get(`${phaseIdByOrder.get(phaseIndex + 1)}:${session.weekNumber}:${session.sessionNumber}`), category_id: typeof block.categoryId === "string" ? block.categoryId : "", modality_id: typeof block.modalityId === "string" && block.modalityId ? block.modalityId : null, display_order: blockIndex + 1, progression_step: null, match_format: typeof block.matchFormat === "string" ? block.matchFormat.trim().slice(0, 120) : "", duration_value: positiveNumber(block.durationValue), duration_unit: ["seconds", "minutes", "meters"].includes(block.durationUnit) ? block.durationUnit : null, repetitions: positiveInteger(block.repetitions), sets: positiveInteger(block.sets), rest_between_repetitions_seconds: durationSeconds(block.restBetweenRepetitionsSeconds), rest_between_sets_seconds: durationSeconds(block.restBetweenSetsSeconds), parameters: safeParameters(block.parameters), note: typeof block.note === "string" ? block.note.trim().slice(0, 300) : "" })));
    if (blockRows.length) { const { error: blockError } = await admin.from("club_workload_scheme_session_blocks").insert(blockRows); if (blockError) { await admin.from("club_workload_schemes").delete().eq("id", scheme.id); return NextResponse.json({ error: blockError.message }, { status: 400 }); } }
  }
  return NextResponse.json({ schemeId: scheme.id }, { status: 201 });
}

function positiveInteger(value: unknown) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : null; }
function nonNegativeInteger(value: unknown) { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 0 ? parsed : null; }
function durationSeconds(value: unknown) { if (typeof value === "string" && /^\d{1,3}:\d{2}$/.test(value)) { const [minutes, seconds] = value.split(":").map(Number); return seconds < 60 ? minutes * 60 + seconds : null; } return nonNegativeInteger(value); }
function positiveNumber(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }
function safeParameters(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) return {}; return Object.fromEntries(Object.entries(value).filter(([key, item]) => /^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(key) && (["string", "number", "boolean"].includes(typeof item) || item === null)).slice(0, 20)); }
