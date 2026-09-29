import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { type PersonalTrainingRow } from "@/components/intradesk/PersonalTrainingLibrary";
import { IntradeskTabs } from "@/components/intradesk/IntradeskTabs";
import type { MediaCategory, MediaItem, MediaMatch } from "@/components/intradesk/MediaArchive";

type LibraryTraining = { id: string; title: string; age_category: string; themes: string[]; current_version: number; updated_at: string; updated_by: string; season_id: string | null; club_team_id: string | null };
type ArchiveClip = { id: string; video_id: string; team_id: string | null; name: string; created_at: string; rendered_segments: Array<{ duration?: number }> | null; videos: { title: string | null; duration: number | null; match_date: string | null; home_team: string | null; away_team: string | null } | null; clip_segments: Array<{ tags: { start_time: number; end_time: number } | null }>; clip_media_categories: Array<{ media_categories: { id: string; name: string; is_active: boolean; is_default: boolean } | null }> };

export default async function IntradeskPage() {
  const admin = createAdminClient();
  const context = await getClubContext();
  const user = context.user;
  const clubId = context.activeClubId;
  const access = user && clubId ? await getClubAccess(clubId, user) : null;
  const canViewTraining = !!access && hasClubPermission(access, "training.view");
  const canViewMedia = !!access && hasClubPermission(access, "video.view") && hasClubPermission(access, "games.view");
  const canManageMedia = !!access && ["club_admin", "platform_admin"].includes(access.role) && !access.readOnly;

  const [trainingResult, seasonResult, teamResult] = clubId ? await Promise.all([
    canViewTraining ? admin.from("club_trainings").select("id,title,age_category,themes,current_version,updated_at,updated_by,season_id,club_team_id").eq("club_id", clubId).eq("status", "published").order("updated_at", { ascending: false }) : Promise.resolve({ data: [] }),
    admin.from("club_seasons").select("id,name,starts_on,status").eq("club_id", clubId).in("status", ["ACTIVE", "ARCHIVED"]).order("starts_on", { ascending: false }),
    admin.from("club_teams").select("id,name,season_id,display_order,status").eq("club_id", clubId).neq("status", "merged").order("display_order").order("name")
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const legacyTrainingResult = canViewTraining && clubId && "error" in trainingResult && trainingResult.error
    ? await admin.from("club_trainings").select("id,title,age_category,themes,current_version,updated_at,updated_by").eq("club_id", clubId).eq("status", "published").order("updated_at", { ascending: false })
    : null;
  const trainingData = legacyTrainingResult?.data?.map(training => ({ ...training, season_id: null, club_team_id: null })) ?? trainingResult.data;
  const seasonData = seasonResult.data;
  const teamData = teamResult.data;
  const seasons = (seasonData ?? []).map(season => ({ id: season.id, name: normalizeSeasonName(season.name) }));
  const visibleSeasonIds = new Set(seasons.map(season => season.id));
  const teams = (teamData ?? []).filter(team => !!team.season_id && visibleSeasonIds.has(team.season_id) && (!access || canAccessTeam(access, team.id))).map(team => ({ id: team.id, seasonId: team.season_id!, name: team.name }));
  const trainings = (trainingData ?? []) as LibraryTraining[];
  const profileIds = [...new Set(trainings.map(item => item.updated_by))];
  const { data: profiles } = profileIds.length ? await admin.from("profiles").select("id,full_name,email").in("id", profileIds) : { data: [] };
  const names = new Map((profiles ?? []).map(profile => [profile.id, profile.full_name?.trim() || profile.email?.split("@")[0] || "Trainer"]));
  const teamIds = new Set(teams.map(team => team.id));
  const rows = trainings.filter(training => (!training.season_id || visibleSeasonIds.has(training.season_id)) && (!training.club_team_id || teamIds.has(training.club_team_id))).map(training => {
    const inferred = inferTrainingPlacement(training, teams, seasons);
    return { id: training.id, title: training.title, ageCategory: training.age_category, themes: training.themes, version: training.current_version,
      updatedAt: training.updated_at, author: names.get(training.updated_by) ?? "Trainer", seasonId: training.season_id ?? inferred?.seasonId ?? null, teamId: training.club_team_id ?? inferred?.id ?? null };
  });

  const canEdit = !!access && hasClubPermission(access, "training.manage");
  const { data: personalData } = user ? await admin.from("trainer_trainings").select("id,title,age_category,themes,publication_state,updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }) : { data: [] };
  const personalTrainings = (personalData ?? []).map(training => ({ id: training.id, title: training.title, ageCategory: training.age_category, themes: training.themes ?? [], publicationState: training.publication_state, updatedAt: training.updated_at })) as PersonalTrainingRow[];

  const { data: schemeData } = clubId && canViewTraining ? await admin.from("club_workload_schemes").select("id,name,description,status,current_version,club_workload_scheme_versions(version_number,club_workload_scheme_phases(phase_kind,display_order,duration_weeks,trainings_per_week,club_workload_scheme_sessions(id)))").eq("club_id", clubId).neq("status", "archived").order("updated_at", { ascending: false }) : { data: [] };
  const schemes = (schemeData ?? []).map(scheme => { const version = scheme.club_workload_scheme_versions.find(item => item.version_number === scheme.current_version); const phases = [...(version?.club_workload_scheme_phases ?? [])].sort((a, b) => a.display_order - b.display_order); return { id: scheme.id, name: scheme.name, description: scheme.description, status: scheme.status, version: scheme.current_version, weeks: phases.reduce((sum, phase) => sum + phase.duration_weeks, 0), sessions: phases.reduce((sum, phase) => sum + phase.club_workload_scheme_sessions.length, 0), phases: phases.map(phase => ({ name: phase.phase_kind, weeks: phase.duration_weeks, trainingsPerWeek: phase.trainings_per_week, sessions: phase.club_workload_scheme_sessions.length })) }; });

  const mediaMatches: MediaMatch[] = [];
  let mediaItems: MediaItem[] = [];
  let mediaCategories: MediaCategory[] = [];
  if (clubId && canViewMedia) {
    const allowedTeamIds = teams.map(team => team.id);
    const [{ data: matchData }, { data: categoryData }, { data: operationalTeamData }] = await Promise.all([
      allowedTeamIds.length ? admin.from("matches").select("id,match_date,season_id,club_team_id,team_a_name,team_b_name,score_a,score_b,match_videos(label,videos(id,title,duration,created_at))").eq("club_id", clubId).in("club_team_id", allowedTeamIds).not("season_id", "is", null).order("match_date", { ascending: false }) : Promise.resolve({ data: [] }),
      admin.from("media_categories").select("id,name,is_active,is_default").eq("club_id", clubId).order("name"),
      allowedTeamIds.length ? admin.from("teams").select("id,club_team_id").in("club_team_id", allowedTeamIds) : Promise.resolve({ data: [] })
    ]);
    mediaCategories = (categoryData ?? []).map(category => ({ id: category.id, name: category.name, active: category.is_active, isDefault: category.is_default }));
    const teamMap = new Map(teams.map(team => [team.id, team]));
    const videoContext = new Map<string, { matchId: string; date: string | null; teamId: string; teamName: string; opponent: string; label: string }>();
    for (const match of matchData ?? []) {
      if (!match.season_id || !match.club_team_id) continue;
      const team = teamMap.get(match.club_team_id); if (!team) continue;
      const teamIsA = normalizeKey(match.team_a_name) === normalizeKey(team.name);
      const opponent = teamIsA ? match.team_b_name : match.team_a_name || match.team_b_name;
      const title = `${team.name} – ${opponent || "Wedstrijd"}`;
      mediaMatches.push({ id: match.id, seasonId: match.season_id, teamId: match.club_team_id, title, opponent, date: match.match_date, scoreA: teamIsA ? match.score_a : match.score_b, scoreB: teamIsA ? match.score_b : match.score_a });
      for (const link of match.match_videos ?? []) {
        const video = link.videos as unknown as { id: string; title: string | null; duration: number | null; created_at: string } | null;
        if (!video) continue;
        videoContext.set(video.id, { matchId: match.id, date: match.match_date, teamId: match.club_team_id, teamName: team.name, opponent, label: link.label });
      }
    }
    const videoIds = [...videoContext.keys()];
    // The media archive is a curated clip library. Full source matches remain
    // available in the match/video viewer and must not be duplicated here.
    mediaItems = [];
    const operationalToClubTeam = new Map((operationalTeamData ?? []).flatMap(team => team.club_team_id ? [[team.id, team.club_team_id] as const] : []));
    const operationalIds = [...operationalToClubTeam.keys()];
    const clipSelect = "id,video_id,team_id,name,created_at,rendered_segments,videos(title,duration,match_date,home_team,away_team),clip_segments(tags(start_time,end_time)),clip_media_categories(media_categories(id,name,is_active,is_default))";
    const legacyClipSelect = "id,video_id,team_id,name,created_at,rendered_segments,videos(title,duration,match_date,home_team,away_team),clip_segments(tags(start_time,end_time))";
    const loadClips = async (column: "video_id" | "team_id", ids: string[]) => {
      if (!ids.length) return [];
      const current = await admin.from("clips").select(clipSelect).in(column, ids).order("created_at", { ascending: false });
      if (!current.error) return current.data ?? [];
      const legacy = await admin.from("clips").select(legacyClipSelect).in(column, ids).order("created_at", { ascending: false });
      return (legacy.data ?? []).map(clip => ({ ...clip, clip_media_categories: [] }));
    };
    const [linkedClipData, assignedClipData] = await Promise.all([
      loadClips("video_id", videoIds),
      loadClips("team_id", operationalIds)
    ]);
    const clipData = [...new Map([...(linkedClipData ?? []), ...(assignedClipData ?? [])].map(clip => [clip.id, clip])).values()] as unknown as ArchiveClip[];
    mediaItems.push(...clipData.flatMap(clip => {
      const contextRow = videoContext.get(clip.video_id);
      // The match is authoritative for archive placement. A clip can still carry an
      // older operational team id after a season/team transition.
      const clubTeamId = contextRow?.teamId ?? (clip.team_id ? operationalToClubTeam.get(clip.team_id) : undefined);
      const team = clubTeamId ? teamMap.get(clubTeamId) : null;
      if (!clubTeamId || !team) return [];
      const opponent = contextRow?.opponent || opponentFromVideo(clip.videos, team.name);
      const renderedDuration = (clip.rendered_segments ?? []).reduce((sum, segment) => sum + Number(segment.duration ?? 0), 0);
      const tagDuration = (clip.clip_segments ?? []).reduce((sum, segment) => sum + Math.max(0, Number(segment.tags?.end_time ?? 0) - Number(segment.tags?.start_time ?? 0)), 0);
      const categories = clip.clip_media_categories.flatMap(link => link.media_categories ? [{ id: link.media_categories.id, name: link.media_categories.name, active: link.media_categories.is_active, isDefault: link.media_categories.is_default }] : []);
      return [{ id: clip.id, videoId: clip.video_id, matchId: contextRow?.matchId ?? null, seasonId: team.seasonId, kind: "clip" as const, title: clip.name, date: contextRow?.date ?? clip.videos?.match_date ?? clip.created_at.slice(0, 10), duration: renderedDuration || tagDuration || null, teamId: clubTeamId, teamName: team.name, opponent, storageProvider: "derived", categories }];
    }));
  }

  return <div className="mx-auto max-w-[1500px] p-4 sm:p-8"><IntradeskTabs personalTrainings={personalTrainings} clubTrainings={rows} seasons={seasons} teams={teams} schemes={schemes} mediaMatches={mediaMatches} mediaItems={mediaItems} mediaCategories={mediaCategories} canEdit={canEdit} canViewMedia={canViewMedia} canManageMedia={canManageMedia} /></div>;
}

function normalizeSeasonName(name: string) { const match = name.match(/(20\d{2})\D+(20\d{2})/); return match ? `${match[1]}–${match[2]}` : name.replace(/-/g, "–"); }

function inferTrainingPlacement(training: LibraryTraining, teams: Array<{ id: string; seasonId: string; name: string }>, seasons: Array<{ id: string; name: string }>) {
  if (training.club_team_id) return teams.find(team => team.id === training.club_team_id) ?? null;
  const ageKey = normalizeKey(training.age_category);
  const candidates = teams.filter(team => normalizeKey(team.name).includes(ageKey));
  if (!candidates.length) return null;
  const preferredSeasonId = training.season_id ?? seasons[0]?.id;
  return candidates.find(team => team.seasonId === preferredSeasonId && normalizeKey(team.name) === ageKey)
    ?? candidates.find(team => team.seasonId === preferredSeasonId)
    ?? candidates[0];
}

function normalizeKey(value: string) { return value.toLocaleLowerCase("nl-BE").replace(/[^a-z0-9]/g, ""); }
function opponentFromVideo(video: ArchiveClip["videos"], teamName: string) { if (!video) return ""; const own = normalizeKey(teamName); if (normalizeKey(video.home_team ?? "") === own) return video.away_team ?? ""; if (normalizeKey(video.away_team ?? "") === own) return video.home_team ?? ""; return video.away_team || video.home_team || ""; }
