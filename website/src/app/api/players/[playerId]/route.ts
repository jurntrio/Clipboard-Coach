import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, canManagePlayer, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

async function playerContext(playerId: string) {
  const context = await getClubContext();
  if (!context.user) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: player } = await admin.from("players").select("*, teams(id, coach_id, club_team_id)").eq("id", playerId).maybeSingle();
  const team = player?.teams as unknown as { id: string; coach_id: string | null; club_team_id: string | null } | null;
  if (!player || !team) return { response: NextResponse.json({ error: "Speler niet gevonden." }, { status: 404 }) };
  if (!team.club_team_id) {
    const canEdit = team.coach_id === context.user.id;
    return { admin, player, canEdit, canManageGoalkeeper: false, goalkeeperRestricted: false };
  }
  const { data: clubTeam } = await admin.from("club_teams").select("club_id, trainers_can_edit_roster").eq("id", team.club_team_id).maybeSingle();
  if (!clubTeam) return { response: NextResponse.json({ error: "Ploeg niet gevonden." }, { status: 404 }) };
  const access = await getClubAccess(clubTeam.club_id, context.user);
  const privilegedRosterRole = ["youth_coordinator", "head_youth_development"].includes(access.functionRole ?? "");
  const canEdit = canAccessTeam(access, team.club_team_id) && hasClubPermission(access, "teams.manage")
    && (["platform_admin", "club_admin"].includes(access.role) || privilegedRosterRole || clubTeam.trainers_can_edit_roster === true)
    && canManagePlayer(access, player.id);
  const canManageGoalkeeper = canEdit && (["platform_admin", "club_admin"].includes(access.role)
    || privilegedRosterRole);
  return { admin, player, canEdit, canManageGoalkeeper, goalkeeperRestricted: access.goalkeeperPlayerIds !== null };
}

export async function GET(_request: Request, { params }: { params: { playerId: string } }) {
  const ctx = await playerContext(params.playerId);
  if ("response" in ctx) return ctx.response;
  return NextResponse.json({ canEdit: ctx.canEdit, canManageGoalkeeper: ctx.canManageGoalkeeper });
}

export async function PATCH(request: Request, { params }: { params: { playerId: string } }) {
  const ctx = await playerContext(params.playerId);
  if ("response" in ctx) return ctx.response;
  if (!ctx.canEdit) return NextResponse.json({ error: "Geen recht om deze speler te wijzigen." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.firstName !== "string" || typeof body.lastName !== "string" || !body.firstName.trim() || !body.lastName.trim()) {
    return NextResponse.json({ error: "Voornaam en achternaam zijn verplicht." }, { status: 400 });
  }
  if ("isGoalkeeper" in body && !ctx.canManageGoalkeeper) {
    return NextResponse.json({ error: "Alleen een Club Admin of jeugdcoördinator kan een speler als doelman markeren." }, { status: 403 });
  }
  if (ctx.goalkeeperRestricted && typeof body.teamId === "string" && body.teamId !== ctx.player.team_id) {
    return NextResponse.json({ error: "Een keeperstrainer kan een toegewezen doelman niet naar een andere ploeg verplaatsen." }, { status: 403 });
  }
  const jerseyNumber = body.jerseyNumber === null || body.jerseyNumber === "" ? null : Number(body.jerseyNumber);
  if (jerseyNumber !== null && (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 999)) {
    return NextResponse.json({ error: "Ongeldig rugnummer." }, { status: 400 });
  }
  const update = {
    team_id: typeof body.teamId === "string" ? body.teamId : ctx.player.team_id,
    first_name: body.firstName.trim(), last_name: body.lastName.trim(),
    role: body.role === "staff" ? "staff" : "player",
    jersey_number: jerseyNumber,
    position: typeof body.position === "string" ? body.position.trim() || null : null,
    date_of_birth: typeof body.dateOfBirth === "string" ? body.dateOfBirth || null : null,
    email: typeof body.email === "string" ? body.email.trim() || null : null,
    phone_numbers: Array.isArray(body.phoneNumbers) ? body.phoneNumbers.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean) : [],
    ...(ctx.canManageGoalkeeper && typeof body.isGoalkeeper === "boolean" ? { is_goalkeeper: body.isGoalkeeper } : {})
  };
  const { error } = await ctx.admin.from("players").update(update).eq("id", params.playerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if ((ctx.canManageGoalkeeper && body.isGoalkeeper === false) || update.team_id !== ctx.player.team_id) {
    const { error: assignmentError } = await ctx.admin.from("club_trainer_players").delete().eq("player_id", params.playerId);
    if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
