import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";

export async function GET() {
  const context = await getClubContext();
  const user = context.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (context.activeClubId) {
    const admin = createAdminClient();
    const access = context.clubs.find((club) => club.id === context.activeClubId);
    if (!access) return NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 });
    const { data: clubTeams } = await admin.from("club_teams")
      .select("id, trainers_can_edit_roster").eq("club_id", context.activeClubId).eq("status", "active");
    let allowedIds = (clubTeams ?? []).map((team) => team.id);
    const clubWide = context.isPlatformAdmin || ["club_admin", "club_admin_viewer"].includes(access.role);
    if (!clubWide) {
      const { data: trainer } = await admin.from("club_trainers").select("id")
        .eq("club_id", context.activeClubId).eq("profile_id", user.id).maybeSingle();
      const { data: assignments } = trainer
        ? await admin.from("club_trainer_teams").select("club_team_id").eq("trainer_id", trainer.id).eq("status", "active")
        : { data: [] };
      const assigned = new Set((assignments ?? []).map((item) => item.club_team_id));
      allowedIds = allowedIds.filter((id) => assigned.has(id));
    }
    const { data: teams } = allowedIds.length
      ? await admin.from("teams").select("*, players(*), club_teams!inner(trainers_can_edit_roster)").in("club_team_id", allowedIds)
      : { data: [] };
    return NextResponse.json({ teams: (teams ?? []).map((team) => {
      const settings = team.club_teams as unknown as { trainers_can_edit_roster: boolean };
      return { ...team, can_edit_roster: context.isPlatformAdmin || access.role === "club_admin" || settings.trainers_can_edit_roster, club_managed: true };
    }) });
  }

  const admin = createAdminClient();
  const [{ data: owned }, { data: staff }, { data: clubTrainer }] = await Promise.all([
    admin.from("teams").select("*, players(*)").eq("coach_id", user.id),
    admin.from("team_staff_members").select("team_id").eq("user_id", user.id),
    admin.from("club_trainers").select("id").eq("profile_id", user.id)
  ]);

  const staffIds = (staff ?? []).map((item) => item.team_id);
  const { data: staffTeams } = staffIds.length
    ? await admin.from("teams").select("*, players(*)").in("id", staffIds)
    : { data: [] };
  const trainerIds = (clubTrainer ?? []).map((item) => item.id);
  const { data: assignments } = trainerIds.length
    ? await admin.from("club_trainer_teams").select("club_team_id").in("trainer_id", trainerIds).eq("status", "active")
    : { data: [] };
  const clubTeamIds = (assignments ?? []).map((item) => item.club_team_id);
  const { data: clubTeams } = clubTeamIds.length
    ? await admin.from("teams").select("*, players(*), club_teams!inner(trainers_can_edit_roster)").in("club_team_id", clubTeamIds)
    : { data: [] };

  const byId = new Map<string, Record<string, unknown>>();
  for (const team of [...(owned ?? []), ...(staffTeams ?? [])]) {
    byId.set(team.id, { ...team, can_edit_roster: team.coach_id === user.id, club_managed: false });
  }
  for (const team of clubTeams ?? []) {
    const settings = team.club_teams as unknown as { trainers_can_edit_roster: boolean };
    byId.set(team.id, { ...team, can_edit_roster: settings.trainers_can_edit_roster, club_managed: true });
  }

  return NextResponse.json({ teams: Array.from(byId.values()) });
}
