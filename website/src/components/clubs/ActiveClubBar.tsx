"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useActiveClub } from "./ActiveClubProvider";

export type DashboardNavItem = { href: string; label: string; icon: string };

export function ActiveClubBar({ navigation = [] }: { navigation?: DashboardNavItem[] }) {
  const { clubs, activeClub, activeClubId, isPlatformAdmin, changing, selectClub } = useActiveClub();
  const router = useRouter();
  const showClubSelector = isPlatformAdmin || clubs.length > 1;
  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  const actionClass = "grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl border border-borderButton bg-button transition hover:border-accent hover:bg-cardHover";

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-card/95 px-5 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Link
          href="/dashboard"
          title="Home"
          aria-label="Home"
          className={actionClass}
        >
          <Image src="/branding/home.png" alt="" width={30} height={30} />
        </Link>
        {activeClub?.logoUrl ? (
          <Image
            src={activeClub.logoUrl}
            alt={`${activeClub.name} logo`}
            title={activeClub.name}
            width={52}
            height={52}
            unoptimized
            className="h-[52px] w-[52px] shrink-0 rounded-xl border border-borderButton bg-transparent object-contain"
          />
        ) : (
          <div
            aria-label="Geen clublogo"
            className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl border border-borderButton bg-white p-1 text-center text-[8px] font-bold uppercase leading-tight text-[#7a857f]"
          >
            Geen logo
          </div>
        )}
        {showClubSelector && (
          <select
            aria-label="Actieve club"
            value={activeClubId ?? ""}
            disabled={changing}
            onChange={(event) => void selectClub(event.target.value)}
            className="h-[52px] min-w-0 max-w-72 rounded-xl border border-borderButton bg-button px-4 font-semibold text-textPrimary disabled:opacity-60"
          >
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        )}
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
          <nav aria-label="Dashboardmodules" className="flex min-w-0 items-center gap-2 overflow-x-auto py-1">
            {navigation.map(item => (
              <Link key={item.href} href={item.href} title={item.label} aria-label={item.label} className={actionClass}>
                <Image src={item.icon} alt="" width={32} height={32} />
              </Link>
            ))}
          </nav>
          <Link href="/dashboard/settings" title="Instellingen" aria-label="Instellingen" className={actionClass}>
            <Image src="/branding/settings.png" alt="" width={32} height={32} />
          </Link>
          <Link href="/dashboard/help" title="Help" aria-label="Help" className={actionClass}>
            <Image src="/branding/help.png" alt="" width={32} height={32} />
          </Link>
          <button type="button" onClick={() => void signOut()} title="Afmelden" aria-label="Afmelden" className={actionClass}>
            <Image src="/branding/exit.png" alt="" width={32} height={32} />
          </button>
        </div>
      </div>
    </div>
  );
}
