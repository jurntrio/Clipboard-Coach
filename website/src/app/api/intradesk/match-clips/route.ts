import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

type ClipRow = { id: string; video_id: string; team_id: string | null; name: string; created_at: string; rendered_segments: Array<{ duration?: number }> | null; videos: { match_date: string | null; home_team: string | null; away_team: string | null } | null; clip_segments: Array<{ tags: { start_time: number; end_time: number } | null }> };

export async function GET(request: Request) {
  const context = await getClubContext();
  const clubId = context.activeClubId;
  if (!context.user || !clubId) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const teamId = new URL(request.url).searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "Ploeg ontbreekt." }, { status: 400 });
  const access = await getClubAccess(clubId, context.user);
  if (!hasClubPermission(access, "games.view") || !hasClubPermission(access, "video.view") || !canAccessTeam(access, teamId)) {
    return NextResponse.json({ error: "Geen toegang tot deze wedstrijdclips." }, { status: 403 });
  }

  const admin = createAdminClient();
  const [{ data: team }, { data: matches }] = await Promise.all([
    admin.from("club_teams").select("id,name,season_id").eq("id", teamId).eq("club_id", clubId).maybeSingle(),
    admin.from("matches").select("id,match_date,season_id,club_team_id,team_a_name,team_b_name,score_a,score_b,match_videos(videos(id))").eq("club_id", clubId).eq("club_team_id", teamId).not("season_id", "is", null).order("match_date", { ascending: false })
  ]);
  if (!team) return NextResponse.json({ error: "Ploeg niet gevonden." }, { status: 404 });

  const videoContext = new Map<string, { matchId: string; date: string | null; opponent: string }>();
  const matchRows = (matches ?? []).map(match => {
    const teamIsA = normalizeKey(match.team_a_name) === normalizeKey(team.name);
    const opponent = teamIsA ? match.team_b_name : match.team_a_name || match.team_b_name;
    for (const link of match.match_videos ?? []) {
      const video = link.videos as unknown as { id: string } | null;
      if (video) videoContext.set(video.id, { matchId: match.id, date: match.match_date, opponent });
    }
    return { id: match.id, seasonId: match.season_id, teamId, title: `${team.name} – ${opponent || "Wedstrijd"}`, opponent, date: match.match_date, scoreA: teamIsA ? match.score_a : match.score_b, scoreB: teamIsA ? match.score_b : match.score_a };
  });
  const { data: operationalTeams } = await admin.from("teams").select("id").eq("club_team_id", teamId);
  const videoIds = [...videoContext.keys()];
  const operationalIds = (operationalTeams ?? []).map(item => item.id);
  const select = "id,video_id,team_id,name,created_at,rendered_segments,videos(match_date,home_team,away_team),clip_segments(tags(start_time,end_time))";
  const [videoClips, teamClips] = await Promise.all([
    videoIds.length ? admin.from("clips").select(select).in("video_id", videoIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    operationalIds.length ? admin.from("clips").select(select).in("team_id", operationalIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] })
  ]);
  const clips = [...new Map([...(videoClips.data ?? []), ...(teamClips.data ?? [])].map(clip => [clip.id, clip])).values()] as unknown as ClipRow[];
  const items = clips.map(clip => {
    const match = videoContext.get(clip.video_id);
    const renderedDuration = (clip.rendered_segments ?? []).reduce((sum, segment) => sum + Number(segment.duration ?? 0), 0);
    const tagDuration = (clip.clip_segments ?? []).reduce((sum, segment) => sum + Math.max(0, Number(segment.tags?.end_time ?? 0) - Number(segment.tags?.start_time ?? 0)), 0);
    return { id: clip.id, videoId: clip.video_id, matchId: match?.matchId ?? null, seasonId: team.season_id, kind: "clip" as const, title: clip.name, date: match?.date ?? clip.videos?.match_date ?? clip.created_at.slice(0, 10), duration: renderedDuration || tagDuration || null, teamId, teamName: team.name, opponent: match?.opponent || opponentFromVideo(clip.videos, team.name), storageProvider: "derived", categories: [] };
  });
  const clipMatchIds = new Set(items.flatMap(item => item.matchId ? [item.matchId] : []));
  return NextResponse.json({ matches: matchRows.filter(match => clipMatchIds.has(match.id)), items });
}

function normalizeKey(value: string) { return value.toLocaleLowerCase("nl-BE").replace(/[^a-z0-9]/g, ""); }
function opponentFromVideo(video: ClipRow["videos"], teamName: string) { if (!video) return ""; const own = normalizeKey(teamName); if (normalizeKey(video.home_team ?? "") === own) return video.away_team ?? ""; if (normalizeKey(video.away_team ?? "") === own) return video.home_team ?? ""; return video.away_team || video.home_team || ""; }
