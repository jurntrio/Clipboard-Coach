import Link from "next/link";
import Image from "next/image";
import { ExitCard } from "@/components/ui/ExitCard";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { getServerI18n } from "@/i18n/server";
import { ParentHome } from "@/components/parent/ParentHome";

export default async function DashboardHomePage() {
  const { t } = getServerI18n();
  const cards = [
    { href: "/dashboard/teams", label: t("common.teams"), icon: "/branding/teams.png" },
    { href: "/dashboard/videos", label: t("common.videoViewer"), icon: "/branding/video-viewer.png" },
    { href: "/dashboard/clips", label: t("common.matches"), icon: "/branding/games.png" },
    { href: "/dashboard/training", label: t("common.training"), icon: "/branding/training.png" },
    { href: "/dashboard/settings", label: t("common.settings"), icon: "/branding/settings.png" },
    { href: "/dashboard/help", label: t("common.help"), icon: "/branding/help.png" }
  ];
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: clubMembership }, { data: ownedTeam }, { data: guardianLink }] = user
    ? await Promise.all([
        supabase.from("profiles").select("account_role").eq("id", user.id).maybeSingle(),
        supabase.from("club_memberships").select("id").eq("profile_id", user.id).eq("status", "active").limit(1).maybeSingle(),
        supabase.from("teams").select("id").eq("coach_id", user.id).limit(1).maybeSingle(),
        supabase.from("player_guardians").select("id").eq("profile_id", user.id).is("revoked_at", null).limit(1).maybeSingle()
      ])
    : [{ data: null }, { data: null }, { data: null }, { data: null }];

  // account_role alleen is geen betrouwbare, exclusieve poort meer: een account kan tegelijk
  // ouder van een kind bij club A zijn EN trainer bij club B (of allebei bij dezelfde club) --
  // een gewoon seizoensverloop, geen edge case. isGuardian/hasOtherRole worden dus onafhankelijk
  // van elkaar bepaald, op basis van de effectieve koppelingen, niet op 1 enkel rolveld.
  const isGuardian = !!guardianLink;
  const hasOtherRole = isAdminEmail(user?.email)
    || profile?.account_role === "club_admin" || profile?.account_role === "club_admin_viewer" || profile?.account_role === "admin_viewer"
    || !!clubMembership || !!ownedTeam;

  if (isGuardian && !hasOtherRole) return <ParentHome />;

  const visibleCards = [...cards];
  if (isGuardian) {
    visibleCards.push({ href: "/dashboard/parent", label: "Ouderweergave", icon: "/branding/clips.png" });
  }
  if (isAdminEmail(user?.email) || profile?.account_role === "club_admin" || profile?.account_role === "club_admin_viewer") {
    visibleCards.push({ href: "/dashboard/club", label: "Clubbeheer", icon: "/branding/clubadmin.png" });
  }
  if (isAdminEmail(user?.email) || profile?.account_role === "admin_viewer") {
    visibleCards.push({ href: "/dashboard/admin", label: t("common.admin"), icon: "/branding/admin.png" });
  }

  return (
    <div className="p-8 flex flex-col items-center">
      <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={480} height={150} className="mb-10" />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-2xl w-full">
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            title={card.label}
            className="flex items-center justify-center p-6 bg-card rounded-xl border border-border hover:bg-cardHover hover:border-accent transition"
          >
            <Image src={card.icon} alt={card.label} width={96} height={96} />
          </Link>
        ))}
        <ExitCard />
      </div>
    </div>
  );
}
