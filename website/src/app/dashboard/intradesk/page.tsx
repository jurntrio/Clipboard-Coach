import { SectionHeader } from "@/components/ui/SectionHeader";
import { IntradeskLibrary } from "@/components/intradesk/IntradeskLibrary";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getClubContext } from "@/lib/auth/active-club";

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
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const context = await getClubContext();
  const { data: memberships } = user && !context.isPlatformAdmin
    ? await admin.from("club_memberships").select("club_id, role").eq("profile_id", user.id).eq("status", "active")
    : { data: [] };
  const readableRoles = new Set(["trainer", "coach", "assistant_coach", "analyst", "club_admin", "club_admin_viewer"]);
  const clubIds = context.activeClubId && (context.isPlatformAdmin || (memberships ?? []).some(item => item.club_id === context.activeClubId && readableRoles.has(item.role)))
    ? [context.activeClubId]
    : [];
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

  return <div className="mx-auto max-w-[1500px] p-4 sm:p-8">
    <SectionHeader title="Intradesk" subtitle="De gedeelde trainingsbibliotheek van je club, geordend per leeftijd." artworkSrc="/branding/intradesk.png" showHome={false} />
    <IntradeskLibrary trainings={rows} />
  </div>;
}
