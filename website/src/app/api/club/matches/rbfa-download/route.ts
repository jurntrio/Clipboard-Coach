import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { isAdminEmail } from "@/lib/auth/admin";
import { downloadRbfaClubFixtures, filterUnlinkedRbfaFixtures, type RbfaClubFixture } from "@/lib/rbfa-club-downloads";
import { normalizeRbfaDivisionCode } from "@/lib/rbfa-team-suggestions";
import { resolveBelgianClubByName, resolveBelgianClubForClub } from "@/lib/belgian-clubs/resolve-belgian-club-by-name";

async function context(clubId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const admin = createAdminClient();
  const [{ data: club }, { data: membership }, { data: season }] = await Promise.all([
    admin.from("clubs").select("id, name, rbfa_registration_number").eq("id", clubId).maybeSingle(),
    admin.from("club_memberships").select("role").eq("club_id", clubId).eq("profile_id", user.id).eq("status", "active").maybeSingle(),
    admin.from("club_seasons").select("id").eq("club_id", clubId).eq("status", "ACTIVE").maybeSingle()
  ]);
  if (!club) return { error: NextResponse.json({ error: "Club niet gevonden." }, { status: 404 }) };
  if (!season) return { error: NextResponse.json({ error: "De club heeft geen actief seizoen." }, { status: 400 }) };
  if (!isAdminEmail(user.email) && membership?.role !== "club_admin") {
    return { error: NextResponse.json({ error: "Alleen een clubadmin kan officiële reeksen koppelen." }, { status: 403 }) };
  }
  const access = await getClubAccess(club.id, user);
  const platformAdmin = isAdminEmail(user.email);
  if (!platformAdmin && !hasClubPermission(access, "games.create")) {
    return { error: NextResponse.json({ error: "Je mag geen wedstrijden importeren." }, { status: 403 }) };
  }
  if (!club.rbfa_registration_number) {
    return { error: NextResponse.json({ error: "Vul eerst het stamnummer van de club in." }, { status: 400 }) };
  }
  return { admin, club, season, user, access, platformAdmin };
}

export async function GET(request: Request) {
  const clubId = new URL(request.url).searchParams.get("clubId") ?? "";
  const ctx = await context(clubId);
  if (ctx.error) return ctx.error;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Brussels" });
  const fixtures = (await downloadRbfaClubFixtures(ctx.club.name, ctx.club.rbfa_registration_number))
    .filter(fixture => fixture.date >= today && fixture.status !== "finished");
  const [{ data: matches, error }, { data: assignments, error: assignmentError }] = await Promise.all([
    ctx.admin.from("matches").select("club_team_id, match_date, start_time, team_b_name").eq("club_id", ctx.club.id).eq("season_id", ctx.season.id),
    ctx.admin.from("club_official_series_assignments").select("division_code, club_team_id").eq("club_id", ctx.club.id).eq("season_id", ctx.season.id)
  ]);
  if (error || assignmentError) return NextResponse.json({ error: error?.message ?? assignmentError?.message }, { status: 500 });
  const unlinked = filterUnlinkedRbfaFixtures(fixtures, matches ?? []);
  const unlinkedKeys = new Set(unlinked.map(fixture => fixture.key));
  const assignedByCode = new Map((assignments ?? []).map(item => [item.division_code, item.club_team_id]));
  const grouped = new Map<string, { divisionCode: string; fixtureCount: number; unlinkedCount: number; assignedTeamId: string | null }>();
  for (const fixture of fixtures) {
    const divisionCode = normalizeRbfaDivisionCode(fixture.division) || "ZONDER REEKS";
    const current = grouped.get(divisionCode) ?? { divisionCode, fixtureCount: 0, unlinkedCount: 0, assignedTeamId: assignedByCode.get(divisionCode) ?? null };
    current.fixtureCount += 1;
    grouped.set(divisionCode, current);
  }
  for (const fixture of unlinked) {
    const divisionCode = normalizeRbfaDivisionCode(fixture.division) || "ZONDER REEKS";
    const current = grouped.get(divisionCode);
    if (current) current.unlinkedCount += 1;
  }
  return NextResponse.json({
    series: [...grouped.values()].sort((a, b) => a.divisionCode.localeCompare(b.divisionCode, "nl")),
    fixtures: fixtures.map(fixture => ({
      key: fixture.key, divisionCode: normalizeRbfaDivisionCode(fixture.division) || "ZONDER REEKS",
      date: fixture.date, time: fixture.time, homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam,
      ownIsHome: fixture.ownIsHome, linked: !unlinkedKeys.has(fixture.key),
      assignedTeamId: assignedByCode.get(normalizeRbfaDivisionCode(fixture.division) || "ZONDER REEKS") ?? null
    })).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    downloadedAt: new Date().toISOString()
  });
}

type ImportContext = { user: { id: string }; club: { id: string }; season: { id: string } };
type ImportTeam = { id: string; name: string; sponsor_source: string | null; teams: { id: string } | { id: string }[] };

