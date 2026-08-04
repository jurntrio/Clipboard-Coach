import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { ACTIVE_TEAM_COOKIE } from "@/lib/auth/active-team";
import { canAccessTeam, getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clubId = context.activeClubId;
  if (!clubId) return NextResponse.json({ error: "Geen actieve club." }, { status: 400 });

  const body = await request.json().catch(() => null) as { clubTeamId?: string | null } | null;
  const response = NextResponse.json({ activeTeamId: body?.clubTeamId ?? null });

  if (!body?.clubTeamId) {
    response.cookies.delete(ACTIVE_TEAM_COOKIE);
    return response;
  }

  const admin = createAdminClient();
  const [access, { data: team }] = await Promise.all([
    getClubAccess(clubId, context.user),
    admin.from("club_teams").select("id").eq("id", body.clubTeamId).eq("club_id", clubId).maybeSingle()
  ]);
  if (!team || !canAccessTeam(access, team.id)) {
    return NextResponse.json({ error: "Geen toegang tot deze ploeg." }, { status: 403 });
  }

  response.cookies.set(ACTIVE_TEAM_COOKIE, body.clubTeamId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}
