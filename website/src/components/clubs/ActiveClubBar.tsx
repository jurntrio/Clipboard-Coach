"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useActiveClub } from "./ActiveClubProvider";
import { MenuIcon } from "@/components/ui/MenuIcon";
import { SvsBrand } from "@/components/branding/SvsBrand";

export type DashboardNavItem = { href: string; label: string; icon: string; primary: boolean };

export function ActiveClubBar({ navigation = [] }: { navigation?: DashboardNavItem[] }) {
  const { clubs, activeClub, activeClubId, isPlatformAdmin, changing, selectClub } = useActiveClub();
  const pathname = usePathname();
  const [unreadMailboxCount, setUnreadMailboxCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [unresolvedClubNameCount, setUnresolvedClubNameCount] = useState(0);
  const [unconfirmedTrainings, setUnconfirmedTrainings] = useState<{ id: string; training_date: string; start_time: string; teamName: string }[]>([]);
  const [pendingMatchReports, setPendingMatchReports] = useState<{ id: string; match_date: string; start_time: string | null; title: string }[]>([]);
  const [pendingOfficialImportCount, setPendingOfficialImportCount] = useState(0);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [canApproveRequests, setCanApproveRequests] = useState(false);
  const [canReviewClubNames, setCanReviewClubNames] = useState(false);
  const mailboxIndex = navigation.findIndex((item) => item.href === "/dashboard/inbox");
  const beforeMessages = mailboxIndex >= 0 ? navigation.slice(0, mailboxIndex + 1) : navigation;
  const afterMessages = mailboxIndex >= 0 ? navigation.slice(mailboxIndex + 1) : [];
  const actionCount = unreadMailboxCount + pendingApprovalCount + unresolvedClubNameCount + unconfirmedTrainings.length + pendingMatchReports.length + pendingOfficialImportCount;
  const showClubSelector = isPlatformAdmin || clubs.length > 1;

  useEffect(() => {
    let cancelled = false;
    function refreshCounts() {
      fetch("/api/dashboard/badge-counts", { cache: "no-store" })
        .then((response) => response.ok ? response.json() : null)
        .then((body: { unreadMailboxCount?: number; pendingApprovalCount?: number; unresolvedClubNameCount?: number; canApproveRequests?: boolean; canReviewClubNames?: boolean; unconfirmedTrainings?: { id: string; training_date: string; start_time: string; teamName: string }[]; pendingMatchReports?: { id: string; match_date: string; start_time: string | null; title: string }[]; pendingOfficialImportCount?: number } | null) => {
          if (cancelled || !body) return;
          setUnreadMailboxCount(body.unreadMailboxCount ?? 0);
          setPendingApprovalCount(body.pendingApprovalCount ?? 0);
          setUnresolvedClubNameCount(body.unresolvedClubNameCount ?? 0);
          setCanApproveRequests(body.canApproveRequests === true);
          setCanReviewClubNames(body.canReviewClubNames === true);
          setUnconfirmedTrainings(body.unconfirmedTrainings ?? []);
          setPendingMatchReports(body.pendingMatchReports ?? []);
          setPendingOfficialImportCount(body.pendingOfficialImportCount ?? 0);
        })
        .catch(() => {});
    }
    refreshCounts();
    window.addEventListener("dashboard-badges:refresh", refreshCounts);
    window.addEventListener("focus", refreshCounts);
    return () => {
      cancelled = true;
      window.removeEventListener("dashboard-badges:refresh", refreshCounts);
      window.removeEventListener("focus", refreshCounts);
    };
  }, [activeClubId]);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const actionsPopupRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function closeMenus(event: PointerEvent) {
      const target = event.target as Node;
      if (actionsOpen && !actionsButtonRef.current?.contains(target) && !actionsPopupRef.current?.contains(target)) setActionsOpen(false);
      if (moreOpen && !moreButtonRef.current?.contains(target) && !moreMenuRef.current?.contains(target)) setMoreOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") { setActionsOpen(false); setMoreOpen(false); } }
    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeMenus); document.removeEventListener("keydown", closeOnEscape); };
  }, [actionsOpen, moreOpen]);

  useEffect(() => {
    setActionsOpen(false);
    setMoreOpen(false);
  }, [pathname]);
  function toggleActions() {
    if (actionsOpen) return setActionsOpen(false);
    const rect = actionsButtonRef.current?.getBoundingClientRect();
    if (rect) setPopupPosition({ top: rect.bottom + 8, left: Math.max(8, Math.min(window.innerWidth - 328, rect.right - 320)) });
    setActionsOpen(true);
  }
  async function signOut() {
    const supabase = createClient();
    try {
      await Promise.all([
        supabase.auth.signOut({ scope: "local" }),
        fetch("/api/auth/logout", { method: "POST", cache: "no-store" })
      ]);
    } finally {
      window.location.assign("/login");
    }
  }
  const actionClass = "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-borderButton bg-button transition hover:border-accent hover:bg-cardHover sm:h-[52px] sm:w-[52px] sm:rounded-xl";
  const activeClass = "border-accent bg-accentDim";
  const mobileOverflowHrefs = new Set(["/dashboard/intradesk", "/dashboard/videos"]);
  const mobileMoreActive = pathname.startsWith("/dashboard/settings") || pathname.startsWith("/dashboard/help");

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-card/95 px-1.5 py-1.5 backdrop-blur sm:px-5 sm:py-3">
      <div className="relative mx-auto flex max-w-[96rem] flex-col items-center justify-center gap-1 sm:gap-2 xl:flex-row">
        <div className="flex items-center gap-3 xl:absolute xl:left-0">
        <Link href="/dashboard" aria-label="Sport Visual Systems home" className="hidden sm:block">
          <SvsBrand format="square" width={52} height={52} className="h-[52px] w-[52px] rounded-xl border border-borderButton" />
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
            className="h-8 min-w-0 max-w-20 rounded-lg border border-borderButton bg-button px-1.5 text-[10px] font-semibold text-textPrimary disabled:cursor-not-allowed disabled:opacity-60 sm:h-[52px] sm:max-w-72 sm:rounded-xl sm:px-4 sm:text-base"
          >
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        )}
        </div>
        <div className="flex min-w-0 max-w-full items-center justify-center gap-1 sm:gap-2">
          <nav aria-label="Hoofdnavigatie" className="flex min-w-0 items-center gap-1 overflow-x-auto py-1 sm:gap-2">
            <Link href="/dashboard" title="Home" aria-label="Home" className={`${actionClass} ${pathname === "/dashboard" ? activeClass : ""}`}>
              <MenuIcon src="/branding/cbcs_black_icons/home.png" />
            </Link>
            {beforeMessages.map(item => (
              <Link key={item.href} href={item.href} title={item.label} aria-label={item.label} className={`${actionClass} relative ${mobileOverflowHrefs.has(item.href) ? "hidden sm:grid" : ""} ${pathname.startsWith(item.href) ? activeClass : ""}`}>
                <MenuIcon src={item.icon} />
                {item.href === "/dashboard/club" && pendingOfficialImportCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-card bg-red-500 px-1 text-[10px] font-black leading-none text-white">{pendingOfficialImportCount > 99 ? "99+" : pendingOfficialImportCount}</span>}
              </Link>
            ))}
            <button ref={actionsButtonRef} type="button" title="Berichten en meldingen" aria-label={actionCount ? `${actionCount} openstaande acties` : "Geen openstaande acties"} aria-expanded={actionsOpen} onClick={toggleActions} className={`${actionClass} relative`}>
              <MenuIcon src="/branding/cbcs_black_icons/berichten.png" />
              {actionCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-card bg-red-500 px-1 text-[10px] font-black leading-none text-white">{actionCount > 99 ? "99+" : actionCount}</span>}
            </button>
            {actionsOpen && typeof document !== "undefined" && createPortal(<div ref={actionsPopupRef} role="dialog" aria-label="Berichten en meldingen" style={{ top: popupPosition.top, left: popupPosition.left }} className="fixed z-[100] max-h-[min(70vh,36rem)] w-80 overflow-y-auto rounded-2xl border border-border bg-cardAlt shadow-2xl">
              <div className="border-b border-borderSubtle px-5 py-4"><strong className="text-base text-textBright">Acties</strong><p className="mt-1 text-sm text-textSecondary">Alles wat je aandacht vraagt.</p></div>
              {unreadMailboxCount > 0 && <Link href="/dashboard/inbox" className="flex items-center gap-3 px-5 py-4 transition hover:bg-cardHover">
                <MenuIcon src="/branding/Menu/mail.png" compact />
                <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-textBright">Mailbox</strong><span className="mt-0.5 block text-sm leading-5 text-textSecondary">Ongelezen e-mails</span></span>
                <span className="min-w-7 rounded-full bg-accentDim px-2 py-1 text-center text-xs font-bold text-accent">{unreadMailboxCount}</span>
              </Link>}
              {unconfirmedTrainings.map(training => <Link key={training.id} href={`/dashboard/training/${training.id}#aanwezigheden`} className="flex items-center gap-3 border-t border-borderSubtle px-5 py-4 transition hover:bg-cardHover">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-red-500/50 bg-red-500/10 text-sm font-black text-red-400">A</span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-textPrimary">Aanwezigheden bevestigen</strong><span className="block truncate text-xs text-textMuted">{training.teamName} · {new Date(`${training.training_date}T12:00:00`).toLocaleDateString("nl-BE", { day: "numeric", month: "short" })} · {training.start_time.slice(0, 5)}</span></span>
              </Link>)}
              {pendingMatchReports.map(match => <Link key={match.id} href={`/dashboard/games/${match.id}?edit=1#wedstrijdverslag`} className="flex items-center gap-3 border-t border-borderSubtle px-5 py-4 transition hover:bg-cardHover">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-500/50 bg-amber-500/10 text-sm font-black text-amber-400">V</span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-textPrimary">Wedstrijdverslag opstellen</strong><span className="block truncate text-xs text-textMuted">{match.title} · {new Date(`${match.match_date}T12:00:00`).toLocaleDateString("nl-BE", { day: "numeric", month: "short" })}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}</span></span>
              </Link>)}
              {canApproveRequests && pendingApprovalCount > 0 && <Link href="/dashboard/club/approvals" className="flex items-center gap-3 border-t border-borderSubtle px-5 py-4 transition hover:bg-cardHover">
                <MenuIcon src="/branding/Menu/clubbeheer.png" compact />
                <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-textBright">Goedkeuringen</strong><span className="mt-0.5 block text-sm leading-5 text-textSecondary">Club-, team- en persoonsaanvragen</span></span>
                <span className="min-w-7 rounded-full bg-accentDim px-2 py-1 text-center text-xs font-bold text-accent">{pendingApprovalCount}</span>
              </Link>}
              {canReviewClubNames && unresolvedClubNameCount > 0 && <Link href="/dashboard/admin/club-matching" className="flex items-center gap-3 border-t border-borderSubtle px-5 py-4 transition hover:bg-cardHover">
                <MenuIcon src="/branding/Menu/algemene-admin.png" compact />
                <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-textBright">Clubnaam-matching</strong><span className="mt-0.5 block text-sm leading-5 text-textSecondary">Clubnamen nog aan een logo koppelen</span></span>
                <span className="min-w-7 rounded-full bg-accentDim px-2 py-1 text-center text-xs font-bold text-accent">{unresolvedClubNameCount}</span>
              </Link>}
              {pendingOfficialImportCount > 0 && <Link href="/dashboard/club#imports-koppelingen" className="flex items-center gap-3 border-t border-borderSubtle px-5 py-4 transition hover:bg-cardHover">
                <MenuIcon src="/branding/Menu/clubbeheer.png" compact />
                <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-textBright">Wedstrijden koppelen</strong><span className="mt-0.5 block text-sm leading-5 text-textSecondary">Officiële wedstrijden wachten op een SVS-ploeg</span></span>
                <span className="min-w-7 rounded-full bg-red-500 px-2 py-1 text-center text-xs font-bold text-white">{pendingOfficialImportCount > 99 ? "99+" : pendingOfficialImportCount}</span>
              </Link>}
              {!actionCount && <p className="px-5 py-5 text-sm text-textSecondary">Geen openstaande acties.</p>}
            </div>
            , document.body)}
            {afterMessages.map(item => (
              <Link key={item.href} href={item.href} title={item.label} aria-label={item.label} className={`${actionClass} relative ${mobileOverflowHrefs.has(item.href) ? "hidden sm:grid" : ""} ${pathname.startsWith(item.href) ? activeClass : ""}`}>
                <MenuIcon src={item.icon} />
                {item.href === "/dashboard/club" && pendingOfficialImportCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-card bg-red-500 px-1 text-[10px] font-black leading-none text-white">{pendingOfficialImportCount > 99 ? "99+" : pendingOfficialImportCount}</span>}
              </Link>
            ))}
            <Link href="/dashboard/settings" title="Instellingen" aria-label="Instellingen" className={`${actionClass} hidden sm:grid ${pathname.startsWith("/dashboard/settings") ? activeClass : ""}`}><MenuIcon src="/branding/cbcs_black_icons/instellingen.png" /></Link>
            <Link href="/dashboard/help" title="Help" aria-label="Help" className={`${actionClass} hidden sm:grid ${pathname.startsWith("/dashboard/help") ? activeClass : ""}`}><MenuIcon src="/branding/cbcs_black_icons/help.png" /></Link>
            <button type="button" title="Afmelden" aria-label="Afmelden" onClick={() => void signOut()} className={`${actionClass} hidden sm:grid`}><MenuIcon src="/branding/cbcs_black_icons/afmelden.png" /></button>
            <div ref={moreMenuRef} className="relative sm:hidden">
              <button ref={moreButtonRef} type="button" title="Meer" aria-label="Meer navigatie" aria-expanded={moreOpen} onClick={() => setMoreOpen(current => !current)} className={`${actionClass} text-lg font-black leading-none ${mobileMoreActive ? activeClass : ""}`}>...</button>
              {moreOpen && <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-cardAlt py-1 shadow-2xl">
                <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-textPrimary hover:bg-cardHover"><MenuIcon src="/branding/cbcs_black_icons/instellingen.png" compact /><span>Instellingen</span></Link>
                <Link href="/dashboard/help" className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-textPrimary hover:bg-cardHover"><MenuIcon src="/branding/cbcs_black_icons/help.png" compact /><span>Help</span></Link>
                <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-textPrimary hover:bg-cardHover"><MenuIcon src="/branding/cbcs_black_icons/afmelden.png" compact /><span>Afmelden</span></button>
              </div>}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
