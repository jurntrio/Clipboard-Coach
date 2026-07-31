import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TrainingOverview } from "@/components/training/TrainingOverview";
import { getClubContext } from "@/lib/auth/active-club";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubAccess } from "@/lib/auth/club-access";

export default async function TrainingPage() {
  const context = await getClubContext();
  const admin = createAdminClient();
  const clubId = context.activeClubId;
  const access = clubId && context.user ? await getClubAccess(clubId, context.user) : null;
  const [{ data: sessions }, { data: options }, { data: intradeskEntitlement }, { data: ownTrainer }, { data: clubTeams }] = await Promise.all([
    clubId
      ? admin.from("team_training_sessions").select("id, club_team_id, training_date, start_time, field_option_id, locker_room_option_id, staff_ids, club_teams(name)")
          .eq("club_id", clubId).order("training_date").order("start_time")
      : Promise.resolve({ data: [] }),
    clubId
      ? admin.from("club_match_options").select("id, label").eq("club_id", clubId).eq("active", true)
      : Promise.resolve({ data: [] }),
    clubId
      ? admin.from("club_module_entitlements").select("club_id").eq("club_id", clubId).eq("module_key", "intradesk").eq("enabled", true).maybeSingle()
      : Promise.resolve({ data: null }),
    clubId && context.user
      ? admin.from("club_trainers").select("id").eq("club_id", clubId).eq("profile_id", context.user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    clubId
      ? admin.from("club_teams").select("id, name").eq("club_id", clubId).eq("status", "active").order("name")
      : Promise.resolve({ data: [] })
  ]);
  const visible = (sessions ?? []).filter(session => access?.teamIds === null || access?.teamIds.has(session.club_team_id) || session.staff_ids.includes(ownTrainer?.id ?? ""));
  const visibleTeamIds = new Set(visible.map(session => session.club_team_id));
  const filterTeams = (clubTeams ?? []).filter(team => access?.teamIds === null || access?.teamIds.has(team.id) || visibleTeamIds.has(team.id));
  const optionNames = Object.fromEntries((options ?? []).map(option => [option.id, option.label]));

  return <div className="mx-auto max-w-6xl p-4 sm:p-8">
    <SectionHeader title="Trainingen" artworkSrc="/branding/training.png" showHome={false} />
    <div className="mb-5 flex flex-wrap gap-3">
      <Link href="/dashboard/training/new" className="rounded-lg bg-accent px-5 py-3 text-sm font-black text-page hover:brightness-110">Maak een training</Link>
      {intradeskEntitlement && <Link href="/dashboard/intradesk" className="rounded-lg border border-borderButton px-5 py-3 text-sm font-bold text-textPrimary hover:border-accent">Open Intradesk</Link>}
    </div>
    <TrainingOverview sessions={visible as any} teams={filterTeams} optionNames={optionNames} />
  </div>;
}
