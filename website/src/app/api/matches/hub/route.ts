import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getClubContext } from "@/lib/auth/active-club";
import { ACTIVE_TEAM_COOKIE, readActiveTeamSelection } from "@/lib/auth/active-team";
import { resolveDefaultTeamId } from "@/lib/auth/default-team";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { resolveClubLogoById } from "@/lib/belgian-clubs/resolve-club-logo";
import { deleteObject } from "@/lib/r2/upload";

const FINISHED_PAGE_SIZE = 20;
const UPCOMING_PAGE_SIZE = 20;
const MATCH_HUB_COLUMNS = "id, coach_id, team_a_id, team_a_name, team_b_name, team_a_belgian_club_id, team_b_belgian_club_id, match_date, start_time, status, score_a, score_b, player_ids, live_tag_names, club_team_id, external_source, is_home_match, meeting_time_enabled, meeting_time, field_option_id, locker_room_option_id, visitor_locker_room_option_id, referee_option_id, official_referee_name, official_assistant_referee_1_name, official_assistant_referee_2_name, meeting_place_option_id, meeting_place_custom, match_videos(video_id)";
const TEAM_HUB_COLUMNS = "id, coach_id, club_team_id, name";
const PLAYER_HUB_COLUMNS = "id, team_id, first_name, last_name, initials, jersey_number, role";

