import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, canManagePlayer, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { canMovePlayerToTeam } from "@/lib/auth/player-team-move";
import { createAdminClient } from "@/lib/supabase/admin";

async function playerContext(playerId: string) {
  const context = await getClubContext();
  if (!context.user) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: player } = await admin.from("players").select("*, teams(id, name, coach_id, club_team_id)").eq("id", playerId).maybeSingle();
  const team = player?.teams as unknown as { id: string; name: string; coach_id: string | null; club_team_id: string | null } | null;
  if (!player || !team) return { response: NextResponse.json({ error: "Speler niet gevonden." }, { status: 404 }) };
  if (!team.club_team_id) {
    const canEdit = context.isPlatformAdmin || team.coach_id === context.user.id;
    if (!canEdit) return { response: NextResponse.json({ error: "Geen toegang tot deze speler." }, { status: 403 }) };
    return {
      admin, player, canEdit, canManageGoalkeeper: context.isPlatformAdmin, goalkeeperRestricted: false,
      access: null, sourceClubId: null, sourceCoachId: team.coach_id, isPlatformAdmin: context.isPlatformAdmin,
      canOverrideRosterLock: context.isPlatformAdmin
    };
  }
  const { data: clubTeam } = await admin.from("club_teams").select("club_id, trainers_can_edit_roster").eq("id", team.club_team_id).maybeSingle();
  if (!clubTeam) return { response: NextResponse.json({ error: "Ploeg niet gevonden." }, { status: 404 }) };
  const access = await getClubAccess(clubTeam.club_id, context.user);
  const canView = context.isPlatformAdmin || (canAccessTeam(access, team.club_team_id) && hasClubPermission(access, "teams.view") && canManagePlayer(access, player.id));
  if (!canView) return { response: NextResponse.json({ error: "Geen toegang tot deze speler." }, { status: 403 }) };
  const privilegedRosterRole = ["youth_coordinator", "head_youth_development"].includes(access.functionRole ?? "");
  const canEdit = context.isPlatformAdmin || (canAccessTeam(access, team.club_team_id) && hasClubPermission(access, "teams.manage")
    && (["platform_admin", "club_admin"].includes(access.role) || privilegedRosterRole || clubTeam.trainers_can_edit_roster === true)
    && canManagePlayer(access, player.id));
  const canManageGoalkeeper = canEdit && (context.isPlatformAdmin || ["platform_admin", "club_admin"].includes(access.role)
    || privilegedRosterRole);
  return {
    admin, player, canEdit, canManageGoalkeeper, goalkeeperRestricted: access.goalkeeperPlayerIds !== null,
    access, sourceClubId: clubTeam.club_id, sourceCoachId: team.coach_id, isPlatformAdmin: context.isPlatformAdmin,
    canOverrideRosterLock: context.isPlatformAdmin || ["platform_admin", "club_admin"].includes(access.role) || privilegedRosterRole
  };
}

export async function GET(_request: Request, { params }: { params: { playerId: string } }) {
  const ctx = await playerContext(params.playerId);
  if ("response" in ctx) return ctx.response;
  return NextResponse.json({ player: ctx.player, canEdit: ctx.canEdit, canManageGoalkeeper: ctx.canManageGoalkeeper });
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
  const targetTeamId = typeof body.teamId === "string" ? body.teamId : ctx.player.team_id;
  if (targetTeamId !== ctx.player.team_id) {
    const { data: targetTeam } = await ctx.admin.from("teams")
      .select("id, coach_id, club_team_id, club_teams(club_id, trainers_can_edit_roster)")
      .eq("id", targetTeamId).maybeSingle();
    const targetClubTeam = targetTeam?.club_teams as unknown as { club_id: string; trainers_can_edit_roster: boolean } | null;
    const allowed = !!targetTeam && canMovePlayerToTeam({
      sourceClubId: ctx.sourceClubId,
      sourceCoachId: ctx.sourceCoachId,
      targetClubId: targetClubTeam?.club_id ?? null,
      targetClubTeamId: targetTeam.club_team_id,
      targetCoachId: targetTeam.coach_id,
      isPlatformAdmin: ctx.isPlatformAdmin,
      canAccessTargetTeam: !!ctx.access && canAccessTeam(ctx.access, targetTeam.club_team_id),
      canManageTeams: !!ctx.access && hasClubPermission(ctx.access, "teams.manage"),
      canOverrideRosterLock: ctx.canOverrideRosterLock,
      targetTrainersCanEditRoster: targetClubTeam?.trainers_can_edit_roster === true
    });
    if (!allowed) {
      return NextResponse.json({ error: "Geen recht om deze speler naar deze ploeg te verplaatsen." }, { status: 403 });
    }
  }
  const jerseyNumber = body.jerseyNumber === null || body.jerseyNumber === "" ? null : Number(body.jerseyNumber);
  if (jerseyNumber !== null && (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 999)) {
    return NextResponse.json({ error: "Ongeldig rugnummer." }, { status: 400 });
  }
  const update = {
    team_id: targetTeamId,
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

  // A player can belong to multiple teams through one club-wide identity. The
  // operational `players` rows are team-specific, so keep the goalkeeper flag
  // aligned across every membership of that identity.
  if (ctx.canManageGoalkeeper && typeof body.isGoalkeeper === "boolean" && ctx.player.membership_id) {
    const { data: membership } = await ctx.admin.from("player_team_memberships")
      .select("club_player_id").eq("id", ctx.player.membership_id).maybeSingle();
    if (membership?.club_player_id) {
      const { data: memberships } = await ctx.admin.from("player_team_memberships")
        .select("id").eq("club_player_id", membership.club_player_id);
      const membershipIds = (memberships ?? []).map((item) => item.id);
      if (membershipIds.length) {
        const { error: goalkeeperError } = await ctx.admin.from("players")
          .update({ is_goalkeeper: body.isGoalkeeper }).in("membership_id", membershipIds);
        if (goalkeeperError) return NextResponse.json({ error: goalkeeperError.message }, { status: 400 });
      }
    }
  }
  return NextResponse.json({ ok: true });
}
