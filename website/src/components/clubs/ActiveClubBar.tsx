"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useActiveClub } from "./ActiveClubProvider";
import { MenuIcon } from "@/components/ui/MenuIcon";

export type DashboardNavItem = { href: string; label: string; icon: string; primary: boolean };

export function ActiveClubBar({ navigation = [] }: { navigation?: DashboardNavItem[] }) {
  const { clubs, activeClub, activeClubId, isPlatformAdmin, changing, selectClub } = useActiveClub();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadMailboxCount, setUnreadMailboxCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [unresolvedClubNameCount, setUnresolvedClubNameCount] = useState(0);
  const [canApproveRequests, setCanApproveRequests] = useState(false);
  const [canReviewClubNames, setCanReviewClubNames] = useState(false);
  const primaryNavigation = navigation.filter((item) => item.primary);
  const moreNavigation = navigation.filter((item) => !item.primary);
  const actionCount = unreadMailboxCount + pendingApprovalCount + unresolvedClubNameCount;
  const showClubSelector = isPlatformAdmin || clubs.length > 1;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/badge-counts")
      .then((response) => response.ok ? response.json() : null)
      .then((body: { unreadMailboxCount?: number; pendingApprovalCount?: number; unresolvedClubNameCount?: number; canApproveRequests?: boolean; canReviewClubNames?: boolean } | null) => {
        if (cancelled || !body) return;
        setUnreadMailboxCount(body.unreadMailboxCount ?? 0);
        setPendingApprovalCount(body.pendingApprovalCount ?? 0);
        setUnresolvedClubNameCount(body.unresolvedClubNameCount ?? 0);
        setCanApproveRequests(body.canApproveRequests === true);
        setCanReviewClubNames(body.canReviewClubNames === true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeClubId]);
  const actionsMenuRef = useRef<HTMLDetailsElement>(null);
  const moreMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeMenus(event: PointerEvent) {
      const target = event.target as Node;
      for (const menu of [actionsMenuRef.current, moreMenuRef.current]) {
        if (menu?.open && !menu.contains(target)) menu.open = false;
      }
    }
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, []);

  useEffect(() => {
    if (actionsMenuRef.current) actionsMenuRef.current.open = false;
    if (moreMenuRef.current) moreMenuRef.current.open = false;
  }, [pathname]);
  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  const actionClass = "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-borderButton bg-button transition hover:border-accent hover:bg-cardHover sm:h-[52px] sm:w-[52px] sm:rounded-xl";
  const activeClass = "border-accent bg-accentDim";

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-card/95 px-1.5 py-1.5 backdrop-blur sm:px-5 sm:py-3">
      <div className="mx-auto flex max-w-7xl items-center gap-1 sm:gap-3">
        <Link
          href="/dashboard"
          title="Home"
          aria-label="Home"
          className={actionClass}
        >
          <MenuIcon src="/branding/Menu/home.svg" />
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
            className="h-8 min-w-0 max-w-20 rounded-lg border border-borderButton bg-button px-1.5 text-[10px] font-semibold text-textPrimary disabled:opacity-60 sm:h-[52px] sm:max-w-72 sm:rounded-xl sm:px-4 sm:text-base"
          >
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        )}
        <div className="ml-auto flex min-w-0 items-center justify-end gap-1 sm:gap-2">
          <nav aria-label="Belangrijkste modules" className="flex min-w-0 items-center gap-1 overflow-x-auto py-1 sm:gap-2">
            {primaryNavigation.map(item => (
              <Link key={item.href} href={item.href} title={item.label} aria-label={item.label} className={`${actionClass} ${pathname.startsWith(item.href) ? activeClass : ""}`}>
                <MenuIcon src={item.icon} />
              </Link>
            ))}
          </nav>
          <details ref={actionsMenuRef} className="group/actions relative">
            <summary title="Acties en meldingen" aria-label={`${actionCount} openstaande acties`} className={`${actionClass} relative cursor-pointer list-none ${pathname.startsWith("/dashboard/inbox") ? activeClass : ""}`}>
              <MenuIcon src="/branding/Menu/taken-notities.png" />
              {actionCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-card bg-red-500 px-1 text-[10px] font-black leading-none text-white">{actionCount > 99 ? "99+" : actionCount}</span>}
            </summary>
            <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-xl border border-border bg-cardAlt shadow-2xl">
              <div className="border-b border-borderSubtle px-4 py-3"><strong className="text-textBright">Acties</strong><p className="text-xs text-textMuted">Alles wat je aandacht vraagt.</p></div>
              <Link href="/dashboard/inbox" className="flex items-center gap-3 px-4 py-3 hover:bg-cardHover">
                <MenuIcon src="/branding/Menu/mail.png" compact />
                <span className="min-w-0 flex-1"><strong className="block text-sm text-textPrimary">Mailbox</strong><span className="text-xs text-textMuted">Ongelezen e-mails</span></span>
                <span className="rounded-full bg-accentDim px-2 py-1 text-xs font-bold text-accent">{unreadMailboxCount}</span>
              </Link>
              {canApproveRequests && <Link href="/dashboard/club/approvals" className="flex items-center gap-3 border-t border-borderSubtle px-4 py-3 hover:bg-cardHover">
                <MenuIcon src="/branding/Menu/clubbeheer.png" compact />
                <span className="min-w-0 flex-1"><strong className="block text-sm text-textPrimary">Goedkeuringen</strong><span className="text-xs text-textMuted">Club-, team- en persoonsaanvragen</span></span>
                <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-300">{pendingApprovalCount}</span>
              </Link>}
              {canReviewClubNames && <Link href="/dashboard/admin/club-matching" className="flex items-center gap-3 border-t border-borderSubtle px-4 py-3 hover:bg-cardHover">
                <MenuIcon src="/branding/Menu/algemene-admin.png" compact />
                <span className="min-w-0 flex-1"><strong className="block text-sm text-textPrimary">Clubnaam-matching</strong><span className="text-xs text-textMuted">Clubnamen nog aan een logo koppelen</span></span>
                <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-300">{unresolvedClubNameCount}</span>
              </Link>}
              {!unreadMailboxCount && !canApproveRequests && !canReviewClubNames && <p className="border-t border-borderSubtle px-4 py-3 text-xs text-textMuted">Geen openstaande acties.</p>}
            </div>
          </details>
          <details ref={moreMenuRef} className="group/more relative">
            <summary title="Meer" aria-label="Meer navigatie" className={`${actionClass} cursor-pointer list-none`}><MenuIcon src="/branding/Menu/meer.png" /></summary>
            <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-border bg-cardAlt py-2 shadow-2xl">
              {moreNavigation.map((item) => <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-cardHover ${pathname.startsWith(item.href) ? "bg-accentDim text-accent" : "text-textPrimary"}`}><MenuIcon src={item.icon} compact />{item.label}</Link>)}
              <div className="my-2 border-t border-borderSubtle" />
              <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-textPrimary hover:bg-cardHover"><MenuIcon src="/branding/Menu/instellingen.png" compact />Instellingen</Link>
              <Link href="/dashboard/help" className="flex items-center gap-3 px-4 py-2.5 text-sm text-textPrimary hover:bg-cardHover"><MenuIcon src="/branding/Menu/help.png" compact />Help</Link>
              <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-textPrimary hover:bg-cardHover"><MenuIcon src="/branding/Menu/afmelden.png" compact />Afmelden</button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
