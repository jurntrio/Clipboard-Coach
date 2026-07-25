import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("club_memberships")
    .select("club_id, role")
    .eq("profile_id", user.id);
  const allowed = isAdminEmail(user.email) || memberships?.some((item) => item.role === "club_admin");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let clubIds = (memberships ?? []).map((item) => item.club_id);
  if (isAdminEmail(user.email)) {
    const { data: allClubs } = await admin.from("clubs").select("id");
    clubIds = (allClubs ?? []).map((club) => club.id);
  }
  if (!clubIds.length) return NextResponse.json({ clubs: [] });

  const [{ data: clubs }, { data: teams }, { data: trainers }, { data: matches }, { data: clubMemberships }] = await Promise.all([
    admin.from("clubs").select("*").in("id", clubIds).order("name"),
    admin.from("club_teams").select("*, club_trainer_teams(trainer_id, role, status)").in("club_id", clubIds).neq("status", "merged").order("name"),
    admin.from("club_trainers").select("*, profiles(email), club_trainer_teams(club_team_id)").in("club_id", clubIds).order("display_name"),
    admin.from("matches").select("id, club_id, club_team_id, team_a_name, team_b_name, match_date, start_time, status, score_a, score_b, external_source").in("club_id", clubIds).order("match_date", { ascending: false }),
    admin.from("club_memberships").select("club_id, profile_id, role").in("club_id", clubIds)
  ]);
  const matchIds = (matches ?? []).map((match) => match.id);
  const { data: assignments } = matchIds.length
    ? await admin.from("club_match_assignments").select("*").in("match_id", matchIds)
    : { data: [] };

  return NextResponse.json({ clubs: clubs ?? [], teams: teams ?? [], trainers: trainers ?? [], matches: matches ?? [], assignments: assignments ?? [], memberships: clubMemberships ?? [] });
}
