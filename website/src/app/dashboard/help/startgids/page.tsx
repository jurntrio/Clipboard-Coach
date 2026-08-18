import { TrainerOnboarding } from "@/components/onboarding/TrainerOnboarding";
import { getClubContext } from "@/lib/auth/active-club";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function TrainerStartGuidePage() {
  const context = await getClubContext();
  const admin = createAdminClient();
  const clubId = context.activeClubId;
  const [{ data: club }, { data: team }] = await Promise.all([
    clubId ? admin.from("clubs").select("name, is_personal, created_by").eq("id", clubId).maybeSingle() : Promise.resolve({ data: null }),
    clubId ? admin.from("club_teams").select("id, name").eq("club_id", clubId).eq("status", "active").order("created_at").limit(1).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const canImport = !!context.user && club?.is_personal === true && club.created_by === context.user.id;
  return <TrainerOnboarding teamId={team?.id ?? ""} teamName={team?.name ?? club?.name ?? "je ploeg"} replay canImport={canImport && !!team?.id} />;
}
