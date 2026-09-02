import { NextResponse } from "next/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PLAYER_TEST_TYPES, isKnownTestType } from "@/lib/player-tests";
import { calculateVamevalMas, isValidVamevalDurationSeconds } from "@/lib/vameval";

async function context(playerId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: player } = await admin.from("players").select("id, teams!inner(club_team_id, club_teams!inner(id, club_id))").eq("id", playerId).maybeSingle();
  const team = player?.teams as unknown as { club_team_id: string; club_teams: { id: string; club_id: string } } | null;
  if (!player || !team?.club_teams) return { response: NextResponse.json({ error: "Speler niet gevonden." }, { status: 404 }) };
  const access = await getClubAccess(team.club_teams.club_id, user);
  if (!canAccessTeam(access, team.club_team_id) || !hasClubPermission(access, "tests.view")) {
    return { response: NextResponse.json({ error: "Geen toegang tot de testresultaten van deze speler." }, { status: 403 }) };
  }
  return { user, admin, clubId: team.club_teams.club_id, canManage: hasClubPermission(access, "tests.manage") };
}

export async function GET(_: Request, { params }: { params: { playerId: string } }) {
  const ctx = await context(params.playerId);
  if (ctx.response) return ctx.response;
  const { data: tests, error } = await ctx.admin!.from("player_tests").select("id, test_type, tested_on, results, note, created_at").eq("club_id", ctx.clubId!).eq("player_id", params.playerId).order("tested_on", { ascending: true });
  if (error) return NextResponse.json({ error: "Testresultaten konden niet geladen worden." }, { status: 500 });
  return NextResponse.json({ tests: tests ?? [], canManage: ctx.canManage });
}

export async function POST(request: Request, { params }: { params: { playerId: string } }) {
  const ctx = await context(params.playerId);
  if (ctx.response) return ctx.response;
  if (!ctx.canManage) return NextResponse.json({ error: "Je hebt geen rechten om testresultaten toe te voegen." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const testType = typeof body?.testType === "string" ? body.testType : "";
  const testedOn = typeof body?.testedOn === "string" ? body.testedOn : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!isKnownTestType(testType)) return NextResponse.json({ error: "Onbekend testtype." }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testedOn) || testedOn > today) return NextResponse.json({ error: "Controleer de testdatum." }, { status: 400 });
  if (note.length > 500) return NextResponse.json({ error: "De notitie mag maximaal 500 tekens bevatten." }, { status: 400 });
  const config = PLAYER_TEST_TYPES[testType];
  let results: Record<string, number>;
  if (config.kind === "vameval") {
    // Never trust a client-supplied MAS: always recompute server-side from the raw duration.
    const durationSeconds = Number(body?.results?.duration_seconds);
    if (!isValidVamevalDurationSeconds(durationSeconds)) return NextResponse.json({ error: "Controleer de totale looptijd (minstens 2:00, en realistisch)." }, { status: 400 });
    results = { duration_seconds: durationSeconds, mas_kmh: calculateVamevalMas(durationSeconds) };
  } else {
    results = {};
    for (const field of config.fields) {
      const raw = body?.results?.[field.key];
      if (raw === undefined || raw === null || raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < field.min || value > field.max) return NextResponse.json({ error: `Controleer de waarde voor ${field.label} (${field.min}-${field.max} ${field.unit}).` }, { status: 400 });
      results[field.key] = value;
    }
    if (!Object.keys(results).length) return NextResponse.json({ error: "Vul minstens één veld in." }, { status: 400 });
  }
  const { data: test, error } = await ctx.admin!.from("player_tests").insert({ club_id: ctx.clubId, player_id: params.playerId, test_type: testType, tested_on: testedOn, results, note: note || null, created_by: ctx.user!.id }).select("id").single();
  if (error || !test) return NextResponse.json({ error: error?.message ?? "Testresultaat kon niet worden bewaard." }, { status: 400 });
  return NextResponse.json({ id: test.id }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: { playerId: string } }) {
  const ctx = await context(params.playerId);
  if (ctx.response) return ctx.response;
  if (!ctx.canManage) return NextResponse.json({ error: "Je hebt geen rechten om testresultaten te verwijderen." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const testId = typeof body?.testId === "string" ? body.testId : "";
  if (!testId) return NextResponse.json({ error: "Ongeldig testresultaat." }, { status: 400 });
  const { error } = await ctx.admin!.from("player_tests").delete().eq("id", testId).eq("club_id", ctx.clubId!).eq("player_id", params.playerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
