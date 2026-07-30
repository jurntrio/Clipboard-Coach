import { SectionHeader } from "@/components/ui/SectionHeader";
import { TrainingBuilder } from "@/components/training/TrainingBuilder";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";

export default async function NewTrainingPage({ searchParams }: { searchParams?: { source?: string; edit?: string; sessionId?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const context = await getClubContext();

  let trainerName = "";
  let teamOptions: { id: string; name: string; assigned: boolean; clubLogoUrl: string | null }[] = [];
  let trainerOptions: string[] = [];
  let clubOptions: { id: string; name: string; country: string }[] = [];
  let initialTraining: Record<string, any> | undefined;
  let editingTrainingId: string | undefined;

  if (user) {
    const [{ data: profile }, { data: memberships }, { data: ownTrainerRows }] = await Promise.all([
      admin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
      admin.from("club_memberships").select("club_id").eq("profile_id", user.id).eq("status", "active"),
      admin.from("club_trainers").select("id, club_id, display_name").eq("profile_id", user.id)
    ]);

    trainerName = profile?.full_name?.trim() || profile?.email?.split("@")[0] || user.email?.split("@")[0] || "";
    const clubIds = context.activeClubId && (context.isPlatformAdmin || (memberships ?? []).some(item => item.club_id === context.activeClubId))
      ? [context.activeClubId]
      : [];
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
    let clubs: { id: string; name: string; country: string; logo_url?: string | null }[] = [];
    if (clubIds.length) {
      const withLogo = await admin.from("clubs").select("id, name, country, logo_url").in("id", clubIds);
      if (withLogo.error) {
        const fallback = await admin.from("clubs").select("id, name, country").in("id", clubIds);
        clubs = fallback.data ?? [];
      } else {
        clubs = withLogo.data ?? [];
      }
    }
    clubOptions = clubs.map(club => ({ id: club.id, name: club.name, country: club.country }));
    const assignedIds = new Set((assignments ?? []).map(item => item.club_team_id));
    const clubLogos = new Map(clubs.map(club => [
      club.id,
      club.logo_url ?? null
    ]));
    teamOptions = (clubTeams ?? [])
      .map(item => ({ id: item.id, name: item.name, assigned: assignedIds.has(item.id), clubLogoUrl: clubLogos.get(item.club_id) ?? null }))
      .sort((a, b) => Number(b.assigned) - Number(a.assigned) || a.name.localeCompare(b.name));
    trainerOptions = [...new Set([trainerName, ...(clubTrainers ?? []).map(item => item.display_name).filter(Boolean)])];
    const sourceTrainingId = searchParams?.edit ?? searchParams?.source;
    if (sourceTrainingId) {
      const { data: source } = await admin.from("club_trainings").select("id, club_id, age_category")
        .eq("id", sourceTrainingId).eq("status", "published").maybeSingle();
      if (source && clubIds.includes(source.club_id)) {
        const { data: version } = await admin.from("club_training_versions").select("content")
          .eq("training_id", source.id).order("version_number", { ascending: false }).limit(1).maybeSingle();
        if (version?.content && typeof version.content === "object") {
          initialTraining = { ...(version.content as Record<string, any>), clubId: source.club_id, ageCategory: source.age_category };
          editingTrainingId = searchParams?.edit ? source.id : undefined;
        }
      }
    }
    if (searchParams?.sessionId && clubIds.length) {
      const { data: session } = await admin.from("team_training_sessions")
        .select("id, club_id, club_team_id, training_date, club_teams(name, age_category)")
        .eq("id", searchParams.sessionId).in("club_id", clubIds).maybeSingle();
      if (session) {
        const scheduledTeam = session.club_teams as unknown as { name: string; age_category: string | null } | null;
        initialTraining = {
          ...(initialTraining ?? {}),
          clubId: session.club_id,
          team: scheduledTeam?.name ?? "",
          date: session.training_date,
          ageCategory: scheduledTeam?.age_category ?? ""
        };
      }
    }
  }

  return <div className="mx-auto max-w-[1680px] p-4 sm:p-8">
    <SectionHeader
      title={searchParams?.edit ? "Training bewerken" : searchParams?.source ? "Nieuwe training op basis van bestaande" : "Nieuwe training"}
      subtitle={searchParams?.source ? "Pas de kopie aan en bewaar ze als een nieuwe training in Intradesk." : "Maak een training met oefeningen en tekeningen."}
      artworkSrc="/branding/training.png" backHref={searchParams?.edit || searchParams?.source ? `/dashboard/intradesk/${searchParams.edit ?? searchParams.source}` : "/dashboard/training"} showHome={false}
    />
    <TrainingBuilder initialTrainer={trainerName} teamOptions={teamOptions} trainerOptions={trainerOptions}
      clubOptions={clubOptions} initialTraining={initialTraining} editingTrainingId={editingTrainingId} sessionId={searchParams?.sessionId} />
  </div>;
}
