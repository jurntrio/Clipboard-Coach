import { createAdminClient } from "@/lib/supabase/admin";

type TeamRow = Record<string, unknown> & { players?: Array<Record<string, unknown> & { id: string; membership_id?: string | null }> };

export async function addPlayerContacts(admin: ReturnType<typeof createAdminClient>, rows: TeamRow[], maxContactsPerPlayer = 2): Promise<TeamRow[]> {
  const players = rows.flatMap((team) => team.players ?? []);
  const playerIds = players.map((player) => player.id);
  const membershipIds = players.flatMap((player) => player.membership_id ? [player.membership_id] : []);
  const { data: memberships } = membershipIds.length
    ? await admin.from("player_team_memberships").select("id, club_player_id").in("id", membershipIds)
    : { data: [] };
  const clubPlayerByMembership = new Map((memberships ?? []).map((membership) => [membership.id, membership.club_player_id]));
  const clubPlayerIds = [...new Set((memberships ?? []).map((membership) => membership.club_player_id).filter((id): id is string => !!id))];
  const [{ data: directContacts }, { data: clubContacts }] = await Promise.all([
    playerIds.length
      ? admin.from("player_guardians").select("id, player_id, profiles(full_name, email, phone_number)").in("player_id", playerIds).is("revoked_at", null).order("created_at")
      : Promise.resolve({ data: [] }),
    clubPlayerIds.length
      ? admin.from("player_guardians").select("id, club_player_id, profiles(full_name, email, phone_number)").in("club_player_id", clubPlayerIds).is("revoked_at", null).order("created_at")
      : Promise.resolve({ data: [] })
  ]);
  const contactsByPlayer = new Map<string, Array<{ id: string; full_name: string; email: string | null; phone_number: string | null }>>();
  for (const player of players) {
    const clubPlayerId = player.membership_id ? clubPlayerByMembership.get(player.membership_id) : null;
    const guardians = clubPlayerId
      ? (clubContacts ?? []).filter((contact) => contact.club_player_id === clubPlayerId)
      : (directContacts ?? []).filter((contact) => contact.player_id === player.id);
    contactsByPlayer.set(player.id, guardians.slice(0, maxContactsPerPlayer).map((contact) => {
      const profile = contact.profiles as unknown as { full_name: string | null; email: string | null; phone_number: string | null } | null;
      return { id: contact.id, full_name: profile?.full_name?.trim() || "Naam niet ingevuld", email: profile?.email ?? null, phone_number: profile?.phone_number ?? null };
    }));
  }
  return rows.map((team) => ({
    ...team,
    players: (team.players ?? []).map((player) => ({ ...player, contacts: contactsByPlayer.get(player.id) ?? [] }))
  }) as TeamRow);
}
