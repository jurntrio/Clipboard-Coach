import { SectionHeader } from "@/components/ui/SectionHeader";
import { TrainingBuilder } from "@/components/training/TrainingBuilder";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function NewTrainingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  let trainerName = "";
  let teamOptions: { id: string; name: string; assigned: boolean; clubLogoUrl: string | null }[] = [];
  let trainerOptions: string[] = [];

  if (user) {
    const [{ data: profile }, { data: memberships }, { data: ownTrainerRows }] = await Promise.all([
      admin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
      admin.from("club_memberships").select("club_id").eq("profile_id", user.id).eq("status", "active"),
      admin.from("club_trainers").select("id, club_id, display_name").eq("profile_id", user.id)
    ]);

    trainerName = profile?.full_name?.trim() || profile?.email?.split("@")[0] || user.email?.split("@")[0] || "";
    const clubIds = [...new Set((memberships ?? []).map(item => item.club_id))];
    const trainerIds = (ownTrainerRows ?? []).map(item => item.id);
    const [{ data: clubTeams }, { data: assignments }, { data: clubTrainers }] = await Promise.all([
      clubIds.length
        ? admin.from("club_teams").select("id, name, club_id").in("club_id", clubIds).eq("status", "active").order("name")
        : Promise.resolve({ data: [] }),
      trainerIds.length
        ? admin.from("club_trainer_teams").select("club_team_id").in("trainer_id", trainerIds).eq("status", "active")
        : Promise.resolve({ data: [] }),
      clubIds.length
        ? admin.from("club_trainers").select("display_name").in("club_id", clubIds).order("display_name")
        : Promise.resolve({ data: [] })
    ]);
    let clubs: { id: string; name: string; logo_url?: string | null }[] = [];
    if (clubIds.length) {
      const withLogo = await admin.from("clubs").select("id, name, logo_url").in("id", clubIds);
      if (withLogo.error) {
        const fallback = await admin.from("clubs").select("id, name").in("id", clubIds);
        clubs = fallback.data ?? [];
      } else {
        clubs = withLogo.data ?? [];
      }
    }
    const assignedIds = new Set((assignments ?? []).map(item => item.club_team_id));
    const clubLogos = new Map(clubs.map(club => [
      club.id,
      club.logo_url || (club.name.trim().toLocaleLowerCase().includes("torhout") ? "/branding/clubs/km-torhout.png" : null)
    ]));
    teamOptions = (clubTeams ?? [])
      .map(item => ({ id: item.id, name: item.name, assigned: assignedIds.has(item.id), clubLogoUrl: clubLogos.get(item.club_id) ?? null }))
      .sort((a, b) => Number(b.assigned) - Number(a.assigned) || a.name.localeCompare(b.name));
    trainerOptions = [...new Set([trainerName, ...(clubTrainers ?? []).map(item => item.display_name).filter(Boolean)])];
  }

  return <div className="mx-auto max-w-[1680px] p-4 sm:p-8">
    <SectionHeader title="Nieuwe training" subtitle="Maak een training met oefeningen en tekeningen." artworkSrc="/branding/training.png" backHref="/dashboard/training" />
    <TrainingBuilder initialTrainer={trainerName} teamOptions={teamOptions} trainerOptions={trainerOptions} />
  </div>;
}
