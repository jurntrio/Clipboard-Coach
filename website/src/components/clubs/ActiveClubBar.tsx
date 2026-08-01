"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useActiveClub } from "./ActiveClubProvider";

export type DashboardNavItem = { href: string; label: string; icon: string; primary: boolean };

export function ActiveClubBar({ navigation = [], unreadMailboxCount = 0 }: { navigation?: DashboardNavItem[]; unreadMailboxCount?: number }) {
  const { clubs, activeClub, activeClubId, isPlatformAdmin, changing, selectClub } = useActiveClub();
  const router = useRouter();
  const pathname = usePathname();
  const primaryNavigation = navigation.filter((item) => item.primary);
  const moreNavigation = navigation.filter((item) => !item.primary);
  const actionCount = unreadMailboxCount;
  const showClubSelector = isPlatformAdmin || clubs.length > 1;
  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  const actionClass = "grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-borderButton bg-button transition hover:border-accent hover:bg-cardHover sm:h-[52px] sm:w-[52px]";
  const activeClass = "border-accent bg-accentDim";

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-card/95 px-2 py-2 backdrop-blur sm:px-5 sm:py-3">
      <div className="mx-auto flex max-w-7xl items-center gap-1.5 sm:gap-3">
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
            className="hidden h-[52px] w-[52px] shrink-0 rounded-xl border border-borderButton bg-transparent object-contain sm:block"
          />
        ) : (
          <div
            aria-label="Geen clublogo"
            className="hidden h-[52px] w-[52px] shrink-0 place-items-center rounded-xl border border-borderButton bg-white p-1 text-center text-[8px] font-bold uppercase leading-tight text-[#7a857f] sm:grid"
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
            className="h-11 min-w-0 max-w-28 rounded-xl border border-borderButton bg-button px-2 text-xs font-semibold text-textPrimary disabled:opacity-60 sm:h-[52px] sm:max-w-72 sm:px-4 sm:text-base"
          >
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        )}
        <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
          <nav aria-label="Belangrijkste modules" className="flex min-w-0 items-center gap-1.5 overflow-x-auto py-1 sm:gap-2">
            {primaryNavigation.map(item => (
              <Link key={item.href} href={item.href} title={item.label} aria-label={item.label} className={`${actionClass} ${pathname.startsWith(item.href) ? activeClass : ""}`}>
                <Image src={item.icon} alt="" width={30} height={30} className="h-7 w-7 sm:h-8 sm:w-8" />
              </Link>
            ))}
          </nav>
          <details className="group/actions relative">
            <summary title="Acties en meldingen" aria-label={`${actionCount} openstaande acties`} className={`${actionClass} relative cursor-pointer list-none ${pathname.startsWith("/dashboard/inbox") ? activeClass : ""}`}>
              <span className="h-7 w-7 bg-textPrimary sm:h-8 sm:w-8" style={{ WebkitMask: "url('/branding/clipboard-action-v2.png') center / contain no-repeat", mask: "url('/branding/clipboard-action-v2.png') center / contain no-repeat" }} />
              {actionCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-card bg-red-500 px-1 text-[10px] font-black leading-none text-white">{actionCount > 99 ? "99+" : actionCount}</span>}
            </summary>
            <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-xl border border-border bg-cardAlt shadow-2xl">
              <div className="border-b border-borderSubtle px-4 py-3"><strong className="text-textBright">Acties</strong><p className="text-xs text-textMuted">Alles wat je aandacht vraagt.</p></div>
              <Link href="/dashboard/inbox" className="flex items-center gap-3 px-4 py-3 hover:bg-cardHover">
                <Image src="/branding/inbox.svg" alt="" width={28} height={28} />
                <span className="min-w-0 flex-1"><strong className="block text-sm text-textPrimary">Mailbox</strong><span className="text-xs text-textMuted">Ongelezen e-mails</span></span>
                <span className="rounded-full bg-accentDim px-2 py-1 text-xs font-bold text-accent">{unreadMailboxCount}</span>
              </Link>
              {!actionCount && <p className="border-t border-borderSubtle px-4 py-3 text-xs text-textMuted">Geen openstaande acties.</p>}
            </div>
          </details>
          <details className="group/more relative">
            <summary title="Meer" aria-label="Meer navigatie" className={`${actionClass} cursor-pointer list-none text-xl font-black text-textPrimary`}>•••</summary>
            <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-border bg-cardAlt py-2 shadow-2xl">
              {moreNavigation.map((item) => <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-cardHover ${pathname.startsWith(item.href) ? "bg-accentDim text-accent" : "text-textPrimary"}`}><Image src={item.icon} alt="" width={26} height={26} />{item.label}</Link>)}
              <div className="my-2 border-t border-borderSubtle" />
              <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-textPrimary hover:bg-cardHover"><Image src="/branding/settings.png" alt="" width={26} height={26} />Instellingen</Link>
              <Link href="/dashboard/help" className="flex items-center gap-3 px-4 py-2.5 text-sm text-textPrimary hover:bg-cardHover"><Image src="/branding/help.png" alt="" width={26} height={26} />Help</Link>
              <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-textPrimary hover:bg-cardHover"><Image src="/branding/exit.png" alt="" width={26} height={26} />Afmelden</button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
