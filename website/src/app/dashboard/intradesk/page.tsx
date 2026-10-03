import { pageTitle } from "@/lib/page-metadata";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { type PersonalTrainingRow } from "@/components/intradesk/PersonalTrainingLibrary";
import { IntradeskTabs } from "@/components/intradesk/IntradeskTabs";

type LibraryTraining = { id: string; title: string; age_category: string; themes: string[]; current_version: number; updated_at: string; updated_by: string; season_id: string | null; club_team_id: string | null };

export default async function IntradeskPage() {
  const admin = createAdminClient();
  const context = await getClubContext();
  const user = context.user;
  const clubId = context.activeClubId;
  const access = user && clubId ? await getClubAccess(clubId, user) : null;
  const canViewTraining = !!access && hasClubPermission(access, "training.view");

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
  const canEdit = !!access && hasClubPermission(access, "training.manage");
  const [{ data: profiles }, { data: personalData }, { data: schemeData }] = await Promise.all([
    profileIds.length ? admin.from("profiles").select("id,full_name,email").in("id", profileIds) : Promise.resolve({ data: [] }),
    user ? admin.from("trainer_trainings").select("id,title,age_category,themes,publication_state,updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }) : Promise.resolve({ data: [] }),
    clubId && canViewTraining ? admin.from("club_workload_schemes").select("id,name,description,status,current_version,club_workload_scheme_versions(version_number,club_workload_scheme_phases(phase_kind,display_order,duration_weeks,trainings_per_week,club_workload_scheme_sessions(id)))").eq("club_id", clubId).neq("status", "archived").order("updated_at", { ascending: false }) : Promise.resolve({ data: [] })
  ]);
  const names = new Map((profiles ?? []).map(profile => [profile.id, profile.full_name?.trim() || profile.email?.split("@")[0] || "Trainer"]));
  const teamIds = new Set(teams.map(team => team.id));
  const rows = trainings.filter(training => (!training.season_id || visibleSeasonIds.has(training.season_id)) && (!training.club_team_id || teamIds.has(training.club_team_id))).map(training => {
    const inferred = inferTrainingPlacement(training, teams, seasons);
    return { id: training.id, title: training.title, ageCategory: training.age_category, themes: training.themes, version: training.current_version,
      updatedAt: training.updated_at, author: names.get(training.updated_by) ?? "Trainer", seasonId: training.season_id ?? inferred?.seasonId ?? null, teamId: training.club_team_id ?? inferred?.id ?? null };
  });

  const personalTrainings = (personalData ?? []).map(training => ({ id: training.id, title: training.title, ageCategory: training.age_category, themes: training.themes ?? [], publicationState: training.publication_state, updatedAt: training.updated_at })) as PersonalTrainingRow[];

  const schemes = (schemeData ?? []).map(scheme => { const version = scheme.club_workload_scheme_versions.find(item => item.version_number === scheme.current_version); const phases = [...(version?.club_workload_scheme_phases ?? [])].sort((a, b) => a.display_order - b.display_order); return { id: scheme.id, name: scheme.name, description: scheme.description, status: scheme.status, version: scheme.current_version, weeks: phases.reduce((sum, phase) => sum + phase.duration_weeks, 0), sessions: phases.reduce((sum, phase) => sum + phase.club_workload_scheme_sessions.length, 0), phases: phases.map(phase => ({ name: phase.phase_kind, weeks: phase.duration_weeks, trainingsPerWeek: phase.trainings_per_week, sessions: phase.club_workload_scheme_sessions.length })) }; });

  return <div className="mx-auto max-w-[1500px] p-4 sm:p-8"><IntradeskTabs personalTrainings={personalTrainings} clubTrainings={rows} seasons={seasons} teams={teams} schemes={schemes} canEdit={canEdit} /></div>;
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

export const generateMetadata = pageTitle("page.intradesk");
