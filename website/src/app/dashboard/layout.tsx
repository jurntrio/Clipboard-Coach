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
  const [access, modules, { data: profile }, { data: guardianRows }, { count: unreadMailboxCount }] = await Promise.all([
    clubId ? getClubAccess(clubId, user) : Promise.resolve(null),
    clubId
      ? getClubModuleConfiguration(clubId)
      : Promise.resolve({ configured: false, enabled: new Set() }),
    admin.from("profiles").select("account_role").eq("id", user.id).maybeSingle(),
    supabase.rpc("guardian_dashboard_players"),
    clubId
      ? admin.from("mailbox_recipients").select("id, mailbox_messages!inner(club_id)", { count: "exact", head: true })
          .eq("profile_id", user.id).is("read_at", null).eq("mailbox_messages.club_id", clubId)
      : Promise.resolve({ count: 0 })
  ]);
  const moduleOn = (key: ClubModuleKey) => !clubId || clubContext.isPlatformAdmin || !modules.configured || modules.enabled.has(key);
  const navigation = [];
  if (clubId) navigation.push({ href: "/dashboard/inbox", label: "Mailbox", icon: "/branding/Menu/mail.png", primary: true });
  if (access && hasClubPermission(access, "teams.view") && moduleOn("teams")) navigation.push({ href: "/dashboard/teams", label: "Teams", icon: "/branding/Menu/teams.png", primary: true });
  if (access && hasClubPermission(access, "games.view") && moduleOn("matches")) navigation.push({ href: "/dashboard/clips", label: "Wedstrijden", icon: "/branding/Menu/wedstrijden.png", primary: true });
  if (access && hasClubPermission(access, "training.view") && moduleOn("training")) navigation.push({ href: "/dashboard/training", label: "Training", icon: "/branding/Menu/training.png", primary: true });
  if (access && hasClubPermission(access, "video.view") && moduleOn("video_viewer")) navigation.push({ href: "/dashboard/videos", label: "Video Viewer", icon: "/branding/Menu/video.png", primary: true });
  if (access && hasClubPermission(access, "intradesk.view") && moduleOn("intradesk")) navigation.push({ href: "/dashboard/intradesk", label: "Intradesk", icon: "/branding/Menu/intradesk.png", primary: false });
  if ((clubContext.isPlatformAdmin || (access && ["club_admin", "club_admin_viewer"].includes(access.role))) && moduleOn("media")) navigation.push({ href: "/dashboard/media", label: "Media", icon: "/branding/Menu/media.png", primary: false });
  if (Array.isArray(guardianRows) && guardianRows.length) navigation.push({ href: "/dashboard/parent", label: "Spelers & clips", icon: "/branding/Menu/teams.png", primary: false });
  const canOpenClubManagement = access && (["club_admin", "club_admin_viewer", "platform_admin"].includes(access.role)
    || hasClubPermission(access, "teams.manage") || hasClubPermission(access, "teams.import"));
  if (canOpenClubManagement && moduleOn("club_management")) {
    navigation.push({ href: "/dashboard/club", label: "Clubbeheer", icon: "/branding/Menu/clubbeheer.png", primary: false });
  }
  if (clubContext.isPlatformAdmin || profile?.account_role === "admin_viewer") {
    navigation.push({ href: "/dashboard/admin", label: "Algemene Admin", icon: "/branding/Menu/algemene-admin.png", primary: false });
  }

  const canApproveClubRequests = !!clubId && !!access
    && (["club_admin", "platform_admin"].includes(access.role) || hasClubPermission(access, "teams.manage_all"));
  const approvalCounts = canApproveClubRequests ? await Promise.all([
    admin.from("club_memberships").select("profile_id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending"),
    admin.from("club_teams").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending"),
    admin.from("person_claim_reviews").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending")
  ]) : [];
  const pendingApprovalCount = approvalCounts.reduce((total, result) => total + (result.count ?? 0), 0);

  const hasOtherAccess = clubContext.isPlatformAdmin || (Array.isArray(guardianRows) && guardianRows.length > 0);
  const showPendingNotice = !clubId && !hasOtherAccess && clubContext.pendingClubs.length > 0;

  return (
    <ActiveClubProvider clubs={clubContext.clubs} initialClubId={clubContext.activeClubId} isPlatformAdmin={clubContext.isPlatformAdmin}>
      <div className="flex min-h-screen flex-col bg-page">
        <ActiveClubBar navigation={navigation} unreadMailboxCount={unreadMailboxCount ?? 0} pendingApprovalCount={pendingApprovalCount} canApproveRequests={canApproveClubRequests} />
        <main className="flex-1">{showPendingNotice ? <PendingClubAccessNotice pendingClubs={clubContext.pendingClubs} /> : children}</main>
        <footer className="mt-auto border-t border-border px-5 py-6"><LegalLinks /></footer>
      </div>
    </ActiveClubProvider>
  );
}

function PendingClubAccessNotice({ pendingClubs }: { pendingClubs: { id: string; name: string }[] }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-16 text-center">
      <img src="/branding/clubadmin.png" alt="" className="mx-auto h-16 w-16 rounded-xl object-cover" />
      <h1 className="mt-6 text-xl font-semibold text-textBright">Je aanvraag staat nog open</h1>
      <p className="mt-3 text-sm text-textMuted">
        {pendingClubs.length === 1
          ? `Je aanvraag om lid te worden van ${pendingClubs[0].name} is nog niet goedgekeurd.`
          : `Je aanvragen om lid te worden van ${pendingClubs.map((club) => club.name).join(", ")} zijn nog niet goedgekeurd.`}
        {" "}Zodra een beheerder van de club ze goedkeurt, krijg je hier toegang.
      </p>
    </div>
  );
}
