import { notFound } from "next/navigation";
import { MediaArchive, type MediaCategory, type MediaItem, type MediaMatch } from "@/components/intradesk/MediaArchive";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

type ArchiveClip = { id: string; video_id: string; team_id: string | null; name: string; created_at: string; rendered_segments: Array<{ duration?: number }> | null; videos: { title: string | null; duration: number | null; match_date: string | null; home_team: string | null; away_team: string | null } | null; clip_segments: Array<{ tags: { start_time: number; end_time: number } | null }>; clip_media_categories: Array<{ media_categories: { id: string; name: string; is_active: boolean; is_default: boolean } | null }> };

export default async function MediaArchivePage() {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) notFound();
  const clubId = context.activeClubId;
  const access = await getClubAccess(clubId, context.user);
  if (!hasClubPermission(access, "video.view") || !hasClubPermission(access, "games.view")) notFound();

  const admin = createAdminClient();
  const [{ data: seasonData }, { data: teamData }, { data: categoryData }] = await Promise.all([
    admin.from("club_seasons").select("id,name,starts_on,status").eq("club_id", clubId).in("status", ["ACTIVE", "ARCHIVED"]).order("starts_on", { ascending: false }),
    admin.from("club_teams").select("id,name,season_id,display_order,status").eq("club_id", clubId).neq("status", "merged").order("display_order").order("name"),
    admin.from("media_categories").select("id,name,is_active,is_default").eq("club_id", clubId).order("name")
  ]);
  const seasons = (seasonData ?? []).map(season => ({ id: season.id, name: normalizeSeasonName(season.name) }));
  const visibleSeasonIds = new Set(seasons.map(season => season.id));
  const teams = (teamData ?? []).filter(team => !!team.season_id && visibleSeasonIds.has(team.season_id) && canAccessTeam(access, team.id)).map(team => ({ id: team.id, seasonId: team.season_id!, name: team.name }));
  const categories: MediaCategory[] = (categoryData ?? []).map(category => ({ id: category.id, name: category.name, active: category.is_active, isDefault: category.is_default }));
  const allowedTeamIds = teams.map(team => team.id);
  const [{ data: matchData }, { data: operationalTeamData }] = await Promise.all([
    allowedTeamIds.length ? admin.from("matches").select("id,match_date,season_id,club_team_id,team_a_name,team_b_name,score_a,score_b,match_videos(label,videos(id,title,duration,created_at))").eq("club_id", clubId).in("club_team_id", allowedTeamIds).not("season_id", "is", null).order("match_date", { ascending: false }) : Promise.resolve({ data: [] }),
    allowedTeamIds.length ? admin.from("teams").select("id,club_team_id").in("club_team_id", allowedTeamIds) : Promise.resolve({ data: [] })
  ]);

  const matches: MediaMatch[] = [];
  const teamMap = new Map(teams.map(team => [team.id, team]));
  const videoContext = new Map<string, { matchId: string; date: string | null; teamId: string; teamName: string; opponent: string }>();
  for (const match of matchData ?? []) {
    if (!match.season_id || !match.club_team_id) continue;
    const team = teamMap.get(match.club_team_id); if (!team) continue;
    const teamIsA = normalizeKey(match.team_a_name) === normalizeKey(team.name);
    const opponent = teamIsA ? match.team_b_name : match.team_a_name || match.team_b_name;
    matches.push({ id: match.id, seasonId: match.season_id, teamId: match.club_team_id, title: `${team.name} – ${opponent || "Wedstrijd"}`, opponent, date: match.match_date, scoreA: teamIsA ? match.score_a : match.score_b, scoreB: teamIsA ? match.score_b : match.score_a });
    for (const link of match.match_videos ?? []) {
      const video = link.videos as unknown as { id: string } | null;
      if (video) videoContext.set(video.id, { matchId: match.id, date: match.match_date, teamId: match.club_team_id, teamName: team.name, opponent });
    }
  }

  const operationalToClubTeam = new Map((operationalTeamData ?? []).flatMap(team => team.club_team_id ? [[team.id, team.club_team_id] as const] : []));
  const clipSelect = "id,video_id,team_id,name,created_at,rendered_segments,videos(title,duration,match_date,home_team,away_team),clip_segments(tags(start_time,end_time)),clip_media_categories(media_categories(id,name,is_active,is_default))";
  const legacyClipSelect = "id,video_id,team_id,name,created_at,rendered_segments,videos(title,duration,match_date,home_team,away_team),clip_segments(tags(start_time,end_time))";
  const loadClips = async (column: "video_id" | "team_id", ids: string[]) => {
    if (!ids.length) return [];
    const current = await admin.from("clips").select(clipSelect).in(column, ids).order("created_at", { ascending: false });
    if (!current.error) return current.data ?? [];
    const legacy = await admin.from("clips").select(legacyClipSelect).in(column, ids).order("created_at", { ascending: false });
    return (legacy.data ?? []).map(clip => ({ ...clip, clip_media_categories: [] }));
  };
  const [linkedClips, assignedClips] = await Promise.all([
    loadClips("video_id", [...videoContext.keys()]),
    loadClips("team_id", [...operationalToClubTeam.keys()])
  ]);
  const clips = [...new Map([...linkedClips, ...assignedClips].map(clip => [clip.id, clip])).values()] as unknown as ArchiveClip[];
  const items: MediaItem[] = clips.flatMap(clip => {
    const match = videoContext.get(clip.video_id);
    const clubTeamId = match?.teamId ?? (clip.team_id ? operationalToClubTeam.get(clip.team_id) : undefined);
    const team = clubTeamId ? teamMap.get(clubTeamId) : null;
    if (!clubTeamId || !team) return [];
    const renderedDuration = (clip.rendered_segments ?? []).reduce((sum, segment) => sum + Number(segment.duration ?? 0), 0);
    const tagDuration = (clip.clip_segments ?? []).reduce((sum, segment) => sum + Math.max(0, Number(segment.tags?.end_time ?? 0) - Number(segment.tags?.start_time ?? 0)), 0);
    return [{ id: clip.id, videoId: clip.video_id, matchId: match?.matchId ?? null, seasonId: team.seasonId, kind: "clip" as const, title: clip.name, date: match?.date ?? clip.videos?.match_date ?? clip.created_at.slice(0, 10), duration: renderedDuration || tagDuration || null, teamId: clubTeamId, teamName: team.name, opponent: match?.opponent || opponentFromVideo(clip.videos, team.name), storageProvider: "derived", categories: clip.clip_media_categories.flatMap(link => link.media_categories ? [{ id: link.media_categories.id, name: link.media_categories.name, active: link.media_categories.is_active, isDefault: link.media_categories.is_default }] : []) }];
  });
  const canManage = ["club_admin", "platform_admin"].includes(access.role) && !access.readOnly;

  return <div className="mx-auto max-w-[1500px] p-4 sm:p-8"><SectionHeader title="Media-archief" subtitle="Alle clubclips, apart van volledige wedstrijdbeelden." artworkSrc="/branding/media.svg" showHome={false} /><MediaArchive seasons={seasons} teams={teams} matches={matches} initialCategories={categories} items={items} canManage={canManage} /></div>;
}

function normalizeSeasonName(name: string) { const match = name.match(/(20\d{2})\D+(20\d{2})/); return match ? `${match[1]}–${match[2]}` : name.replace(/-/g, "–"); }
function normalizeKey(value: string) { return value.toLocaleLowerCase("nl-BE").replace(/[^a-z0-9]/g, ""); }
function opponentFromVideo(video: ArchiveClip["videos"], teamName: string) { if (!video) return ""; const own = normalizeKey(teamName); if (normalizeKey(video.home_team ?? "") === own) return video.away_team ?? ""; if (normalizeKey(video.away_team ?? "") === own) return video.home_team ?? ""; return video.away_team || video.home_team || ""; }
