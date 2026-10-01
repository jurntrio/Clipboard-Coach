import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getClubContext } from "@/lib/auth/active-club";
import { ACTIVE_TEAM_COOKIE, readActiveTeamSelection } from "@/lib/auth/active-team";
import { resolveDefaultTeamId } from "@/lib/auth/default-team";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { isClubModuleEnabled } from "@/lib/auth/club-module";
import { getServerI18n } from "@/i18n/server";

const RECENT_LIMIT = 3;
const SEARCH_LIMIT = 20;
type MatchListRow = {
  id: string;
  team_a_name: string | null;
  team_b_name: string | null;
  match_date: string | null;
  start_time: string | null;
  is_home_match: boolean;
  official_home_team_name: string | null;
  official_away_team_name: string | null;
  club_team_id: string | null;
  match_videos: { video_id: string }[] | null;
};

export async function GET(request: Request) {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.activeClubId) return NextResponse.json({ matches: [], videos: [], activeTeamId: null, teamOptions: [], hasMore: false });

  const admin = createAdminClient();
  const clubId = context.activeClubId;
  const [{ data: activeSeason }, access, moduleEnabled] = await Promise.all([
    admin.from("club_seasons").select("id").eq("club_id", clubId).eq("status", "ACTIVE").maybeSingle(),
    getClubAccess(clubId, context.user),
    context.isPlatformAdmin ? Promise.resolve(true) : isClubModuleEnabled(clubId, "video_viewer")
  ]);
  if (!hasClubPermission(access, "video.view")) return NextResponse.json({ error: "Geen toegang tot Video Viewer." }, { status: 403 });
  if (!moduleEnabled) {
    return NextResponse.json({ error: getServerI18n().t("clubModule.videoDisabled") }, { status: 403 });
  }

  const url = new URL(request.url);
  const searchMode = url.searchParams.has("q") || url.searchParams.has("before");
  const q = url.searchParams.get("q")?.trim() ?? "";
  const before = url.searchParams.get("before");

  const { data: clubTeams } = activeSeason
    ? await admin.from("club_teams").select("id, name, display_order")
        .eq("club_id", clubId).eq("season_id", activeSeason.id).neq("status", "merged").order("display_order").order("name")
    : { data: [] };
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
    let query = admin.from("matches").select("id, team_a_name, team_b_name, match_date, start_time, is_home_match, official_home_team_name, official_away_team_name, club_team_id, match_videos(video_id)")
      .eq("club_id", clubId)
      .not("match_date", "is", null)
      .lte("match_date", before || today)
      .order("match_date", { ascending: false })
      .order("start_time", { ascending: false });
    if (teamScope) query = query.in("club_team_id", teamScope);
    return query;
  }

  const limit = searchMode ? SEARCH_LIMIT : RECENT_LIMIT;
  let matchesResult: { data: MatchListRow[] | null; error: { message: string } | null };
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, (char) => `\\${char}`)}%`;
    const [teamAResult, teamBResult] = await Promise.all([
      baseQuery().ilike("team_a_name", pattern).limit(limit + 1),
      baseQuery().ilike("team_b_name", pattern).limit(limit + 1)
    ]);
    const merged = new Map((teamAResult.data ?? []).concat(teamBResult.data ?? []).map((match) => [match.id, match]));
    const combined = Array.from(merged.values())
      .sort((a, b) => `${b.match_date ?? ""}${b.start_time ?? ""}`.localeCompare(`${a.match_date ?? ""}${a.start_time ?? ""}`));
    matchesResult = { data: combined as MatchListRow[], error: teamAResult.error ?? teamBResult.error };
  } else {
    matchesResult = await baseQuery().limit(limit + 1) as unknown as typeof matchesResult;
  }
  if (matchesResult.error) return NextResponse.json({ error: matchesResult.error.message }, { status: 500 });
  const filtered = (matchesResult.data ?? []).filter((match) => canAccessTeam(access, match.club_team_id));
  const hasMore = filtered.length > limit;
  const matches = filtered.slice(0, limit);

  const videoIds = Array.from(new Set(matches.flatMap((match) =>
    (match.match_videos as { video_id: string }[] | null)?.map((link) => link.video_id) ?? []
  )));
  const { data: videos } = videoIds.length
    ? await admin.from("videos").select("id, video_url, video_key, file_size, duration").in("id", videoIds).eq("status", "active")
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
