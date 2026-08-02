import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, canManagePlayer, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function POST(request: Request, { params }: { params: { playerId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });

  const admin = createAdminClient();
  const { data: player } = await admin.from("players").select("id, first_name, team_id, membership_id").eq("id", params.playerId).maybeSingle();
  if (!player) return NextResponse.json({ error: "Speler niet gevonden." }, { status: 404 });
  const { data: team } = await admin.from("teams").select("id, coach_id, club_team_id").eq("id", player.team_id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Team niet gevonden." }, { status: 404 });

  const { data: profile } = await admin.from("profiles").select("account_role").eq("id", user.id).maybeSingle();
  let allowed = isAdminEmail(user.email) || profile?.account_role === "platform_admin" || team.coach_id === user.id;
  if (!allowed && team.club_team_id) {
    const { data: clubTeam } = await admin.from("club_teams").select("club_id, trainers_can_edit_roster").eq("id", team.club_team_id).maybeSingle();
    if (clubTeam) {
      const access = await getClubAccess(clubTeam.club_id, user);
      allowed = canAccessTeam(access, team.club_team_id) && hasClubPermission(access, "teams.manage")
        && canManagePlayer(access, player.id);
    }
  }
  if (!allowed) return NextResponse.json({ error: "Geen toegang tot deze speler." }, { status: 403 });

  // Club-brede speler (membership_id gezet): de uitnodiging koppelt aan club_player_id, zodat
  // 1 uitnodiging alle teams van dat kind dekt (Fase 3). Persoonlijk-teamspeler: geen club_players-
  // rij om naar te verwijzen, dus rechtstreeks player_id zoals voorheen.
  let clubPlayerId: string | null = null;
  if (player.membership_id) {
    const { data: membership } = await admin.from("player_team_memberships").select("club_player_id").eq("id", player.membership_id).maybeSingle();
    clubPlayerId = membership?.club_player_id ?? null;
  }

  // contactLabel/contactPhone zijn puur metadata over wie deze specifieke link krijgt (bv.
  // "Mama"/"Papa"), zodat een kind met meerdere ouders elk hun eigen, aparte link krijgt.
  const body = await request.json().catch(() => null) as { contactLabel?: string; contactPhone?: string } | null;
  const contactLabel = body?.contactLabel?.trim() || null;
  const contactPhone = body?.contactPhone?.trim() || null;

  const { data: invite, error } = await admin.from("player_invites")
    .insert({
      ...(clubPlayerId ? { club_player_id: clubPlayerId } : { player_id: player.id }),
      created_by: user.id, contact_label: contactLabel, contact_phone: contactPhone,
    })
    .select("token").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ token: invite.token });
}
