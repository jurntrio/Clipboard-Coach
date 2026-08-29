import { SectionHeader } from "@/components/ui/SectionHeader";
import { IntradeskLibrary } from "@/components/intradesk/IntradeskLibrary";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { PersonalTrainingLibrary, type PersonalTrainingRow } from "@/components/intradesk/PersonalTrainingLibrary";

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

  return <div className="mx-auto max-w-[1500px] p-4 sm:p-8">
    <SectionHeader title="Intradesk" subtitle="Je persoonlijke trainingen en de gedeelde trainingsbibliotheek van je club." artworkSrc="/branding/intradesk.png" showHome={false} />
    <PersonalTrainingLibrary trainings={personalTrainings} />
    <div className="mb-3"><p className="text-xs font-black uppercase tracking-[.16em] text-accent">Gedeeld binnen de club</p><h2 className="mt-1 text-xl font-black text-textBright">Clubbibliotheek</h2></div>
    <IntradeskLibrary trainings={rows} canEdit={canEdit} />
  </div>;
}
