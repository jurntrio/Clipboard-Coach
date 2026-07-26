import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: { playerId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });

  const admin = createAdminClient();
  const { data: player } = await admin.from("players").select("id, first_name, team_id, membership_id").eq("id", params.playerId).maybeSingle();
  if (!player) return NextResponse.json({ error: "Speler niet gevonden." }, { status: 404 });
  const { data: team } = await admin.from("teams").select("id, coach_id, club_team_id").eq("id", player.team_id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Team niet gevonden." }, { status: 404 });

  let allowed = isAdminEmail(user.email) || team.coach_id === user.id;
  if (!allowed && team.club_team_id) {
    const { data: clubTeam } = await admin.from("club_teams").select("club_id, trainers_can_edit_roster").eq("id", team.club_team_id).maybeSingle();
    if (clubTeam) {
      const { data: membership } = await admin.from("club_memberships").select("role").eq("club_id", clubTeam.club_id).eq("profile_id", user.id).eq("status", "active").maybeSingle();
      if (membership?.role === "club_admin") allowed = true;
      if (!allowed && clubTeam.trainers_can_edit_roster) {
        const { data: trainer } = await admin.from("club_trainers").select("id").eq("club_id", clubTeam.club_id).eq("profile_id", user.id).maybeSingle();
        if (trainer) {
          const { data: assignment } = await admin.from("club_trainer_teams").select("id").eq("club_team_id", team.club_team_id).eq("trainer_id", trainer.id).eq("status", "active").maybeSingle();
          if (assignment) allowed = true;
        }
      }
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
  const { data: invite, error } = await admin.from("player_invites")
    .insert(clubPlayerId ? { club_player_id: clubPlayerId, created_by: user.id } : { player_id: player.id, created_by: user.id })
    .select("token").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ token: invite.token });
}
