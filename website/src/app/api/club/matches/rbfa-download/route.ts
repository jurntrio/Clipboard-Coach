import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { isAdminEmail } from "@/lib/auth/admin";
import { downloadRbfaClubFixtures, filterUnlinkedRbfaFixtures } from "@/lib/rbfa-club-downloads";
import { resolveBelgianClubByName } from "@/lib/belgian-clubs/resolve-belgian-club-by-name";

async function context(clubId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const admin = createAdminClient();
  const [{ data: club }, { data: membership }] = await Promise.all([
    admin.from("clubs").select("id, name, rbfa_registration_number").eq("id", clubId).maybeSingle(),
    admin.from("club_memberships").select("role").eq("club_id", clubId).eq("profile_id", user.id).eq("status", "active").maybeSingle()
  ]);
  if (!club) return { error: NextResponse.json({ error: "Club niet gevonden." }, { status: 404 }) };
  if (!isAdminEmail(user.email) && membership?.role !== "club_admin") {
    return { error: NextResponse.json({ error: "Alleen een clubadmin kan de officiële clubdownload verwerken." }, { status: 403 }) };
  }
  const access = await getClubAccess(club.id, user);
  const platformAdmin = isAdminEmail(user.email);
  if (!platformAdmin && !hasClubPermission(access, "games.create")) {
    return { error: NextResponse.json({ error: "Je mag geen wedstrijden importeren." }, { status: 403 }) };
  }
  if (!club.rbfa_registration_number) {
    return { error: NextResponse.json({ error: "Vul eerst het stamnummer van de club in." }, { status: 400 }) };
  }
  return { admin, club, user, access, platformAdmin };
}

export async function GET(request: Request) {
  const clubId = new URL(request.url).searchParams.get("clubId") ?? "";
  const ctx = await context(clubId);
  if (ctx.error) return ctx.error;
  const fixtures = await downloadRbfaClubFixtures(ctx.club.name, ctx.club.rbfa_registration_number);
  const { data: matches, error } = await ctx.admin.from("matches")
    .select("club_team_id, match_date, start_time, team_b_name").eq("club_id", ctx.club.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fixtures: filterUnlinkedRbfaFixtures(fixtures, matches ?? []), downloadedAt: new Date().toISOString() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    clubId?: string;
    assignments?: Array<{ fixtureKey: string; teamId: string }>;
  } | null;
  if (!body?.clubId || !Array.isArray(body.assignments) || body.assignments.length > 500) {
    return NextResponse.json({ error: "Ongeldige importselectie." }, { status: 400 });
  }
  const ctx = await context(body.clubId);
  if (ctx.error) return ctx.error;
  const fixtures = await downloadRbfaClubFixtures(ctx.club.name, ctx.club.rbfa_registration_number);
  const fixturesByKey = new Map(fixtures.map(fixture => [fixture.key, fixture]));
  const { data: teams, error: teamError } = await ctx.admin.from("club_teams")
    .select("id, name, sponsor_source, teams(id)").eq("club_id", ctx.club.id).eq("status", "active");
  if (teamError) return NextResponse.json({ error: teamError.message }, { status: 500 });
  const teamsById = new Map((teams ?? []).map(team => [team.id, team]));
  let imported = 0;
  let updated = 0;

  for (const assignment of body.assignments) {
    const fixture = fixturesByKey.get(assignment.fixtureKey);
    const team = teamsById.get(assignment.teamId);
    if (!fixture || !team || (!ctx.platformAdmin && !canAccessTeam(ctx.access, team.id))) continue;
    const operationalTeam = Array.isArray(team.teams) ? team.teams[0] : team.teams;
    if (!operationalTeam?.id) continue;
    const opponent = fixture.ownIsHome ? fixture.awayTeam : fixture.homeTeam;
    const [ownClubId, opponentClubId] = await Promise.all([
      resolveBelgianClubByName(team.name),
      resolveBelgianClubByName(opponent)
    ]);
    const externalMatchId = `${ctx.club.id}:${fixture.key}`;
    const payload = {
      coach_id: ctx.user.id,
      club_id: ctx.club.id,
      club_team_id: team.id,
      team_a_id: operationalTeam.id,
      team_a_name: team.name,
      team_a_belgian_club_id: ownClubId,
      team_b_id: null,
      team_b_name: opponent,
      team_b_belgian_club_id: opponentClubId,
      is_home_match: fixture.ownIsHome,
      match_date: fixture.date,
      start_time: fixture.time,
      status: fixture.status,
      score_a: fixture.ownIsHome ? fixture.scoreHome : fixture.scoreAway,
      score_b: fixture.ownIsHome ? fixture.scoreAway : fixture.scoreHome,
      external_source: "voetbal_vlaanderen_download",
      external_match_id: externalMatchId,
      sponsor_source: team.sponsor_source ?? "none"
    };
    const { data: existing } = await ctx.admin.from("matches").select("id")
      .eq("external_source", "voetbal_vlaanderen_download").eq("external_match_id", externalMatchId).maybeSingle();
    const result = existing
      ? await ctx.admin.from("matches").update(payload).eq("id", existing.id)
      : await ctx.admin.from("matches").insert(payload);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    if (existing) updated += 1; else imported += 1;
  }
  return NextResponse.json({ imported, updated, total: imported + updated });
}
