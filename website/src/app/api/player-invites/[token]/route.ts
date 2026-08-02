import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken } from "@/lib/invite-tokens";

export async function GET(request: Request, { params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: invite } = await admin.from("player_invites").select("id, player_id, club_player_id, expires_at, used_at").eq("token_hash", hashInviteToken(params.token)).maybeSingle();
  if (!invite) return NextResponse.json({ error: "Deze link is niet geldig." }, { status: 404 });
  if (invite.used_at) return NextResponse.json({ error: "Deze link is al gebruikt." }, { status: 410 });
  if (new Date(invite.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Deze link is verlopen." }, { status: 410 });

  if (invite.club_player_id) {
    const { data: clubPlayer } = await admin.from("club_players")
      .select("first_name, last_name, address, postal_code, city")
      .eq("id", invite.club_player_id).maybeSingle();
    if (!clubPlayer) return NextResponse.json({ error: "Deze link is niet geldig." }, { status: 404 });
    const { data: memberships } = await admin.from("player_team_memberships")
      .select("teams(name)").eq("club_player_id", invite.club_player_id).eq("status", "active");
    const teamName = (memberships ?? [])
      .map((membership) => (membership.teams as unknown as { name: string } | null)?.name)
      .filter(Boolean).join(", ");
    // Enkel al ingevulde velden meegeven (nooit lege strings), zodat de join-pagina kan tonen
    // "gegevens kloppen nog" i.p.v. een leeg adres als al-bevestigd voor te stellen.
    const existingAddress = clubPlayer.address && clubPlayer.postal_code && clubPlayer.city
      ? { address: clubPlayer.address, postalCode: clubPlayer.postal_code, city: clubPlayer.city }
      : null;
    return NextResponse.json({ playerName: `${clubPlayer.first_name} ${clubPlayer.last_name}`.trim(), teamName, supportsAddress: true, existingAddress });
  }

  const { data: player } = await admin.from("players").select("first_name, last_name, team_id").eq("id", invite.player_id).maybeSingle();
  if (!player) return NextResponse.json({ error: "Deze link is niet geldig." }, { status: 404 });
  const { data: team } = await admin.from("teams").select("name").eq("id", player.team_id).maybeSingle();

  // Adres bestaat enkel op club_players (zie club-player-identity-and-seasons-plan.md) --
  // een persoonlijk-teamspeler heeft geen kolom om het naartoe op te slaan, dus geen
  // adresvelden tonen die anders stilzwijgend genegeerd worden door handle_new_user().
  return NextResponse.json({ playerName: `${player.first_name} ${player.last_name}`.trim(), teamName: team?.name ?? "", supportsAddress: false, existingAddress: null });
}
