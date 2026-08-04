import { cookies } from "next/headers";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_CLUB_COOKIE = "clipboard_coach_active_club";

export type AvailableClub = {
  id: string;
  name: string;
  logoUrl: string | null;
  role: string;
};

export type PendingClub = {
  id: string;
  name: string;
};

const loadAvailableClubs = unstable_cache(async (userId: string, platformAdmin: boolean): Promise<AvailableClub[]> => {
  const admin = createAdminClient();
  if (platformAdmin) {
    const { data } = await admin.from("clubs").select("id, name, logo_url").eq("status", "active").order("name");
    return (data ?? []).map((club) => ({ id: club.id, name: club.name, logoUrl: club.logo_url, role: "platform_admin" }));
  }
  const { data: memberships } = await admin.from("club_memberships")
    .select("club_id, role, clubs(id, name, status, logo_url)")
    .eq("profile_id", userId)
    .eq("status", "active");
  const membershipClubs = (memberships ?? []).flatMap((membership) => {
    const club = membership.clubs as unknown as { id: string; name: string; status: string; logo_url: string | null } | null;
    return club?.status === "active"
      ? [{ id: club.id, name: club.name, logoUrl: club.logo_url, role: membership.role }]
      : [];
  });

  const { data: guardianLinks } = await admin.from("player_guardians")
    .select("club_player_id, player_id")
    .eq("profile_id", userId)
    .is("revoked_at", null);
  const clubPlayerIds = (guardianLinks ?? []).map(link => link.club_player_id).filter((id): id is string => !!id);
  const playerIds = (guardianLinks ?? []).map(link => link.player_id).filter((id): id is string => !!id);
  const [{ data: clubPlayers }, { data: players }] = await Promise.all([
    clubPlayerIds.length ? admin.from("club_players").select("club_id").in("id", clubPlayerIds) : Promise.resolve({ data: [] }),
    playerIds.length ? admin.from("players").select("team_id, teams(club_team_id)").in("id", playerIds) : Promise.resolve({ data: [] })
  ]);
  const clubTeamIds = (players ?? []).map(player =>
    (player.teams as unknown as { club_team_id: string | null } | null)?.club_team_id
  ).filter((id): id is string => !!id);
  const { data: clubTeams } = clubTeamIds.length
    ? await admin.from("club_teams").select("club_id").in("id", clubTeamIds)
    : { data: [] };
  const guardianClubIds = Array.from(new Set([
    ...(clubPlayers ?? []).map(player => player.club_id),
    ...(clubTeams ?? []).map(team => team.club_id)
  ]));
  const { data: guardianClubs } = guardianClubIds.length
    ? await admin.from("clubs").select("id, name, logo_url, status").in("id", guardianClubIds).eq("status", "active")
    : { data: [] };
  const combined = new Map(membershipClubs.map(club => [club.id, club]));
  for (const club of guardianClubs ?? []) {
    if (!combined.has(club.id)) combined.set(club.id, {
      id: club.id, name: club.name, logoUrl: club.logo_url, role: "guardian"
    });
  }
  return Array.from(combined.values()).sort((a, b) => a.name.localeCompare(b.name));
}, ["available-clubs"], { revalidate: 30 });

const loadPendingClubs = unstable_cache(async (userId: string): Promise<PendingClub[]> => {
  const admin = createAdminClient();
  const { data } = await admin.from("club_memberships")
    .select("club_id, clubs(id, name)")
    .eq("profile_id", userId)
    .eq("status", "pending");
  return (data ?? []).flatMap((row) => {
    const club = row.clubs as unknown as { id: string; name: string } | null;
    return club ? [{ id: club.id, name: club.name }] : [];
  });
}, ["pending-clubs"], { revalidate: 30 });

async function loadClubContext() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, clubs: [] as AvailableClub[], activeClubId: null, isPlatformAdmin: false, pendingClubs: [] as PendingClub[] };

  const { data: profile } = await createAdminClient().from("profiles").select("account_role").eq("id", user.id).maybeSingle();
  const platformAdmin = isAdminEmail(user.email) || profile?.account_role === "platform_admin";
  const clubs = await loadAvailableClubs(user.id, platformAdmin);

  const requestedId = cookies().get(ACTIVE_CLUB_COOKIE)?.value;
  const activeClubId = clubs.some((club) => club.id === requestedId) ? requestedId! : clubs[0]?.id ?? null;
  const pendingClubs = clubs.length || platformAdmin ? [] : await loadPendingClubs(user.id);
  return { user, clubs, activeClubId, isPlatformAdmin: platformAdmin, pendingClubs };
}

// Dashboardlayout en onderliggende serverpagina's vragen vaak in dezelfde
// render allebei naar de clubcontext. Deel binnen die render één auth- en
// databankresultaat, in plaats van dezelfde remote queries te herhalen.
export const getClubContext = cache(loadClubContext);
