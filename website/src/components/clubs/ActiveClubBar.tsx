"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useActiveClub } from "./ActiveClubProvider";
import { MenuIcon } from "@/components/ui/MenuIcon";
import { SvsBrand } from "@/components/branding/SvsBrand";
import { useI18n } from "@/i18n/client";

export type DashboardNavItem = { href: string; label: string; icon: string; primary: boolean };

function teamTabForHref(href: string) {
  if (!href.startsWith("/dashboard/teams")) return null;
  const query = href.split("?", 2)[1];
  return new URLSearchParams(query ?? "").get("tab") ?? "overview";
}

export function ActiveClubBar({ navigation = [] }: { navigation?: DashboardNavItem[] }) {
  const { clubs, activeClub, activeClubId, isPlatformAdmin, changing, selectClub } = useActiveClub();
  const pathname = usePathname();
  const { t } = useI18n();
  const [unreadMailboxCount, setUnreadMailboxCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [unresolvedClubNameCount, setUnresolvedClubNameCount] = useState(0);
  const [unconfirmedTrainings, setUnconfirmedTrainings] = useState<{ id: string; training_date: string; start_time: string; teamName: string }[]>([]);
  const [pendingMatchReports, setPendingMatchReports] = useState<{ id: string; match_date: string; start_time: string | null; title: string }[]>([]);
  const [pendingOfficialImportCount, setPendingOfficialImportCount] = useState(0);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [clubMenuOpen, setClubMenuOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [clubMenuPosition, setClubMenuPosition] = useState({ top: 0, left: 0 });
  const [canApproveRequests, setCanApproveRequests] = useState(false);
  const [canReviewClubNames, setCanReviewClubNames] = useState(false);
  const teamsItem = navigation.find(item => item.href === "/dashboard/teams");
  const overflowCandidates = useMemo(() => [
    ...navigation.filter(item => item !== teamsItem).map(item => ({ kind: "navigation" as const, item })),
    { kind: "settings" as const },
    { kind: "help" as const },
    { kind: "signout" as const }
  ], [navigation, teamsItem]);
  const [visibleCandidateCount, setVisibleCandidateCount] = useState(0);
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
  const navigationRef = useRef<HTMLElement>(null);
  const homeButtonRef = useRef<HTMLAnchorElement>(null);
  const clubMenuButtonRef = useRef<HTMLButtonElement>(null);
  const clubMenuPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeMenus(event: PointerEvent) {
      const target = event.target as Node;
      if (actionsOpen && !actionsButtonRef.current?.contains(target) && !actionsPopupRef.current?.contains(target)) setActionsOpen(false);
      if (moreOpen && !moreButtonRef.current?.contains(target) && !moreMenuRef.current?.contains(target)) setMoreOpen(false);
      if (clubMenuOpen && !clubMenuButtonRef.current?.contains(target) && !clubMenuPopupRef.current?.contains(target)) setClubMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") { setActionsOpen(false); setMoreOpen(false); setClubMenuOpen(false); } }
    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeMenus); document.removeEventListener("keydown", closeOnEscape); };
  }, [actionsOpen, moreOpen, clubMenuOpen]);

  useEffect(() => {
    setActionsOpen(false);
    setMoreOpen(false);
    setClubMenuOpen(false);
  }, [pathname]);

  useLayoutEffect(() => {
    const navigationElement = navigationRef.current;
    const homeButton = homeButtonRef.current;
    if (!navigationElement || !homeButton) return;
    const navigationNode = navigationElement;
    const homeButtonNode = homeButton;
    function distributeItems() {
      const width = navigationNode.clientWidth;
      const itemWidth = homeButtonNode.getBoundingClientRect().width;
      const styles = window.getComputedStyle(navigationNode);
      const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
      const capacity = Math.max(0, Math.floor((width + gap) / (itemWidth + gap)));
      const fixedCount = 2 + (teamsItem ? 1 : 0); // Home, meldingen en eventueel Teams.
      const allFit = fixedCount + overflowCandidates.length <= capacity;
      setVisibleCandidateCount(allFit ? overflowCandidates.length : Math.max(0, capacity - fixedCount - 1));
    }
    distributeItems();
    const observer = new ResizeObserver(distributeItems);
    observer.observe(navigationNode);
    return () => observer.disconnect();
  }, [overflowCandidates.length, teamsItem]);
  function toggleActions() {
    if (actionsOpen) return setActionsOpen(false);
    const rect = actionsButtonRef.current?.getBoundingClientRect();
    if (rect) setPopupPosition({ top: rect.bottom + 8, left: Math.max(8, Math.min(window.innerWidth - 328, rect.right - 320)) });
    setActionsOpen(true);
  }
  function toggleClubMenu() {
    if (clubMenuOpen) return setClubMenuOpen(false);
    const rect = clubMenuButtonRef.current?.getBoundingClientRect();
    if (rect) setClubMenuPosition({ top: rect.bottom + 8, left: Math.max(8, Math.min(window.innerWidth - 264, rect.left)) });
    setClubMenuOpen(true);
  }
  function chooseClub(clubId: string) {
    setClubMenuOpen(false);
    if (clubId !== activeClubId) void selectClub(clubId);
  }
  function handleNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    const teamTab = teamTabForHref(href);
    if (!teamTab || !/^\/dashboard\/teams\/(?!players\/|staff\/)[^/]+$/.test(pathname)) return;
    event.preventDefault();
    const nextUrl = teamTab === "overview" ? pathname : `${pathname}?tab=${teamTab}`;
    window.history.replaceState(null, "", nextUrl);
    window.dispatchEvent(new CustomEvent("dashboard-team-tab", { detail: { tab: teamTab } }));
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
  const visibleCandidates = overflowCandidates.slice(0, visibleCandidateCount);
  const hiddenCandidates = overflowCandidates.slice(visibleCandidateCount);
  const moreActive = hiddenCandidates.some(candidate => candidate.kind === "navigation"
    ? pathname.startsWith(candidate.item.href.split("?", 1)[0])
    : candidate.kind === "settings" ? pathname.startsWith("/dashboard/settings") : candidate.kind === "help" ? pathname.startsWith("/dashboard/help") : false);

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-card/95 px-1.5 py-1.5 backdrop-blur sm:px-5 sm:py-3">
      <div className="mx-auto flex max-w-[96rem] flex-col items-center gap-1 sm:gap-2 xl:grid xl:grid-cols-[20rem_minmax(0,1fr)_20rem]">
        <div className="flex items-center gap-2 xl:w-80 xl:shrink-0">
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
          <button
            ref={clubMenuButtonRef}
            type="button"
            disabled={changing}
            onClick={toggleClubMenu}
            aria-haspopup="listbox"
            aria-expanded={clubMenuOpen}
            aria-label="Actieve club wijzigen"
            className="flex h-8 min-w-0 max-w-28 items-center gap-1.5 rounded-lg border border-borderButton bg-button px-2 text-left text-[10px] font-semibold text-textPrimary transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60 sm:h-[52px] sm:max-w-48 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-sm"
          >
            <span className="min-w-0 flex-1 truncate">{activeClub?.name ?? "Kies een club"}</span>
            <span aria-hidden="true" className={`shrink-0 text-textMuted transition-transform ${clubMenuOpen ? "rotate-180" : ""}`}>▾</span>
          </button>
        )}
        {clubMenuOpen && typeof document !== "undefined" && createPortal(
          <div ref={clubMenuPopupRef} role="listbox" aria-label="Clubs" style={{ top: clubMenuPosition.top, left: clubMenuPosition.left }} className="fixed z-[100] max-h-[min(70vh,28rem)] w-64 overflow-y-auto rounded-2xl border border-border bg-cardAlt py-2 shadow-2xl">
            {clubs.map((club) => (
              <button
                key={club.id}
                type="button"
                role="option"
                aria-selected={club.id === activeClubId}
                onClick={() => chooseClub(club.id)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-cardHover ${club.id === activeClubId ? "font-semibold text-accent" : "text-textPrimary"}`}
              >
                <span className="min-w-0 flex-1 truncate">{club.name}</span>
                {club.id === activeClubId && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>,
          document.body
        )}
        </div>
        <div className="flex w-full min-w-0 max-w-full items-center justify-center gap-1 justify-self-stretch sm:gap-2">
          <nav ref={navigationRef} aria-label={t("nav.mainLabel")} className="flex w-full min-w-0 max-w-full items-center justify-center gap-1 py-1 sm:gap-2">
            <Link ref={homeButtonRef} href="/dashboard" title="Home" aria-label="Home" className={`${actionClass} ${pathname === "/dashboard" ? activeClass : ""}`}>
              <MenuIcon src="/branding/cbcs_black_icons/home.png" />
            </Link>
            {teamsItem && <Link href={teamsItem.href} onClick={(event) => handleNavigation(event, teamsItem.href)} title={teamsItem.label} aria-label={teamsItem.label} className={`${actionClass} relative ${pathname.startsWith("/dashboard/teams") ? activeClass : ""}`}>
              <MenuIcon src={teamsItem.icon} />
            </Link>}
            {visibleCandidates.map(candidate => candidate.kind === "navigation" ? (
              <Link key={candidate.item.href} href={candidate.item.href} onClick={(event) => handleNavigation(event, candidate.item.href)} title={candidate.item.label} aria-label={candidate.item.label} className={`${actionClass} relative ${pathname.startsWith(candidate.item.href.split("?", 1)[0]) ? activeClass : ""}`}>
                <MenuIcon src={candidate.item.icon} />
                {candidate.item.href === "/dashboard/club" && pendingOfficialImportCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-card bg-red-500 px-1 text-[10px] font-black leading-none text-white">{pendingOfficialImportCount > 99 ? "99+" : pendingOfficialImportCount}</span>}
              </Link>
            ) : candidate.kind === "settings" ? <Link key="settings" href="/dashboard/settings" title={t("nav.settings")} aria-label={t("nav.settings")} className={`${actionClass} ${pathname.startsWith("/dashboard/settings") ? activeClass : ""}`}><MenuIcon src="/branding/cbcs_black_icons/instellingen.png" /></Link>
              : candidate.kind === "help" ? <Link key="help" href="/dashboard/help" title={t("nav.help")} aria-label={t("nav.help")} className={`${actionClass} ${pathname.startsWith("/dashboard/help") ? activeClass : ""}`}><MenuIcon src="/branding/cbcs_black_icons/help.png" /></Link>
                : <button key="signout" type="button" title={t("nav.signOut")} aria-label={t("nav.signOut")} onClick={() => void signOut()} className={actionClass}><MenuIcon src="/branding/cbcs_black_icons/afmelden.png" /></button>)}
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
            {!!hiddenCandidates.length && <div ref={moreMenuRef} className="relative">
              <button ref={moreButtonRef} type="button" title={t("nav.more")} aria-label={t("nav.moreLabel")} aria-expanded={moreOpen} onClick={() => setMoreOpen(current => !current)} className={`${actionClass} text-lg font-black leading-none ${moreActive ? activeClass : ""}`}>...</button>
              {moreOpen && <div className="absolute right-0 top-full z-50 mt-2 max-h-[min(70vh,32rem)] w-64 overflow-y-auto rounded-xl border border-border bg-cardAlt py-1 shadow-2xl">
                {hiddenCandidates.map(candidate => candidate.kind === "navigation" ? <Link key={candidate.item.href} href={candidate.item.href} onClick={(event) => handleNavigation(event, candidate.item.href)} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-textPrimary hover:bg-cardHover"><MenuIcon src={candidate.item.icon} compact /><span className="min-w-0 flex-1 truncate">{candidate.item.label}</span>{candidate.item.href === "/dashboard/club" && pendingOfficialImportCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">{pendingOfficialImportCount > 99 ? "99+" : pendingOfficialImportCount}</span>}</Link>
                  : candidate.kind === "settings" ? <Link key="settings" href="/dashboard/settings" className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-textPrimary hover:bg-cardHover"><MenuIcon src="/branding/cbcs_black_icons/instellingen.png" compact /><span>{t("nav.settings")}</span></Link>
                    : candidate.kind === "help" ? <Link key="help" href="/dashboard/help" className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-textPrimary hover:bg-cardHover"><MenuIcon src="/branding/cbcs_black_icons/help.png" compact /><span>{t("nav.help")}</span></Link>
                      : <button key="signout" type="button" onClick={() => void signOut()} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-textPrimary hover:bg-cardHover"><MenuIcon src="/branding/cbcs_black_icons/afmelden.png" compact /><span>{t("nav.signOut")}</span></button>)}
              </div>}
            </div>}
          </nav>
        </div>
        <div className="hidden xl:block" aria-hidden="true" />
      </div>
    </div>
  );
}
