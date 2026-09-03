import { NextResponse } from "next/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PLAYER_TEST_TYPES, isKnownTestType, validateTestResults } from "@/lib/player-tests";

async function context(teamId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: team } = await admin.from("teams").select("id, players(id, first_name, last_name, role), club_teams!inner(id, club_id)").eq("id", teamId).maybeSingle();
  const clubTeam = team?.club_teams as unknown as { id: string; club_id: string } | null;
  if (!team || !clubTeam) return { response: NextResponse.json({ error: "Team niet gevonden." }, { status: 404 }) };
  const access = await getClubAccess(clubTeam.club_id, user);
  if (!canAccessTeam(access, clubTeam.id) || !hasClubPermission(access, "tests.view")) {
    return { response: NextResponse.json({ error: "Geen toegang tot de testresultaten van dit team." }, { status: 403 }) };
  }
  const roster = ((team.players ?? []) as Array<{ id: string; first_name: string; last_name: string; role: string }>).filter((player) => player.role === "player");
  return { user, admin, clubId: clubTeam.club_id, roster, canManage: hasClubPermission(access, "tests.manage") };
}

export async function GET(_: Request, { params }: { params: { teamId: string } }) {
  const ctx = await context(params.teamId);
  if (ctx.response) return ctx.response;
  const playerIds = ctx.roster!.map((player) => player.id);
  const { data: tests, error } = playerIds.length
    ? await ctx.admin!.from("player_tests").select("id, player_id, test_type, tested_on, results, note, created_at").eq("club_id", ctx.clubId!).in("player_id", playerIds).order("tested_on", { ascending: true })
    : { data: [], error: null };
  if (error) return NextResponse.json({ error: "Testresultaten konden niet geladen worden." }, { status: 500 });
  const players = [...ctx.roster!].sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)).map(({ id, first_name, last_name }) => ({ id, first_name, last_name }));
  return NextResponse.json({ players, tests: tests ?? [], canManage: ctx.canManage });
}

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  const ctx = await context(params.teamId);
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
  const entries = body?.entries && typeof body.entries === "object" ? body.entries as Record<string, unknown> : {};
  const rosterIds = new Set(ctx.roster!.map((player) => player.id));
  const config = PLAYER_TEST_TYPES[testType];
  const rows: { club_id: string; player_id: string; test_type: string; tested_on: string; results: Record<string, number>; note: string | null; created_by: string }[] = [];
  for (const [playerId, rawResults] of Object.entries(entries)) {
    if (!rosterIds.has(playerId)) continue;
    const validated = validateTestResults(config, rawResults);
    if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });
    if (!Object.keys(validated.results).length) continue;
    rows.push({ club_id: ctx.clubId!, player_id: playerId, test_type: testType, tested_on: testedOn, results: validated.results, note: note || null, created_by: ctx.user!.id });
  }
  if (!rows.length) return NextResponse.json({ error: "Vul minstens één speler in." }, { status: 400 });
  const { data: inserted, error } = await ctx.admin!.from("player_tests")
    .upsert(rows, { onConflict: "club_id,player_id,test_type,tested_on" })
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ insertedCount: inserted?.length ?? 0 }, { status: 201 });
}
