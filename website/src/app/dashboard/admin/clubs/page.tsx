import { SectionHeader } from "@/components/ui/SectionHeader";
import { requireAdminOrViewer } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClubAdminManager } from "./ClubAdminManager";

export default async function AdminClubsPage() {
  const { isFullAdmin } = await requireAdminOrViewer();
  const admin = createAdminClient();
  const [{ data: clubs }, { data: profiles }] = await Promise.all([
    admin.from("clubs").select("id, name, rbfa_registration_number, club_memberships(profile_id, role), club_trainers(id, profile_id, display_name, phone_number, invitation_status, profiles(email), club_trainer_teams(club_teams(name)))").order("name"),
    admin.from("profiles").select("id, email, full_name").order("full_name")
  ]);
  const rows = (clubs ?? []).map((club) => ({
    ...club,
    memberships: (club.club_memberships ?? []) as { profile_id: string; role: "trainer" | "club_admin" | "club_admin_viewer" | "analyst" }[],
    trainers: (club.club_trainers ?? []) as unknown as {
      id: string;
      profile_id: string | null;
      display_name: string;
      phone_number: string | null;
      invitation_status: string;
      profiles: { email: string } | { email: string }[] | null;
      club_trainer_teams: { club_teams: { name: string } | { name: string }[] | null }[];
    }[]
  }));
  return <div className="mx-auto max-w-6xl p-8"><SectionHeader title="Clubs" subtitle="Maak clubs aan en wijs Club Admins en Analysts toe." artworkSrc="/branding/admin.png" backHref="/dashboard/admin" /><ClubAdminManager clubs={rows} profiles={profiles ?? []} readOnly={!isFullAdmin} /></div>;
}
