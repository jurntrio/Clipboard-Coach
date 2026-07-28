import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.activeClubId) return NextResponse.json({ matches: [], teams: [], players: [], clips: [] });

  const admin = createAdminClient();
  const clubId = context.activeClubId;
  const membership = context.clubs.find((club) => club.id === clubId);
  if (!membership) return NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 });

  const { data: clubTeams } = await admin.from("club_teams")
    .select("id").eq("club_id", clubId).neq("status", "merged");
  const clubTeamIds = (clubTeams ?? []).map((team) => team.id);
  const [{ data: matches }, { data: teams }] = await Promise.all([
    admin.from("matches").select("*, match_videos(video_id)")
      .eq("club_id", clubId)
      .order("match_date", { ascending: false, nullsFirst: false })
      .order("start_time", { ascending: false }),
    clubTeamIds.length
      ? admin.from("teams").select("*").in("club_team_id", clubTeamIds).not("name", "ilike", "EXTRA").order("name")
      : Promise.resolve({ data: [] })
  ]);

  const visibleMatches = context.isPlatformAdmin || ["club_admin", "club_admin_viewer", "analyst"].includes(membership.role)
    ? (matches ?? [])
    : await visibleTrainerMatches(admin, context.user.id, clubId, matches ?? []);
  const teamIds = (teams ?? []).map((team) => team.id);
  const videoIds = Array.from(new Set(visibleMatches.flatMap((match) =>
    (match.match_videos as { video_id: string }[] | null)?.map((link) => link.video_id) ?? []
  )));
  const [{ data: players }, { data: clips }] = await Promise.all([
    teamIds.length
      ? admin.from("players").select("*").in("team_id", teamIds).neq("role", "staff").order("last_name")
      : Promise.resolve({ data: [] }),
    videoIds.length
      ? admin.from("clips").select("id, coach_id, video_id, name, render_status, created_at, audience_type, audience_player_ids, rendered_segments, share_links(token), videos(title, video_url), clip_segments(id, sequence_order, video_id, render_status, videos(video_url), tags(id, name, color, start_time, end_time, player_ids))")
          .in("video_id", videoIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] })
  ]);

  return NextResponse.json({
    matches: visibleMatches,
    teams: teams ?? [],
    players: players ?? [],
    clips: clips ?? [],
    role: membership.role,
    isPlatformAdmin: context.isPlatformAdmin
  });
}

async function visibleTrainerMatches(admin: ReturnType<typeof createAdminClient>, userId: string, clubId: string, matches: any[]) {
  const { data: trainer } = await admin.from("club_trainers").select("id").eq("club_id", clubId).eq("profile_id", userId).maybeSingle();
  if (!trainer) return [];
  const { data: assignments } = await admin.from("club_match_assignments")
    .select("match_id").eq("trainer_id", trainer.id).eq("visible", true);
  const visibleIds = new Set((assignments ?? []).map((item) => item.match_id));
  return matches.filter((match) => visibleIds.has(match.id));
}

