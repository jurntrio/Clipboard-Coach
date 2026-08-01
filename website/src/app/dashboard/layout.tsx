import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { getClubContext } from "@/lib/auth/active-club";
import { ActiveClubProvider } from "@/components/clubs/ActiveClubProvider";
import { ActiveClubBar } from "@/components/clubs/ActiveClubBar";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { getClubModuleConfiguration } from "@/lib/auth/club-module";
import type { ClubModuleKey } from "@/lib/club-modules";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const clubContext = await getClubContext();
  const user = clubContext.user;
  if (!user) redirect("/login");
  const supabase = createClient();
  const admin = createAdminClient();

  const clubId = clubContext.activeClubId;
  const [access, modules, { data: profile }, { data: guardianRows }] = await Promise.all([
    clubId ? getClubAccess(clubId, user) : Promise.resolve(null),
    clubId
      ? getClubModuleConfiguration(clubId)
      : Promise.resolve({ configured: false, enabled: new Set() }),
    admin.from("profiles").select("account_role").eq("id", user.id).maybeSingle(),
    supabase.rpc("guardian_dashboard_players")
  ]);
  const moduleOn = (key: ClubModuleKey) => !clubId || clubContext.isPlatformAdmin || !modules.configured || modules.enabled.has(key);
  const navigation = [];
  if (clubId) navigation.push({ href: "/dashboard/inbox", label: "Mailbox", icon: "/branding/inbox.svg" });
  if (access && hasClubPermission(access, "teams.view") && moduleOn("teams")) navigation.push({ href: "/dashboard/teams", label: "Teams", icon: "/branding/teams.png" });
  if (access && hasClubPermission(access, "video.view") && moduleOn("video_viewer")) navigation.push({ href: "/dashboard/videos", label: "Video Viewer", icon: "/branding/video-viewer.png" });
  if (access && hasClubPermission(access, "games.view") && moduleOn("matches")) navigation.push({ href: "/dashboard/clips", label: "Wedstrijden", icon: "/branding/games.png" });
  if (access && hasClubPermission(access, "training.view") && moduleOn("training")) navigation.push({ href: "/dashboard/training", label: "Training", icon: "/branding/training.png" });
  if (access && hasClubPermission(access, "intradesk.view") && moduleOn("intradesk")) navigation.push({ href: "/dashboard/intradesk", label: "Intradesk", icon: "/branding/intradesk.png" });
  if ((clubContext.isPlatformAdmin || (access && ["club_admin", "club_admin_viewer"].includes(access.role))) && moduleOn("media")) navigation.push({ href: "/dashboard/media", label: "Media", icon: "/branding/media.svg" });
  if (Array.isArray(guardianRows) && guardianRows.length) navigation.push({ href: "/dashboard/parent", label: "Spelers & clips", icon: "/branding/clips.png" });
  const canOpenClubManagement = access && (["club_admin", "club_admin_viewer", "platform_admin"].includes(access.role)
    || hasClubPermission(access, "teams.manage") || hasClubPermission(access, "teams.import"));
  if (canOpenClubManagement && moduleOn("club_management")) {
    navigation.push({ href: "/dashboard/club", label: "Clubbeheer", icon: "/branding/clubadmin.png" });
  }
  if (clubContext.isPlatformAdmin || profile?.account_role === "admin_viewer") {
    navigation.push({ href: "/dashboard/admin", label: "Algemene Admin", icon: "/branding/admin.png" });
  }

  return (
    <ActiveClubProvider clubs={clubContext.clubs} initialClubId={clubContext.activeClubId} isPlatformAdmin={clubContext.isPlatformAdmin}>
      <div className="flex min-h-screen flex-col bg-page">
        <ActiveClubBar navigation={navigation} />
        <main className="flex-1">{children}</main>
        <footer className="mt-auto border-t border-border px-5 py-6"><LegalLinks /></footer>
      </div>
    </ActiveClubProvider>
  );
}
