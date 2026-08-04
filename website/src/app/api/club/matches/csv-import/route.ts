import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseClubMatchCsv } from "@/lib/club-match-csv";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { resolveBelgianClubByName } from "@/lib/belgian-clubs/resolve-belgian-club-by-name";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const body = await request.json().catch(() => null) as { teamId?: string; csv?: string } | null;
  if (!body?.teamId || typeof body.csv !== "string") return NextResponse.json({ error: "Kies een ploeg en CSV-bestand." }, { status: 400 });
  const admin = createAdminClient();
  const { data: team } = await admin.from("club_teams").select("id, club_id, name, sponsor_source").eq("id", body.teamId).maybeSingle();
  if (!team) return NextResponse.json({ error: "Ploeg niet gevonden." }, { status: 404 });
  const access = await getClubAccess(team.club_id, user);
  if (!hasClubPermission(access, "games.create") || !canAccessTeam(access, team.id)) {
    return NextResponse.json({ error: "Je mag geen wedstrijden toevoegen voor deze ploeg." }, { status: 403 });
  }
  let rows;
  try { rows = parseClubMatchCsv(body.csv); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ongeldige CSV." }, { status: 400 }); }
  if (rows.length > 500) return NextResponse.json({ error: "Een CSV mag maximaal 500 wedstrijden bevatten." }, { status: 400 });
  const { data: operationalTeam } = await admin.from("teams").select("id").eq("club_team_id", team.id).maybeSingle();
  if (!operationalTeam) return NextResponse.json({
    error: "De gekozen ploeg is intern nog niet klaar voor wedstrijden. Sla de ploeg opnieuw op en probeer daarna opnieuw."
  }, { status: 400 });
  let imported = 0;
  let updated = 0;
  for (const row of rows) {
    const signature = `${team.id}|${row.date}|${row.time}|${row.homeTeam}|${row.awayTeam}`;
    const externalMatchId = `${team.id}:${createHash("sha256").update(signature).digest("hex").slice(0, 24)}`;
    // home_team/away_team are literal, not "own team" vs "opponent" (that
    // depends on row.isHome), so both are resolved independently.
    const [teamABelgianClubId, teamBBelgianClubId] = await Promise.all([
      resolveBelgianClubByName(row.homeTeam),
      resolveBelgianClubByName(row.awayTeam)
    ]);
    const payload = {
      coach_id: user.id, club_id: team.club_id, club_team_id: team.id, team_a_id: operationalTeam.id,
      team_a_name: row.homeTeam, team_a_belgian_club_id: teamABelgianClubId,
      team_b_name: row.awayTeam, team_b_belgian_club_id: teamBBelgianClubId,
      is_home_match: row.isHome,
      match_date: row.date, start_time: row.time, status: row.status, score_a: row.scoreHome, score_b: row.scoreAway,
      external_source: "voetbal_vlaanderen_csv", external_match_id: externalMatchId,
      sponsor_source: team.sponsor_source ?? "none"
    };
    const { data: existing } = await admin.from("matches").select("id")
      .eq("external_source", "voetbal_vlaanderen_csv").eq("external_match_id", externalMatchId).maybeSingle();
    const result = existing ? await admin.from("matches").update(payload).eq("id", existing.id) : await admin.from("matches").insert(payload);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    if (existing) updated += 1; else imported += 1;
  }
  return NextResponse.json({ imported, updated, total: rows.length });
}