async function matchPayload(ctx: ImportContext, fixture: RbfaClubFixture, team: ImportTeam, ownClubId: string | null, opponentClubIds: Map<string, string | null>, liveTagNames: string[]) {
  const operationalTeam = Array.isArray(team.teams) ? team.teams[0] : team.teams;
  const opponent = fixture.ownIsHome ? fixture.awayTeam : fixture.homeTeam;
  if (!opponentClubIds.has(opponent)) opponentClubIds.set(opponent, await resolveBelgianClubByName(opponent));
  return {
    coach_id: ctx.user.id, club_id: ctx.club.id, season_id: ctx.season.id,
    club_team_id: team.id, team_a_id: operationalTeam.id, team_a_name: team.name,
    team_a_belgian_club_id: ownClubId, team_b_id: null, team_b_name: opponent,
    team_b_belgian_club_id: opponentClubIds.get(opponent), is_home_match: fixture.ownIsHome,
    match_date: fixture.date, start_time: fixture.time, status: fixture.status,
    score_a: fixture.ownIsHome ? fixture.scoreHome : fixture.scoreAway,
    score_b: fixture.ownIsHome ? fixture.scoreAway : fixture.scoreHome,
    live_tag_names: liveTagNames,
    official_series_name: fixture.division || null,
    external_source: "voetbal_vlaanderen_download", external_match_id: `${ctx.club.id}:${fixture.key}`,
    sponsor_source: team.sponsor_source ?? "none", official_referee_name: fixture.referee,
    official_assistant_referee_1_name: fixture.assistantReferee1,
    official_assistant_referee_2_name: fixture.assistantReferee2,
    official_officials_synced_at: new Date().toISOString()
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    clubId?: string;
    divisionCode?: string;
    fixtureKey?: string;
    teamId?: string;
    fixtureAssignments?: Array<{ fixtureKey?: string; teamId?: string }>;
  } | null;
  const fixtureAssignments = (body?.fixtureAssignments ?? []).filter(
    (item): item is { fixtureKey: string; teamId: string } => !!item.fixtureKey && !!item.teamId
  );
  const isBatch = fixtureAssignments.length > 0;
  if (!body?.clubId || (!isBatch && (!body.teamId || (!body.divisionCode && !body.fixtureKey)))) {
    return NextResponse.json({ error: "Ongeldige wedstrijd- of reekskoppeling." }, { status: 400 });
  }
  const ctx = await context(body.clubId);
  if (ctx.error) return ctx.error;
  const divisionCode = normalizeRbfaDivisionCode(body.divisionCode ?? "");
  const requestedTeamIds = [...new Set(isBatch ? fixtureAssignments.map(item => item.teamId) : [body.teamId!])];
  const { data: teams, error: teamError } = await ctx.admin.from("club_teams")
    .select("id, name, sponsor_source, season_id, teams(id)").in("id", requestedTeamIds)
    .eq("club_id", ctx.club.id).eq("season_id", ctx.season.id).eq("status", "active");
  if (teamError || !teams || teams.length !== requestedTeamIds.length) {
    return NextResponse.json({ error: teamError?.message ?? "Een gekozen ploeg werd niet gevonden." }, { status: 400 });
  }
  const teamsById = new Map(teams.map(team => [team.id, team as ImportTeam]));
  for (const team of teams) {
    if (!ctx.platformAdmin && !canAccessTeam(ctx.access, team.id)) return NextResponse.json({ error: "Ploeg niet gevonden." }, { status: 400 });
    const operationalTeam = Array.isArray(team.teams) ? team.teams[0] : team.teams;
    if (!operationalTeam?.id) return NextResponse.json({ error: `De gekozen clubploeg ${team.name} heeft geen operationele ploeg.` }, { status: 400 });
  }
  const team = teamsById.get(body.teamId ?? fixtureAssignments[0].teamId)!;

  if (!isBatch && !body.fixtureKey) {
    const { error: mappingError } = await ctx.admin.from("club_official_series_assignments").upsert({
      club_id: ctx.club.id, season_id: ctx.season.id, division_code: divisionCode,
      club_team_id: team.id, approved_by: ctx.user.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, { onConflict: "club_id,season_id,division_code" });
    if (mappingError) return NextResponse.json({ error: mappingError.message }, { status: 500 });
  }

  const fixtureTeamIds = new Map(fixtureAssignments.map(item => [item.fixtureKey, item.teamId]));
  const fixtures = (await downloadRbfaClubFixtures(ctx.club.name, ctx.club.rbfa_registration_number)).filter(fixture =>
    isBatch ? fixtureTeamIds.has(fixture.key) : body.fixtureKey ? fixture.key === body.fixtureKey : (normalizeRbfaDivisionCode(fixture.division) || "ZONDER REEKS") === divisionCode
  );
  if (!fixtures.length) return NextResponse.json({ error: "Deze reeks komt niet meer voor in de officiële download." }, { status: 409 });
  if (isBatch && fixtures.length !== fixtureTeamIds.size) {
    return NextResponse.json({ error: "Een of meer gekozen wedstrijden komen niet meer voor in de officiële download. Controleer de reeksen opnieuw." }, { status: 409 });
  }
  const ownClubId = await resolveBelgianClubForClub(ctx.club.id);
  const { data: liveTags } = await ctx.admin.from("club_live_tag_templates").select("name").eq("club_id", ctx.club.id).order("display_order").order("created_at");
  const liveTagNames = (liveTags ?? []).map(tag => tag.name);
  const opponentClubIds = new Map<string, string | null>();
  let imported = 0;
  let updated = 0;
  for (const fixture of fixtures) {
    const fixtureTeam = isBatch ? teamsById.get(fixtureTeamIds.get(fixture.key)!)! : team;
    const payload = await matchPayload(ctx, fixture, fixtureTeam, ownClubId, opponentClubIds, liveTagNames);
    const { data: existing } = await ctx.admin.from("matches").select("id, live_tag_names")
      .eq("external_source", "voetbal_vlaanderen_download").eq("external_match_id", payload.external_match_id).maybeSingle();
    const result = existing ? await ctx.admin.from("matches").update({ ...payload, live_tag_names: existing.live_tag_names?.length ? existing.live_tag_names : payload.live_tag_names }).eq("id", existing.id) : await ctx.admin.from("matches").insert(payload);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    if (existing) updated += 1; else imported += 1;
  }
  return NextResponse.json({ imported, updated, total: imported + updated });
}
