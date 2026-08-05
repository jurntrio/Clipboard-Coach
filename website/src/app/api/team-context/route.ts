import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { ACTIVE_TEAM_COOKIE, ALL_TEAMS_VALUE, readActiveTeamSelection } from "@/lib/auth/active-team";
import { canAccessTeam, getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDefaultTeamId } from "@/lib/auth/default-team";
import { cookies } from "next/headers";

export async function GET() {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.activeClubId) return NextResponse.json({ teams: [], activeTeamId: null });
  const admin = createAdminClient();
  const access = await getClubAccess(context.activeClubId, context.user);
  const { data: activeSeason } = await admin.from("club_seasons").select("id").eq("club_id", context.activeClubId).eq("status", "ACTIVE").maybeSingle();
  const { data: rows } = activeSeason ? await admin.from("club_teams").select("id, name").eq("club_id", context.activeClubId).eq("season_id", activeSeason.id).neq("status", "merged").order("display_order").order("name") : { data: [] };
  const teams = (rows ?? []).filter(team => canAccessTeam(access, team.id));
  const selection = readActiveTeamSelection(cookies().get(ACTIVE_TEAM_COOKIE)?.value, new Set(teams.map(team => team.id)));
  const activeTeamId = selection.teamId ?? (selection.explicitAll ? null : await resolveDefaultTeamId(admin, context.activeClubId, context.user.id, teams.map(team => team.id)));
  const response = NextResponse.json({ teams, activeTeamId });
  if (!selection.teamId && !selection.explicitAll && activeTeamId) response.cookies.set(ACTIVE_TEAM_COOKIE, activeTeamId, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365
  });
  return response;
}

export async function POST(request: Request) {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clubId = context.activeClubId;
  if (!clubId) return NextResponse.json({ error: "Geen actieve club." }, { status: 400 });

  const body = await request.json().catch(() => null) as { clubTeamId?: string | null } | null;
  const response = NextResponse.json({ activeTeamId: body?.clubTeamId ?? null });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  };

  if (!body?.clubTeamId) {
    response.cookies.set(ACTIVE_TEAM_COOKIE, ALL_TEAMS_VALUE, cookieOptions);
    return response;
  }

  const admin = createAdminClient();
  const [access, { data: activeSeason }] = await Promise.all([
    getClubAccess(clubId, context.user),
    admin.from("club_seasons").select("id").eq("club_id", clubId).eq("status", "ACTIVE").maybeSingle()
  ]);
  const { data: team } = activeSeason
    ? await admin.from("club_teams").select("id").eq("id", body.clubTeamId).eq("club_id", clubId).eq("season_id", activeSeason.id).neq("status", "merged").maybeSingle()
    : { data: null };
  if (!team || !canAccessTeam(access, team.id)) {
    return NextResponse.json({ error: "Geen toegang tot deze ploeg." }, { status: 403 });
  }

  response.cookies.set(ACTIVE_TEAM_COOKIE, body.clubTeamId, cookieOptions);
  return response;
}
