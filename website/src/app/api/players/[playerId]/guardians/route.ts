import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, canManagePlayer, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

type Admin = ReturnType<typeof createAdminClient>;
type Scope = { clubPlayerId: string | null; playerId: string; canManageInvites: boolean };

// Zelfde autorisatiecheck + club_player_id-resolutie als players/[playerId]/invite/route.ts:
// een clubbrede speler (membership_id gezet) groepeert guardians/invites via club_player_id
// (1 kind, mogelijk meerdere teams), een persoonlijk-teamspeler blijft op player_id.
async function authorizeAndResolveScope(admin: Admin, userId: string, userEmail: string | undefined, playerId: string, permission: "teams.view" | "teams.manage"): Promise<{ error: NextResponse } | { error?: undefined; scope: Scope }> {
  const { data: player } = await admin.from("players").select("id, team_id, membership_id").eq("id", playerId).maybeSingle();
  if (!player) return { error: NextResponse.json({ error: "Speler niet gevonden." }, { status: 404 }) };
  const { data: team } = await admin.from("teams").select("id, coach_id, club_team_id").eq("id", player.team_id).maybeSingle();
  if (!team) return { error: NextResponse.json({ error: "Team niet gevonden." }, { status: 404 }) };

  let allowed = isAdminEmail(userEmail) || team.coach_id === userId;
  let canManageInvites = isAdminEmail(userEmail) || (!team.club_team_id && team.coach_id === userId);
  if (!allowed && team.club_team_id) {
    const { data: clubTeam } = await admin.from("club_teams").select("club_id, trainers_can_edit_roster").eq("id", team.club_team_id).maybeSingle();
    if (clubTeam) {
      const access = await getClubAccess(clubTeam.club_id, { id: userId, email: userEmail });
      allowed = canAccessTeam(access, team.club_team_id) && hasClubPermission(access, permission)
        && canManagePlayer(access, player.id);
      canManageInvites = access.role === "platform_admin" || access.functionRole === "club_admin";
    }
  }
  if (!allowed) return { error: NextResponse.json({ error: "Geen toegang tot deze speler." }, { status: 403 }) };

  let clubPlayerId: string | null = null;
  if (player.membership_id) {
    const { data: membership } = await admin.from("player_team_memberships").select("club_player_id").eq("id", player.membership_id).maybeSingle();
    clubPlayerId = membership?.club_player_id ?? null;
  }
  return { scope: { clubPlayerId, playerId: player.id, canManageInvites } };
}

export async function GET(request: Request, { params }: { params: { playerId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const admin = createAdminClient();
  const authorized = await authorizeAndResolveScope(admin, user.id, user.email, params.playerId, "teams.view");
  if (authorized.error) return authorized.error;
  const { scope } = authorized;

  const guardianQuery = admin.from("player_guardians")
    .select("id, profile_id, access_scope, valid_from, valid_until, revoked_at, created_at, profiles(email, full_name)")
    .order("created_at", { ascending: true });
  const inviteQuery = admin.from("player_invites")
    .select("id, contact_label, contact_phone, contact_email, created_at, expires_at, sent_at, delivery_error, used_at, used_by")
    .is("used_at", null)
    .order("created_at", { ascending: false });

  const { data: guardians } = scope.clubPlayerId
    ? await guardianQuery.eq("club_player_id", scope.clubPlayerId)
    : await guardianQuery.eq("player_id", scope.playerId);
  const { data: invites } = scope.canManageInvites
    ? scope.clubPlayerId
      ? await inviteQuery.eq("club_player_id", scope.clubPlayerId)
      : await inviteQuery.eq("player_id", scope.playerId)
    : { data: [] };

  return NextResponse.json({ guardians: guardians ?? [], invites: invites ?? [], canManageInvites: scope.canManageInvites });
}

export async function PATCH(request: Request, { params }: { params: { playerId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const admin = createAdminClient();
  const authorized = await authorizeAndResolveScope(admin, user.id, user.email, params.playerId, "teams.manage");
  if (authorized.error) return authorized.error;
  const { scope } = authorized;
  if (!scope.canManageInvites) return NextResponse.json({ error: "Alleen clubbeheerders kunnen uitnodigingen en koppelingen beheren." }, { status: 403 });

  const body = await request.json().catch(() => null) as { guardianId?: string; cancelInviteId?: string } | null;

  if (body?.guardianId) {
    const guardianRowQuery = admin.from("player_guardians").select("id").eq("id", body.guardianId);
    const { data: guardianRow } = await (scope.clubPlayerId
      ? guardianRowQuery.eq("club_player_id", scope.clubPlayerId)
      : guardianRowQuery.eq("player_id", scope.playerId)).maybeSingle();
    if (!guardianRow) return NextResponse.json({ error: "Koppeling niet gevonden." }, { status: 404 });
    const { error } = await admin.from("player_guardians").update({ revoked_at: new Date().toISOString() }).eq("id", body.guardianId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.cancelInviteId) {
    const inviteRowQuery = admin.from("player_invites").select("id").eq("id", body.cancelInviteId);
    const { data: inviteRow } = await (scope.clubPlayerId
      ? inviteRowQuery.eq("club_player_id", scope.clubPlayerId)
      : inviteRowQuery.eq("player_id", scope.playerId)).maybeSingle();
    if (!inviteRow) return NextResponse.json({ error: "Uitnodiging niet gevonden." }, { status: 404 });
    const { error } = await admin.from("player_invites").delete().eq("id", body.cancelInviteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ongeldige actie." }, { status: 400 });
}
