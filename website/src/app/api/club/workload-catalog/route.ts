import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

const TORHOUT_CATEGORIES = [
  { code: "WARMUP", name: "Opwarming", color: "#a3a3a3", modalities: ["Loop ABC, sprong ABC", "Complextraining", "Frequentie, amplitude, coördinatieloop", "Versnellen, afremmen (kracht integreren)", "YOYO Test"] },
  { code: "EXPLOSIVITY", name: "Explosiviteit", color: "#ef4444", modalities: ["HIRuns", "SUV", "HKSV", "VSV", "STS", "IMT", "SVV"] },
  { code: "ENDURANCE", name: "Uithouding", color: "#3b82f6", modalities: ["EDT", "IDT", "EIT", "IIT"] },
  { code: "STRENGTH", name: "Kracht", color: "#facc15", modalities: ["Krachtuithouding", "Specifieke kracht", "Snelkracht", "Explosieve kracht", "Algemene kracht", "Plyometrie"] }
] as const;

async function authorize(write = false) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return null;
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!access.exists || (write && !["club_admin", "platform_admin"].includes(access.role))) return null;
  return { clubId: context.activeClubId, userId: context.user.id, readOnly: access.readOnly };
}

export async function GET() {
  const auth = await authorize();
  if (!auth) return NextResponse.json({ error: "Geen toegang tot workloadbeheer." }, { status: 403 });
  const admin = createAdminClient();
  const { data: systems, error } = await admin.from("club_workload_systems")
    .select("id,club_id,name,description,source,active,club_workload_categories(id,system_id,code,name,color,display_order,active,club_workload_modalities(id,category_id,code,name,description,color,active))")
    .eq("club_id", auth.clubId).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ systems: systems ?? [], readOnly: auth.readOnly });
}

export async function POST(request: Request) {
  const auth = await authorize(true);
  if (!auth) return NextResponse.json({ error: "Alleen een clubbeheerder kan de workloadbibliotheek wijzigen." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const admin = createAdminClient();
  if (body?.action === "initializeTorhout") {
    const { data: existing } = await admin.from("club_workload_systems").select("id").eq("club_id", auth.clubId).eq("name", "KM Torhout-basis").maybeSingle();
    let systemId = existing?.id ?? "";
    if (!systemId) {
      const { data: system, error } = await admin.from("club_workload_systems").insert({ club_id: auth.clubId, name: "KM Torhout-basis", description: "Basisstructuur uit de aangeleverde jaarplanning en tijden.", source: "import", created_by: auth.userId }).select("id").single();
      if (error || !system) return NextResponse.json({ error: error?.message ?? "Basissysteem kon niet worden gemaakt." }, { status: 400 });
      systemId = system.id;
    }
    const { count: categoryCount } = await admin.from("club_workload_categories").select("id", { count: "exact", head: true }).eq("system_id", systemId);
    if (!categoryCount) for (const [index, category] of TORHOUT_CATEGORIES.entries()) {
      const { data: savedCategory, error: categoryError } = await admin.from("club_workload_categories").insert({ system_id: systemId, code: category.code, name: category.name, color: category.color, display_order: index + 1 }).select("id").single();
      if (categoryError || !savedCategory) return NextResponse.json({ error: categoryError?.message ?? "Categorie kon niet worden gemaakt." }, { status: 400 });
      const { error: modalitiesError } = await admin.from("club_workload_modalities").insert(category.modalities.map(name => ({ category_id: savedCategory.id, code: normalizeCode(name), name, color: category.color })));
      if (modalitiesError) return NextResponse.json({ error: modalitiesError.message }, { status: 400 });
    }
    const { data: savedCatalog } = await admin.from("club_workload_categories").select("id,code,color,club_workload_modalities(code)").eq("system_id", systemId);
    for (const category of TORHOUT_CATEGORIES) {
      const saved = savedCatalog?.find(item => item.code === category.code); if (!saved) continue;
      const existingCodes = new Set((saved.club_workload_modalities ?? []).map(item => item.code));
      const missing = category.modalities.filter(name => !existingCodes.has(normalizeCode(name)));
      if (missing.length) { const { error } = await admin.from("club_workload_modalities").insert(missing.map(name => ({ category_id: saved.id, code: normalizeCode(name), name, color: saved.color }))); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); }
    }
    const schemeResult = await ensureTorhoutThreeSessions(admin, auth.clubId, auth.userId, systemId);
    if (schemeResult.error) return NextResponse.json({ error: schemeResult.error }, { status: 400 });
    return NextResponse.json({ systemId, schemeId: schemeResult.schemeId, existing: !!existing }, { status: existing ? 200 : 201 });
  }
  if (body?.action === "addCategory") {
    const systemId = typeof body.systemId === "string" ? body.systemId : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!systemId || !name) return NextResponse.json({ error: "Kies een systeem en geef een categorienaam op." }, { status: 400 });
    const { data: system } = await admin.from("club_workload_systems").select("id").eq("id", systemId).eq("club_id", auth.clubId).maybeSingle();
    if (!system) return NextResponse.json({ error: "Workloadsysteem niet gevonden." }, { status: 404 });
    const { count } = await admin.from("club_workload_categories").select("id", { count: "exact", head: true }).eq("system_id", systemId);
    const { error } = await admin.from("club_workload_categories").insert({ system_id: systemId, code: normalizeCode(name), name: name.slice(0, 120), color: validColor(body.color), display_order: (count ?? 0) + 1 });
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Deze categorie bestaat al." : error.message }, { status: error.code === "23505" ? 409 : 400 });
    return NextResponse.json({ ok: true }, { status: 201 });
  }
  if (body?.action === "addModality") {
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!categoryId || !name) return NextResponse.json({ error: "Kies een categorie en geef een naam op." }, { status: 400 });
    const { data: category } = await admin.from("club_workload_categories").select("id,color,club_workload_systems!inner(club_id)").eq("id", categoryId).eq("club_workload_systems.club_id", auth.clubId).maybeSingle();
    if (!category) return NextResponse.json({ error: "Workloadcategorie niet gevonden." }, { status: 404 });
    const { error } = await admin.from("club_workload_modalities").insert({ category_id: categoryId, code: normalizeCode(name), name: name.slice(0, 120), description: typeof body.description === "string" ? body.description.trim().slice(0, 500) : "", color: validColor(body.color || category.color) });
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Deze mogelijkheid bestaat al in de categorie." : error.message }, { status: error.code === "23505" ? 409 : 400 });
    return NextResponse.json({ ok: true }, { status: 201 });
  }
  return NextResponse.json({ error: "Onbekende workloadactie." }, { status: 400 });
}

