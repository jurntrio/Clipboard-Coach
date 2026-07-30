import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

type MatchInput = {
  id?: string; team_a_id?: string | null; team_a_name?: string; team_b_name?: string;
  match_date?: string | null; start_time?: string | null; status?: "scheduled" | "live" | "finished";
  score_a?: number | null; score_b?: number | null; player_ids?: string[]; live_tag_names?: string[];
  is_home_match?: boolean;
};

export async function POST(request: Request) {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.activeClubId) return NextResponse.json({ error: "Selecteer eerst een club." }, { status: 400 });
  const access = context.clubs.find((club) => club.id === context.activeClubId);
  if (!access) return NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 });
  const authorization = await getClubAccess(context.activeClubId, context.user);
  if (!hasClubPermission(authorization, "games.create")) return NextResponse.json({ error: "Geen recht om wedstrijden te beheren." }, { status: 403 });

  const body = await request.json().catch(() => null) as MatchInput | null;
  if (!body?.team_a_name?.trim() || !body.team_b_name?.trim()) {
    return NextResponse.json({ error: "Beide ploegnamen zijn verplicht." }, { status: 400 });
  }
  const admin = createAdminClient();
  let linkedClubTeamId: string | null = null;
  if (body.team_a_id) {
    const { data: team } = await admin.from("teams").select("id, club_team_id, club_teams(club_id, trainers_can_manage_matches)").eq("id", body.team_a_id).maybeSingle();
    const linkedClub = team?.club_teams as unknown as { club_id: string; trainers_can_manage_matches: boolean } | null;
    if (!team || linkedClub?.club_id !== context.activeClubId) {
      return NextResponse.json({ error: "Deze ploeg behoort niet tot de actieve club." }, { status: 400 });
    }
    linkedClubTeamId = team.club_team_id;
    if (!canAccessTeam(authorization, team.club_team_id)) return NextResponse.json({ error: "Geen toegang tot deze ploeg." }, { status: 403 });
    if (authorization.teamIds !== null && !linkedClub?.trainers_can_manage_matches) {
      return NextResponse.json({ error: "De clubadmin staat niet toe dat trainers wedstrijden voor deze ploeg beheren." }, { status: 403 });
    }
  }
  const clubWideManager = authorization.teamIds === null;
  let trainerId: string | null = null;
  if (!clubWideManager) {
    const { data: trainer } = await admin.from("club_trainers").select("id")
      .eq("club_id", context.activeClubId).eq("profile_id", context.user.id).maybeSingle();
    trainerId = trainer?.id ?? null;
    if (!trainerId) return NextResponse.json({ error: "Geen actieve trainerkoppeling voor deze club." }, { status: 403 });
    if (!body.id && !body.team_a_id) {
      return NextResponse.json({ error: "Kies een toegewezen ploeg voor deze clubwedstrijd." }, { status: 400 });
    }
    if (!body.id && body.team_a_id) {
      const { data: team } = await admin.from("teams").select("club_team_id").eq("id", body.team_a_id).maybeSingle();
      const { data: assignment } = team?.club_team_id
        ? await admin.from("club_trainer_teams").select("id").eq("trainer_id", trainerId)
            .eq("club_team_id", team.club_team_id).eq("status", "active").maybeSingle()
        : { data: null };
      if (!assignment) return NextResponse.json({ error: "Je bent niet aan deze ploeg toegewezen." }, { status: 403 });
    }
  }
  const payload = {
    team_a_id: body.team_a_id ?? null, team_a_name: body.team_a_name.trim(), team_b_id: null,
    team_b_name: body.team_b_name.trim(), match_date: body.match_date ?? null, start_time: body.start_time ?? null,
    status: body.status ?? "scheduled", score_a: body.score_a ?? null, score_b: body.score_b ?? null,
    player_ids: body.player_ids ?? [], live_tag_names: body.live_tag_names ?? [], club_id: context.activeClubId,
    club_team_id: linkedClubTeamId, is_home_match: body.is_home_match !== false
  };

  if (body.id) {
    const { data: existing } = await admin.from("matches").select("id, club_id").eq("id", body.id).maybeSingle();
    if (!existing || existing.club_id !== context.activeClubId) {
      return NextResponse.json({ error: "Wedstrijd behoort niet tot de actieve club." }, { status: 404 });
    }
    if (!clubWideManager && trainerId) {
      const { data: assignment } = await admin.from("club_match_assignments").select("id")
        .eq("match_id", body.id).eq("trainer_id", trainerId).eq("visible", true).maybeSingle();
      if (!assignment) return NextResponse.json({ error: "Je bent niet aan deze wedstrijd toegewezen." }, { status: 403 });
    }
    const { data, error } = await admin.from("matches").update(payload).eq("id", body.id).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (payload.status === "finished") await admin.from("match_tag_links").update({ active: false }).eq("match_id", body.id);
    return NextResponse.json({ match: data });
  }
  const { data: sponsorDefaults } = await admin.from("clubs")
    .select("clip_advertising_enabled, use_general_sponsor, general_sponsor_url")
    .eq("id", context.activeClubId).maybeSingle();
  const sponsorSource = sponsorDefaults?.clip_advertising_enabled
    && sponsorDefaults.use_general_sponsor
    && sponsorDefaults.general_sponsor_url ? "club" : "none";
  const { data, error } = await admin.from("matches").insert({ ...payload, sponsor_source: sponsorSource, coach_id: context.user.id }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ match: data }, { status: 201 });
}
