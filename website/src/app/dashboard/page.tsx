import Link from "next/link";
import Image from "next/image";
import { ExitCard } from "@/components/ui/ExitCard";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { getServerI18n } from "@/i18n/server";

export default async function DashboardHomePage() {
  const { t } = getServerI18n();
  const cards = [
    { href: "/dashboard/teams", label: t("common.teams"), icon: "/branding/teams.png" },
    { href: "/dashboard/videos", label: t("common.videoViewer"), icon: "/branding/video-viewer.png" },
    { href: "/dashboard/clips", label: t("common.clips"), icon: "/branding/clips.png" },
    { href: "/dashboard/settings", label: t("common.settings"), icon: "/branding/settings.png" },
    { href: "/dashboard/help", label: t("common.help"), icon: "/branding/help.png" }
  ];
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const visibleCards = isAdminEmail(user?.email)
    ? [...cards, { href: "/dashboard/admin", label: t("common.admin"), icon: "/branding/admin.png" }]
    : cards;

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
