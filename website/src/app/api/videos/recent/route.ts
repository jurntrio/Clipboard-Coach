import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getClubContext } from "@/lib/auth/active-club";
import { ACTIVE_TEAM_COOKIE, readActiveTeamSelection } from "@/lib/auth/active-team";
import { resolveDefaultTeamId } from "@/lib/auth/default-team";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

const RECENT_LIMIT = 3;
const SEARCH_LIMIT = 20;

export async function GET(request: Request) {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.activeClubId) return NextResponse.json({ matches: [], videos: [], activeTeamId: null, teamOptions: [], hasMore: false });

  const admin = createAdminClient();
  const clubId = context.activeClubId;
  const access = await getClubAccess(clubId, context.user);
  if (!hasClubPermission(access, "video.view")) return NextResponse.json({ error: "Geen toegang tot Video Viewer." }, { status: 403 });

  const url = new URL(request.url);
  const searchMode = url.searchParams.has("q") || url.searchParams.has("before");
  const q = url.searchParams.get("q")?.trim() ?? "";
  const before = url.searchParams.get("before");

  const { data: clubTeams } = await admin.from("club_teams").select("id, name, display_order, club_seasons!inner(status)")
    .eq("club_id", clubId).eq("club_seasons.status", "ACTIVE").neq("status", "merged").order("display_order").order("name");
  const clubTeamIds = (clubTeams ?? []).map((team) => team.id).filter((id) => canAccessTeam(access, id));
  const selection = readActiveTeamSelection(cookies().get(ACTIVE_TEAM_COOKIE)?.value, new Set(clubTeamIds));
  let activeTeamId = selection.teamId;
  let resolvedFreshDefault = false;
  if (!activeTeamId && !selection.explicitAll) {
    activeTeamId = await resolveDefaultTeamId(admin, clubId, context.user.id, clubTeamIds);
    resolvedFreshDefault = !!activeTeamId;
  }
  const teamScope = activeTeamId ? [activeTeamId] : access.teamIds !== null ? clubTeamIds : null;

  const today = new Date().toISOString().slice(0, 10);
  function baseQuery() {
    let query = admin.from("matches").select("*, match_videos(video_id)")
      .eq("club_id", clubId)
      .not("match_date", "is", null)
      .lte("match_date", before || today)
      .order("match_date", { ascending: false })
      .order("start_time", { ascending: false });
    if (teamScope) query = query.in("club_team_id", teamScope);
    return query;
  }

  const limit = searchMode ? SEARCH_LIMIT : RECENT_LIMIT;
  let matchesResult: Awaited<ReturnType<typeof baseQuery>>;
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, (char) => `\\${char}`)}%`;
    const [teamAResult, teamBResult] = await Promise.all([
      baseQuery().ilike("team_a_name", pattern).limit(limit + 1),
      baseQuery().ilike("team_b_name", pattern).limit(limit + 1)
    ]);
    const merged = new Map((teamAResult.data ?? []).concat(teamBResult.data ?? []).map((match) => [match.id, match]));
    const combined = Array.from(merged.values())
      .sort((a, b) => `${b.match_date ?? ""}${b.start_time ?? ""}`.localeCompare(`${a.match_date ?? ""}${a.start_time ?? ""}`));
    matchesResult = { data: combined, error: teamAResult.error ?? teamBResult.error } as Awaited<ReturnType<typeof baseQuery>>;
  } else {
    matchesResult = await baseQuery().limit(limit + 1);
  }
  const filtered = (matchesResult.data ?? []).filter((match) => canAccessTeam(access, match.club_team_id));
  const hasMore = filtered.length > limit;
  const matches = filtered.slice(0, limit);

  const videoIds = Array.from(new Set(matches.flatMap((match) =>
    (match.match_videos as { video_id: string }[] | null)?.map((link) => link.video_id) ?? []
  )));
  const { data: videos } = videoIds.length
    ? await admin.from("videos").select("*").in("id", videoIds).eq("status", "active").order("created_at", { ascending: false })
    : { data: [] };

  const teamOptions = (clubTeams ?? [])
    .filter((team) => clubTeamIds.includes(team.id))
    .map((team) => ({ id: team.id, name: team.name }));
  const response = NextResponse.json({
    matches,
    videos: videos ?? [],
    activeTeamId,
    teamOptions,
    hasMore
  });
  if (resolvedFreshDefault && activeTeamId) {
    response.cookies.set(ACTIVE_TEAM_COOKIE, activeTeamId, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365
    });
  }
  return response;
}
