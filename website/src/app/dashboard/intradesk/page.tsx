import { SectionHeader } from "@/components/ui/SectionHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { type PersonalTrainingRow } from "@/components/intradesk/PersonalTrainingLibrary";
import { IntradeskTabs } from "@/components/intradesk/IntradeskTabs";

type LibraryTraining = {
  id: string;
  title: string;
  age_category: string;
  themes: string[];
  current_version: number;
  updated_at: string;
  updated_by: string;
};

export default async function IntradeskPage() {
  const admin = createAdminClient();
  const context = await getClubContext();
  const user = context.user;
  const access = user && context.activeClubId ? await getClubAccess(context.activeClubId, user) : null;
  const clubIds = context.activeClubId && access && hasClubPermission(access, "training.view") ? [context.activeClubId] : [];
  const { data } = clubIds.length
    ? await admin.from("club_trainings")
      .select("id, title, age_category, themes, current_version, updated_at, updated_by")
      .in("club_id", clubIds).eq("status", "published").order("updated_at", { ascending: false })
    : { data: [] };
  const trainings = (data ?? []) as LibraryTraining[];
  const profileIds = [...new Set(trainings.map(item => item.updated_by))];
  const { data: profiles } = profileIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", profileIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map(profile => [
    profile.id, profile.full_name?.trim() || profile.email?.split("@")[0] || "Trainer"
  ]));

  const rows = trainings.map(training => ({
    id: training.id,
    title: training.title,
    ageCategory: training.age_category,
    themes: training.themes,
    version: training.current_version,
    updatedAt: training.updated_at,
    author: names.get(training.updated_by) ?? "Trainer"
  }));
  const canEdit = access ? hasClubPermission(access, "training.manage") : false;
  const { data: personalData } = user
    ? await admin.from("trainer_trainings").select("id, title, age_category, themes, publication_state, updated_at")
      .eq("owner_id", user.id).order("updated_at", { ascending: false })
    : { data: [] };
  const personalTrainings = (personalData ?? []).map(training => ({
    id: training.id,
    title: training.title,
    ageCategory: training.age_category,
    themes: training.themes ?? [],
    publicationState: training.publication_state,
    updatedAt: training.updated_at
  })) as PersonalTrainingRow[];
  const { data: schemeData } = context.activeClubId && access && hasClubPermission(access, "training.view")
    ? await admin.from("club_workload_schemes").select("id,name,description,status,current_version,club_workload_scheme_versions(version_number,club_workload_scheme_phases(phase_kind,display_order,duration_weeks,trainings_per_week,club_workload_scheme_sessions(id)))").eq("club_id", context.activeClubId).neq("status", "archived").order("updated_at", { ascending: false })
    : { data: [] };
  const schemes = (schemeData ?? []).map(scheme => { const version = scheme.club_workload_scheme_versions.find(item => item.version_number === scheme.current_version); const phases = [...(version?.club_workload_scheme_phases ?? [])].sort((a, b) => a.display_order - b.display_order); return { id: scheme.id, name: scheme.name, description: scheme.description, status: scheme.status, version: scheme.current_version, weeks: phases.reduce((sum, phase) => sum + phase.duration_weeks, 0), sessions: phases.reduce((sum, phase) => sum + phase.club_workload_scheme_sessions.length, 0), phases: phases.map(phase => ({ name: phase.phase_kind, weeks: phase.duration_weeks, trainingsPerWeek: phase.trainings_per_week, sessions: phase.club_workload_scheme_sessions.length })) }; });

  return <div className="mx-auto max-w-[1500px] p-4 sm:p-8">
    <SectionHeader title="Intradesk" subtitle="Je persoonlijke trainingen en de gedeelde trainingsbibliotheek van je club." artworkSrc="/branding/intradesk.png" showHome={false} />
    <IntradeskTabs personalTrainings={personalTrainings} clubTrainings={rows} schemes={schemes} canEdit={canEdit}/>
  </div>;
}
