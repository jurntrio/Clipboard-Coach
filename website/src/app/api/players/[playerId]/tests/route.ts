import { NextResponse } from "next/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

// Test results are entered per team, in bulk, via /api/teams/[teamId]/tests — not per
// individual player. This route stays read (GET) + delete (DELETE, used from the team
// grid) only; there is no POST here on purpose.
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