function normalizeCode(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40); }
function validColor(value: unknown) { return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#22c55e"; }

async function ensureTorhoutThreeSessions(admin: ReturnType<typeof createAdminClient>, clubId: string, userId: string, systemId: string) {
  const name = "KM Torhout 3 trainingen/week";
  const { data: existing } = await admin.from("club_workload_schemes").select("id").eq("club_id", clubId).eq("name", name).maybeSingle();
  if (existing) return { schemeId: existing.id };
  const { data: categories, error: catalogError } = await admin.from("club_workload_categories").select("id,code,club_workload_modalities(id,code,name)").eq("system_id", systemId);
  if (catalogError || !categories?.length) return { error: catalogError?.message ?? "Workloadbibliotheek is onvolledig." };
  const categoryByCode = new Map(categories.map(category => [category.code, category]));
  const modalityByName = new Map(categories.flatMap(category => (category.club_workload_modalities ?? []).map(modality => [modality.name, modality] as const)));
  const { data: scheme, error: schemeError } = await admin.from("club_workload_schemes").insert({ club_id: clubId, system_id: systemId, name, description: "Drie trainingen per week volgens Jaarplanning-en-tijden: 3 voorbereidingsweken en 32 competitieweken.", status: "published", created_by: userId, updated_by: userId }).select("id").single();
  if (schemeError || !scheme) return { error: schemeError?.message ?? "KM Torhout-schema kon niet worden gemaakt." };
  const { data: version, error: versionError } = await admin.from("club_workload_scheme_versions").insert({ scheme_id: scheme.id, version_number: 1, change_note: "Import uit Jaarplanning-en-tijden", created_by: userId }).select("id").single();
  if (versionError || !version) return { error: versionError?.message ?? "Schemaversie kon niet worden gemaakt." };
  const { data: savedPhases, error: phaseError } = await admin.from("club_workload_scheme_phases").insert([{ scheme_version_id: version.id, phase_kind: "Voorbereiding", display_order: 1, duration_weeks: 3, trainings_per_week: 3, training_mode: "regular", resume_policy: "continue" }, { scheme_version_id: version.id, phase_kind: "Competitie", display_order: 2, duration_weeks: 32, trainings_per_week: 3, training_mode: "regular", resume_policy: "continue" }]).select("id,display_order");
  if (phaseError || !savedPhases) return { error: phaseError?.message ?? "Schemafases konden niet worden gemaakt." };
  const phaseIds = new Map(savedPhases.map(phase => [phase.display_order, phase.id]));
  const plans: Array<{ phase: number; week: number; session: number; endurance: string; enduranceStep: number; explosive?: string; explosiveStep?: number; warmup: string; strength: string }> = [];
  for (let week = 1; week <= 3; week++) for (let session = 1; session <= 3; session++) plans.push({ phase: 1, week, session, endurance: week < 3 ? "EDT" : "IDT", enduranceStep: week < 3 ? week : 1, explosive: "SVV", explosiveStep: week === 1 ? (session === 3 ? 2 : 1) : week === 2 ? (session === 1 ? 2 : 3) : (session === 3 ? 5 : 4), warmup: week === 1 ? "Loop ABC, sprong ABC" : week === 2 ? "Frequentie, amplitude, coördinatieloop" : "Versnellen, afremmen (kracht integreren)", strength: week < 3 ? "Krachtuithouding" : "Algemene kracht" });
  for (let week = 1; week <= 32; week++) for (let session = 1; session <= 3; session++) { const odd = week % 2 === 1; const endurance = session === 2 ? (odd ? "EIT" : "IDT") : (odd ? "EDT" : "IDT"); const enduranceStep = session === 2 && odd ? Math.min(11, Math.floor((week - 1) / 4) + 1) : session === 2 ? Math.min(12, Math.floor((week - 2) / 4) + 2) : Math.min(12, Math.floor((week - 1) / 4) + 3); let explosive: string | undefined; if (session === 1) explosive = odd ? "HIRuns" : "IMT"; if (session === 2) explosive = week % 4 === 1 ? "VSV" : week % 4 === 3 ? "STS" : week % 4 === 2 ? "SUV" : "HKSV"; const explosiveStep = explosive ? Math.min(11, Math.floor((week - 1) / 4) + 1) : undefined; plans.push({ phase: 2, week, session, endurance, enduranceStep, explosive, explosiveStep, warmup: session === 2 && odd ? "Complextraining" : session === 1 || (session === 3 && odd) ? "Loop ABC, sprong ABC" : "Versnellen, afremmen (kracht integreren)", strength: session === 2 && odd ? (week % 4 === 3 ? "Plyometrie" : "Snelkracht") : session === 1 || (session === 3 && odd) ? "Krachtuithouding" : "Algemene kracht" }); }
  const { data: savedSessions, error: sessionError } = await admin.from("club_workload_scheme_sessions").insert(plans.map(plan => ({ scheme_phase_id: phaseIds.get(plan.phase)!, week_number: plan.week, session_number: plan.session, warmup: plan.warmup, note: `Training ${plan.phase === 1 ? `V${(plan.week - 1) * 3 + plan.session}` : (plan.week - 1) * 3 + plan.session}` }))).select("id,scheme_phase_id,week_number,session_number");
  if (sessionError || !savedSessions) return { error: sessionError?.message ?? "Workloadtrainingen konden niet worden gemaakt." };
  const sessionId = new Map(savedSessions.map(session => [`${session.scheme_phase_id}:${session.week_number}:${session.session_number}`, session.id]));
  const blocks = plans.flatMap(plan => { const id = sessionId.get(`${phaseIds.get(plan.phase)}:${plan.week}:${plan.session}`)!; const values = [{ category: "ENDURANCE", modality: plan.endurance, step: plan.enduranceStep }, ...(plan.explosive ? [{ category: "EXPLOSIVITY", modality: plan.explosive, step: plan.explosiveStep }] : []), { category: "STRENGTH", modality: plan.strength }, { category: "WARMUP", modality: plan.warmup }]; return values.map((value, index) => ({ scheme_session_id: id, category_id: categoryByCode.get(value.category)!.id, modality_id: modalityByName.get(value.modality)?.id ?? null, display_order: index + 1, progression_step: value.step ?? null, match_format: value.modality === "EDT" ? "8v8 - 10v10" : value.modality === "IDT" ? "5v5 - 7v7" : value.modality === "EIT" ? "3v3 - 4v4" : "" })); });
  const { error: blockError } = await admin.from("club_workload_scheme_session_blocks").insert(blocks);
  return blockError ? { error: blockError.message } : { schemeId: scheme.id };
}
