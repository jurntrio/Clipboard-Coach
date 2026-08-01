import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function GET() {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.activeClubId) return NextResponse.json({ matches: [], teams: [], players: [], clips: [] });

  const admin = createAdminClient();
  const clubId = context.activeClubId;
  const membership = context.clubs.find((club) => club.id === clubId);
  if (!membership) return NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 });
  const access = await getClubAccess(clubId, context.user);
  if (!hasClubPermission(access, "games.view")) return NextResponse.json({ error: "Geen toegang tot Games." }, { status: 403 });

  const [{ data: clubTeams }, { data: clubSettings }, { data: matchOptions }] = await Promise.all([
    admin.from("club_teams").select("id").eq("club_id", clubId).neq("status", "merged"),
    admin.from("clubs").select("clip_view_count_roles").eq("id", clubId).maybeSingle(),
    admin.from("club_match_options").select("id, label").eq("club_id", clubId).eq("active", true)
  ]);
  const configuredViewRoles = clubSettings?.clip_view_count_roles ?? ["club_admin"];
  const effectiveRole = ["coach", "assistant_coach", "team_manager"].includes(membership.role) ? "trainer" : membership.role;
  const canSeeViewCounts = hasClubPermission(access, "games.view_counts")
    && (context.isPlatformAdmin || effectiveRole === "club_admin" || configuredViewRoles.includes(effectiveRole));
  const canViewSelection = hasClubPermission(access, "games.selection.view");
  const canPrepareMatches = hasClubPermission(access, "games.planning.manage") || hasClubPermission(access, "games.selection.manage")
    || hasClubPermission(access, "games.tag") || hasClubPermission(access, "games.tag_link.create");
  const clubTeamIds = (clubTeams ?? []).map((team) => team.id).filter((id) => canAccessTeam(access, id));
  const [{ data: matches }, { data: teams }] = await Promise.all([
    admin.from("matches").select("*, match_videos(video_id)")
      .eq("club_id", clubId)
      .order("match_date", { ascending: true, nullsFirst: false })
      .order("start_time", { ascending: true }),
    clubTeamIds.length
      ? admin.from("teams").select("*").in("club_team_id", clubTeamIds).not("name", "ilike", "EXTRA").order("name")
      : Promise.resolve({ data: [] })
  ]);

  const visibleMatches = (matches ?? []).filter((match) => canAccessTeam(access, match.club_team_id))
    .map(match => canViewSelection ? match : { ...match, player_ids: [] });
  const teamIds = (teams ?? []).map((team) => team.id);
  const videoIds = Array.from(new Set(visibleMatches.flatMap((match) =>
    (match.match_videos as { video_id: string }[] | null)?.map((link) => link.video_id) ?? []
  )));
  const [{ data: players }, { data: clips }] = await Promise.all([
    canViewSelection && teamIds.length
      ? admin.from("players").select("*").in("team_id", teamIds).neq("role", "staff").order("last_name")
      : Promise.resolve({ data: [] }),
    videoIds.length
      ? admin.from("clips").select(`id, coach_id, video_id, name, display_number, render_status, created_at, audience_type, audience_player_ids, rendered_segments, share_links(token${canSeeViewCounts ? ", view_count" : ""}), videos(title, video_url), clip_segments(id, sequence_order, video_id, render_status, videos(video_url), tags(id, name, color, start_time, end_time, player_ids))`)
          .in("video_id", videoIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] })
  ]);

  return NextResponse.json({
    matches: visibleMatches,
    teams: teams ?? [],
    players: authorizationPlayers(players ?? [], access.goalkeeperPlayerIds),
    clips: clips ?? [],
    role: membership.role,
    isPlatformAdmin: context.isPlatformAdmin,
    canSeeViewCounts,
    canManageMatches: hasClubPermission(access, "games.create"),
    canViewSelection,
    canPrepareMatches,
    canCreateTagLink: hasClubPermission(access, "games.tag_link.create"),
    matchOptions: matchOptions ?? []
  });
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
