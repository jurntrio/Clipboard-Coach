import Link from "next/link";
import Image from "next/image";
import { ExitCard } from "@/components/ui/ExitCard";

const cards = [
  { href: "/dashboard/teams", label: "Teams", icon: "/branding/teams.png" },
  { href: "/dashboard/videos", label: "Video Viewer", icon: "/branding/video-viewer.png" },
  { href: "/dashboard/clips", label: "Clips", icon: "/branding/clips.png" },
  { href: "/dashboard/settings", label: "Settings", icon: "/branding/settings.png" },
  { href: "/dashboard/help", label: "Help", icon: "/branding/help.png" }
];

export default function DashboardHomePage() {
  return (
    <div className="p-8 flex flex-col items-center">
      <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={480} height={150} className="mb-10" />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-2xl w-full">
        {cards.map((card) => (
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