export async function GET(request: Request) {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.activeClubId) return NextResponse.json({ matches: [], teams: [], activeTeamId: null, teamOptions: [], players: [], clips: [] });

  const admin = createAdminClient();
  const clubId = context.activeClubId;
  const requestedOffset = Number(new URL(request.url).searchParams.get("finishedOffset") ?? 0);
  const finishedOffset = Number.isSafeInteger(requestedOffset) && requestedOffset > 0 ? Math.min(requestedOffset, 500) : 0;
  const requestedUpcomingOffset = Number(new URL(request.url).searchParams.get("upcomingOffset") ?? 0);
  const upcomingOffset = Number.isSafeInteger(requestedUpcomingOffset) && requestedUpcomingOffset > 0 ? Math.min(requestedUpcomingOffset, 500) : 0;
  const membership = context.clubs.find((club) => club.id === clubId);
  if (!membership) return NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 });
  const access = await getClubAccess(clubId, context.user);
  if (!hasClubPermission(access, "games.view")) return NextResponse.json({ error: "Geen toegang tot Games." }, { status: 403 });

  const [{ data: activeSeason }, { data: clubSettings }, { data: matchOptions }] = await Promise.all([
    admin.from("club_seasons").select("id").eq("club_id", clubId).eq("status", "ACTIVE").maybeSingle(),
    admin.from("clubs").select("clip_view_count_roles").eq("id", clubId).maybeSingle(),
    admin.from("club_match_options").select("id, label").eq("club_id", clubId).eq("active", true)
  ]);
  const { data: clubTeams } = activeSeason
    ? await admin.from("club_teams").select("id, name, display_order").eq("club_id", clubId).eq("season_id", activeSeason.id).neq("status", "merged").order("display_order").order("name")
    : { data: [] };
  const configuredViewRoles = clubSettings?.clip_view_count_roles ?? ["club_admin"];
  const effectiveRole = ["coach", "assistant_coach", "team_manager"].includes(membership.role) ? "trainer" : membership.role;
  const canSeeViewCounts = hasClubPermission(access, "games.view_counts")
    && (context.isPlatformAdmin || effectiveRole === "club_admin" || configuredViewRoles.includes(effectiveRole));
  const canViewSelection = hasClubPermission(access, "games.selection.view");
  const canViewClips = hasClubPermission(access, "video.view");
  const canPrepareMatches = hasClubPermission(access, "games.planning.manage") || hasClubPermission(access, "games.selection.manage")
    || hasClubPermission(access, "games.tag") || hasClubPermission(access, "games.tag_link.create");
  const clubTeamIds = (clubTeams ?? []).map((team) => team.id).filter((id) => canAccessTeam(access, id));
  const selection = readActiveTeamSelection(cookies().get(ACTIVE_TEAM_COOKIE)?.value, new Set(clubTeamIds));
  let activeTeamId = selection.teamId;
  let resolvedFreshDefault = false;
  if (!activeTeamId && !selection.explicitAll) {
    activeTeamId = await resolveDefaultTeamId(admin, clubId, context.user.id, clubTeamIds);
    resolvedFreshDefault = !!activeTeamId;
  }
  // null = no team restriction (full club access, or explicit "alle ploegen"); mirrors canAccessTeam's own semantics.
  const teamScope = activeTeamId ? [activeTeamId] : access.teamIds !== null ? clubTeamIds : null;
  const today = new Date().toISOString().slice(0, 10);
  let upcomingMatchesQuery = admin.from("matches").select(MATCH_HUB_COLUMNS)
    .eq("club_id", clubId)
    .or("external_source.is.null,external_source.not.in.(foot24,voetbal_vlaanderen)")
    .neq("status", "finished")
    .or(`match_date.is.null,match_date.gte.${today}`)
    .order("match_date", { ascending: true, nullsFirst: false })
    .order("start_time", { ascending: true })
    .range(upcomingOffset, upcomingOffset + UPCOMING_PAGE_SIZE);
  let finishedMatchesQuery = admin.from("matches").select(MATCH_HUB_COLUMNS)
    .eq("club_id", clubId)
    .or("external_source.is.null,external_source.not.in.(foot24,voetbal_vlaanderen)")
    .or(`status.eq.finished,match_date.lt.${today}`)
    .order("match_date", { ascending: false, nullsFirst: false })
    .order("start_time", { ascending: false })
    .range(finishedOffset, finishedOffset + FINISHED_PAGE_SIZE);
  if (teamScope) {
    upcomingMatchesQuery = upcomingMatchesQuery.in("club_team_id", teamScope);
    finishedMatchesQuery = finishedMatchesQuery.in("club_team_id", teamScope);
  }
  const scopedTeamIds = activeTeamId ? [activeTeamId] : clubTeamIds;
  const [{ data: upcomingMatches }, { data: finishedPageWithSentinel }, { data: teams }] = await Promise.all([
    teamScope === null || teamScope.length ? upcomingMatchesQuery : Promise.resolve({ data: [] }),
    teamScope === null || teamScope.length ? finishedMatchesQuery : Promise.resolve({ data: [] }),
    scopedTeamIds.length
      ? admin.from("teams").select(TEAM_HUB_COLUMNS).in("club_team_id", scopedTeamIds).not("name", "ilike", "EXTRA")
      : Promise.resolve({ data: [] })
  ]);

  const hasMoreFinished = (finishedPageWithSentinel?.length ?? 0) > FINISHED_PAGE_SIZE;
  const finishedMatches = (finishedPageWithSentinel ?? []).slice(0, FINISHED_PAGE_SIZE);
  const hasMoreUpcoming = (upcomingMatches?.length ?? 0) > UPCOMING_PAGE_SIZE;
  const matches = [...(upcomingMatches ?? []).slice(0, UPCOMING_PAGE_SIZE), ...finishedMatches];
  const officialDownloadMatches = (matches ?? []).filter(match => !["foot24", "voetbal_vlaanderen"].includes(match.external_source ?? ""));
  const visibleMatches = officialDownloadMatches.filter((match) => canAccessTeam(access, match.club_team_id))
    .map(match => canViewSelection ? match : { ...match, player_ids: [] });
  const teamIds = (teams ?? []).map((team) => team.id);
  const videoIds = Array.from(new Set(visibleMatches.flatMap((match) =>
    (match.match_videos as { video_id: string }[] | null)?.map((link) => link.video_id) ?? []
  )));
  const [{ data: players }, { data: clips }] = await Promise.all([
    canViewSelection && teamIds.length
      ? admin.from("players").select(PLAYER_HUB_COLUMNS).in("team_id", teamIds).neq("role", "staff").order("last_name")
      : Promise.resolve({ data: [] }),
    canViewClips && videoIds.length
      ? admin.from("clips").select(`id, coach_id, video_id, name, display_number, render_status, created_at, audience_type, audience_player_ids, rendered_segments, share_links(token, short_code${canSeeViewCounts ? ", view_count" : ""}), videos(title, video_url), clip_segments(id, sequence_order, video_id, render_status, videos(video_url), tags(id, name, color, start_time, end_time, player_ids))`)
          .in("video_id", videoIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] })
  ]);

  const failedClips = (clips ?? []).filter((clip) => clip.render_status === "failed");
  await Promise.all(failedClips.map(async (clip) => {
    const keys = ((clip.rendered_segments ?? []) as Array<{ key?: string }>).map(segment => segment.key).filter((key): key is string => !!key);
    const removals = await Promise.allSettled(keys.map(key => deleteObject(key)));
    for (const removal of removals) if (removal.status === "rejected") console.error("Could not remove failed clip object:", removal.reason);
    const { error } = await admin.from("clips").delete().eq("id", clip.id);
    if (error) console.error("Could not remove failed clip record:", error);
  }));
  const visibleClips = (clips ?? []).filter((clip) => clip.render_status !== "failed");

  const matchesWithLogos = await Promise.all(visibleMatches.map(async (match) => ({
    ...match,
    team_a_logo: await resolveClubLogoById(match.team_a_belgian_club_id, "ui"),
    team_b_logo: await resolveClubLogoById(match.team_b_belgian_club_id, "ui")
  })));

  const teamOrder = new Map((clubTeams ?? []).map((team, index) => [team.id, index]));
  const orderedTeams = (teams ?? []).sort((a, b) => (teamOrder.get(a.club_team_id) ?? 9999) - (teamOrder.get(b.club_team_id) ?? 9999));
  const teamOptions = (clubTeams ?? [])
    .filter((team) => clubTeamIds.includes(team.id))
    .map((team) => ({ id: team.id, name: team.name }));
  const response = NextResponse.json({
    matches: matchesWithLogos,
    hasMoreFinished,
    hasMoreUpcoming,
    finishedOffset,
    upcomingOffset,
    finishedPageSize: FINISHED_PAGE_SIZE,
    upcomingPageSize: UPCOMING_PAGE_SIZE,
    teams: orderedTeams,
    activeTeamId,
    teamOptions,
    players: authorizationPlayers(players ?? [], access.goalkeeperPlayerIds),
    clips: visibleClips,
    role: membership.role,
    isPlatformAdmin: context.isPlatformAdmin,
    canSeeViewCounts,
    canManageMatches: hasClubPermission(access, "games.create"),
    canViewSelection,
    canPrepareMatches,
    canCreateTagLink: hasClubPermission(access, "games.tag_link.create"),
    matchOptions: matchOptions ?? []
  });
  if (resolvedFreshDefault && activeTeamId) {
    response.cookies.set(ACTIVE_TEAM_COOKIE, activeTeamId, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365
    });
  }
  return response;
}

function authorizationPlayers<T extends { id: string }>(players: T[], allowedIds: Set<string> | null) {
  return allowedIds === null ? players : players.filter((player) => allowedIds.has(player.id));
}

async function visibleTrainerMatches(admin: ReturnType<typeof createAdminClient>, userId: string, clubId: string, matches: any[]) {
  const { data: trainer } = await admin.from("club_trainers").select("id").eq("club_id", clubId).eq("profile_id", userId).maybeSingle();
  if (!trainer) return [];
  const { data: assignments } = await admin.from("club_match_assignments")
    .select("match_id").eq("trainer_id", trainer.id).eq("visible", true);
  const visibleIds = new Set((assignments ?? []).map((item) => item.match_id));
  return matches.filter((match) => visibleIds.has(match.id));
}
