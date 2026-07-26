import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
