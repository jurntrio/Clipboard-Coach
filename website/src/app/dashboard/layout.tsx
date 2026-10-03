import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { getClubContext } from "@/lib/auth/active-club";
import { getAccountProfile } from "@/lib/auth/profile";
import { ActiveClubProvider } from "@/components/clubs/ActiveClubProvider";
import { ActiveClubBar } from "@/components/clubs/ActiveClubBar";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { getClubModuleConfiguration } from "@/lib/auth/club-module";
import type { ClubModuleKey } from "@/lib/club-modules";
import { TrainerOnboarding } from "@/components/onboarding/TrainerOnboarding";
import { getServerI18n } from "@/i18n/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const clubContext = await getClubContext();
  const { t } = getServerI18n();
  const user = clubContext.user;
  if (!user) redirect("/login");
  const supabase = createClient();
  const admin = createAdminClient();

  const clubId = clubContext.activeClubId;
  const [access, modules, profile, { data: guardianRows }, { data: activeClub }] = await Promise.all([
    clubId ? getClubAccess(clubId, user) : Promise.resolve(null),
    clubId
      ? getClubModuleConfiguration(clubId)
      : Promise.resolve({ configured: false, enabled: new Set() }),
    getAccountProfile(user.id),
    supabase.rpc("guardian_dashboard_players"),
    clubId ? admin.from("clubs").select("is_personal").eq("id", clubId).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const { data: onboardingTeam } = activeClub?.is_personal && !profile?.trainer_onboarding_completed_at && clubId
    ? await admin.from("club_teams").select("id, name").eq("club_id", clubId).eq("status", "active").order("created_at").limit(1).maybeSingle()
    : { data: null };
  const moduleOn = (key: ClubModuleKey) => !clubId || clubContext.isPlatformAdmin || !modules.configured || modules.enabled.has(key);
  const iconRoot = "/branding/cbcs_black_icons";
  const navigation = [];
  if (access && hasClubPermission(access, "teams.view") && moduleOn("teams")) navigation.push({ href: "/dashboard/teams", label: t("nav.teamsPlayers"), icon: `${iconRoot}/teams.png`, primary: true });
  if (access && hasClubPermission(access, "games.view") && moduleOn("matches")) navigation.push({ href: "/dashboard/teams?tab=matches", label: t("nav.matches"), icon: `${iconRoot}/wedstrijden.png`, primary: true });
  if (access && hasClubPermission(access, "training.view") && moduleOn("training")) navigation.push({ href: "/dashboard/teams?tab=training", label: t("nav.trainings"), icon: `${iconRoot}/trainingen.png`, primary: true });
  if (access && hasClubPermission(access, "intradesk.view") && moduleOn("intradesk")) navigation.push({ href: "/dashboard/intradesk", label: t("nav.intradesk"), icon: `${iconRoot}/intradesk.png`, primary: true });
  if (access && hasClubPermission(access, "video.view") && hasClubPermission(access, "games.view") && moduleOn("intradesk")) navigation.push({ href: "/dashboard/media-archive", label: t("nav.mediaArchive"), icon: `${iconRoot}/media.png`, primary: true });
  if (access && hasClubPermission(access, "games.scouting.view") && moduleOn("matches")) navigation.push({ href: "/dashboard/scouting", label: t("nav.scouting"), icon: `${iconRoot}/scouting.png`, primary: true });
  if (access && (["club_admin", "club_admin_viewer", "platform_admin"].includes(access.role) || access.functionRole === "equipment_manager")) navigation.push({ href: "/dashboard/equipment", label: t("nav.equipment"), icon: `${iconRoot}/materiaal.png`, primary: true });
  if ((clubContext.isPlatformAdmin || (access && ["club_admin", "club_admin_viewer"].includes(access.role))) && moduleOn("media")) navigation.push({ href: "/dashboard/media", label: t("nav.media"), icon: `${iconRoot}/media.png`, primary: true });
  if (access && hasClubPermission(access, "video.view") && moduleOn("video_viewer")) navigation.push({ href: "/dashboard/videos", label: t("nav.videoViewer"), icon: `${iconRoot}/video-viewer.png`, primary: true });
  if (clubId) navigation.push({ href: "/dashboard/inbox", label: t("nav.mailbox"), icon: `${iconRoot}/mailbox.png`, primary: true });
  const canOpenClubManagement = access && (["club_admin", "club_admin_viewer", "platform_admin"].includes(access.role)
    || hasClubPermission(access, "teams.manage") || hasClubPermission(access, "teams.import"));
  if (canOpenClubManagement && moduleOn("club_management")) {
    navigation.push({ href: "/dashboard/club", label: t("nav.clubManagement"), icon: `${iconRoot}/clubbeheer.png`, primary: true });
  }
  if (clubContext.isPlatformAdmin || profile?.account_role === "admin_viewer") {
    navigation.push({ href: "/dashboard/admin", label: t("nav.platformAdmin"), icon: `${iconRoot}/algemene-admin.png`, primary: true });
  }
  if (profile?.account_role === "platform_admin") {
    navigation.push({ href: "/clubboys/lottobingo", label: "Clubboys", icon: "/clubboys/icon.png", primary: true });
  }

  const hasOtherAccess = clubContext.isPlatformAdmin || (Array.isArray(guardianRows) && guardianRows.length > 0);
  const showPendingNotice = !clubId && !hasOtherAccess && clubContext.pendingClubs.length > 0;

  return (
    <ActiveClubProvider clubs={clubContext.clubs} initialClubId={clubContext.activeClubId} isPlatformAdmin={clubContext.isPlatformAdmin}>
      <div className="flex min-h-screen flex-col bg-page">
        {onboardingTeam && <TrainerOnboarding teamId={onboardingTeam.id} teamName={onboardingTeam.name} />}
        <ActiveClubBar navigation={navigation} />
        <main className="flex-1">{showPendingNotice ? <PendingClubAccessNotice pendingClubs={clubContext.pendingClubs} /> : children}</main>
        <footer className="mt-auto border-t border-border px-5 py-6"><LegalLinks /></footer>
      </div>
    </ActiveClubProvider>
  );
}

function PendingClubAccessNotice({ pendingClubs }: { pendingClubs: { id: string; name: string }[] }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-16 text-center">
      <Image src="/branding/clubadmin.webp" alt="" width={64} height={64} className="mx-auto h-16 w-16 rounded-xl object-cover" />
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
