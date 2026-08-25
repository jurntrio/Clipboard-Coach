import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, club_id, club_team_id, is_home_match").eq("id", params.id).maybeSingle();
  if (!match?.club_id) return NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 });

  const access = await getClubAccess(match.club_id, user);
  const canEditScore = hasClubPermission(access, "games.report.manage") || hasClubPermission(access, "games.create");
  if (!canEditScore || !canAccessTeam(access, match.club_team_id)) {
    return NextResponse.json({ error: "Je mag de score van deze wedstrijd niet aanpassen." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { scoreHome?: unknown; scoreAway?: unknown } | null;
  const parseScore = (value: unknown) => value === "" || value === null || value === undefined ? null : Number(value);
  const homeScore = parseScore(body?.scoreHome);
  const awayScore = parseScore(body?.scoreAway);
  if ((homeScore !== null && (!Number.isInteger(homeScore) || homeScore < 0 || homeScore > 30))
    || (awayScore !== null && (!Number.isInteger(awayScore) || awayScore < 0 || awayScore > 30))) {
    return NextResponse.json({ error: "Vul een geldige score tussen 0 en 30 in." }, { status: 400 });
  }

  const { error } = await admin.from("matches").update(match.is_home_match
    ? { score_a: homeScore, score_b: awayScore }
    : { score_a: awayScore, score_b: homeScore }
  ).eq("id", match.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
