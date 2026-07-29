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
  return (memberships ?? []).flatMap((membership) => {
    const club = membership.clubs as unknown as { id: string; name: string; status: string; logo_url: string | null } | null;
    return club?.status === "active"
      ? [{ id: club.id, name: club.name, logoUrl: club.logo_url, role: membership.role }]
      : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
}, ["available-clubs"], { revalidate: 30 });

async function loadClubContext() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, clubs: [] as AvailableClub[], activeClubId: null, isPlatformAdmin: false };

  const { data: profile } = await createAdminClient().from("profiles").select("account_role").eq("id", user.id).maybeSingle();
  const platformAdmin = isAdminEmail(user.email) || profile?.account_role === "platform_admin";
  const clubs = await loadAvailableClubs(user.id, platformAdmin);

  const requestedId = cookies().get(ACTIVE_CLUB_COOKIE)?.value;
  const activeClubId = clubs.some((club) => club.id === requestedId) ? requestedId! : clubs[0]?.id ?? null;
  return { user, clubs, activeClubId, isPlatformAdmin: platformAdmin };
}

// Dashboardlayout en onderliggende serverpagina's vragen vaak in dezelfde
// render allebei naar de clubcontext. Deel binnen die render één auth- en
// databankresultaat, in plaats van dezelfde remote queries te herhalen.
export const getClubContext = cache(loadClubContext);
