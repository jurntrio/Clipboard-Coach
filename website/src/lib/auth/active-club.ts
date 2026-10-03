import { cookies } from "next/headers";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { isAdminEmail } from "@/lib/auth/admin";
import { getAccountProfile } from "@/lib/auth/profile";
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
  const { data: account } = await admin.from("person_accounts").select("person_id")
    .eq("profile_id", userId).eq("status", "active").is("revoked_at", null).maybeSingle();
  const { data: clubPeople } = account
    ? await admin.from("club_people").select("id, club_id, clubs(id, name, status, logo_url)")
      .eq("person_id", account.person_id).eq("status", "active")
    : { data: [] };
  const today = new Date().toISOString().slice(0, 10);
  const clubPersonIds = (clubPeople ?? []).map((item) => item.id);
  const { data: roleRows } = clubPersonIds.length
    ? await admin.from("club_role_assignments").select("club_person_id, role_type, club_team_id")
      .in("club_person_id", clubPersonIds).eq("status", "active")
      .lte("valid_from", today).or(`valid_until.is.null,valid_until.gte.${today}`)
    : { data: [] };
  const rolesByClubPerson = new Map<string, string[]>();
  for (const role of roleRows ?? []) {
    if (role.club_team_id) continue;
    rolesByClubPerson.set(role.club_person_id, [...(rolesByClubPerson.get(role.club_person_id) ?? []), role.role_type]);
  }
  const membershipClubs = (clubPeople ?? []).flatMap((clubPerson) => {
    const club = clubPerson.clubs as unknown as { id: string; name: string; status: string; logo_url: string | null } | null;
    const roles = rolesByClubPerson.get(clubPerson.id) ?? [];
    if (club?.status !== "active" || !roles.length) return [];
    const role = roles.includes("club_admin") ? "club_admin"
      : roles.includes("club_admin_viewer") ? "club_admin_viewer" : roles[0];
    return [{ id: club.id, name: club.name, logoUrl: club.logo_url, role }];
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
  const { data, error } = await supabase.auth.getClaims();
  const claims = !error ? data?.claims : null;
  // The emergency email allowlist needs the current Auth email, not a stale JWT.
  const usesEmailAllowlist = !!process.env.ADMIN_EMAILS?.split(",").some(email => email.trim());
  const user = claims?.sub
    ? usesEmailAllowlist
      ? (await supabase.auth.getUser()).data.user
      : { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined,
          user_metadata: claims.user_metadata ?? {}, app_metadata: claims.app_metadata ?? {} }
    : null;
  if (!user) return { user: null, clubs: [] as AvailableClub[], activeClubId: null, isPlatformAdmin: false, pendingClubs: [] as PendingClub[] };

  const profile = await getAccountProfile(user.id);
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
