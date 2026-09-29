"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ClipPreviewModal, type ClipSegmentPlayback } from "@/components/clips/ClipPreviewModal";
import { ShareClipDialog } from "@/components/clips/ShareClipDialog";
import { PlayerClipsShareDialog } from "@/components/clips/PlayerClipsShareDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { buildPublicShareUrl, buildTvShareUrl } from "@/lib/share-url";
import { useI18n } from "@/i18n/client";
import type { Match, Player, StandardTag, Team } from "@/types/database";
import { useActiveClub } from "@/components/clubs/ActiveClubProvider";
import { MatchPreparationDialog } from "@/components/matches/MatchPreparationDialog";
import { TeamContextHeader } from "@/components/teams/TeamContextHeader";
import { ClubLogoImage, type ClubLogoData } from "@/components/clubs/ClubLogoImage";
import { normalizeTagName, uniqueTagNames } from "@/lib/tag-names";

type HubMatch = Match & { match_videos: { video_id: string }[]; team_a_logo: ClubLogoData; team_b_logo: ClubLogoData };
type HubClip = {
  id: string; coach_id: string; video_id: string; name: string; display_number: number | null; render_status: string; created_at: string; audience_type: "full_team" | "selected_players" | "specific_players";
  audience_player_ids: string[];
  share_links: Array<{ token: string; short_code: string; view_count?: number }>;
  rendered_segments: Array<{ id: string; url: string; name: string; color: string; duration: number; play_start?: number; mobile_compatible?: boolean }>;
  videos: { title: string | null; video_url: string } | null;
  clip_segments: Array<{ id: string; sequence_order: number; video_id: string | null; render_status: "pending" | "rendering" | "ready" | "failed"; videos: { video_url: string } | null; tags: { id: string; name: string; color: string; start_time: number; end_time: number; player_ids: string[] } | null }>;
};

const inputClass = "mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-textPrimary";

export default function MatchesHubPage() {
  const { t, locale } = useI18n();
  const { activeClubId } = useActiveClub();
  const supabase = createClient();
  const [matches, setMatches] = useState<HubMatch[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [standardTags, setStandardTags] = useState<StandardTag[]>([]);
  const [clips, setClips] = useState<HubClip[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<HubClip | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareDialog, setShareDialog] = useState<{ clipName: string; shareUrl: string; tvUrl?: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [coachName, setCoachName] = useState(() => t("matchHub.defaultCoachName"));
  const [playerShare, setPlayerShare] = useState<{ playerName: string; title: string; text: string } | null>(null);
  const [sharingPlayerId, setSharingPlayerId] = useState("");
  const [accountRole, setAccountRole] = useState<"coach" | "club_admin" | "club_admin_viewer" | "analyst" | "admin_viewer">("coach");
  const [currentUserId, setCurrentUserId] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [teamOptions, setTeamOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [deleteClipTarget, setDeleteClipTarget] = useState<HubClip | null>(null);
  const [deletingClip, setDeletingClip] = useState(false);
  const [deleteMatchTarget, setDeleteMatchTarget] = useState<HubMatch | null>(null);
  const [deletingMatch, setDeletingMatch] = useState(false);
  const [preparationMatch, setPreparationMatch] = useState<HubMatch | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [hasMoreUpcoming, setHasMoreUpcoming] = useState(false);
  const [loadingMoreUpcoming, setLoadingMoreUpcoming] = useState(false);
  const [hasMoreFinished, setHasMoreFinished] = useState(false);
  const [loadingOlderFinished, setLoadingOlderFinished] = useState(false);
  const [canManageMatches, setCanManageMatches] = useState(false);
  const [canPrepareMatches, setCanPrepareMatches] = useState(false);
  const [canCreateTagLink, setCanCreateTagLink] = useState(false);
  const [matchOptionNames, setMatchOptionNames] = useState<Record<string, string>>({});

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const [hubResponse, { data: tagData }] = await Promise.all([
      fetch("/api/matches/hub", { cache: "no-store" }),
      supabase.from("standard_tags").select("*").order("created_at")
    ]);
    const hub = await hubResponse.json();
    if (!hubResponse.ok) { setNotice(hub.error || "Wedstrijden konden niet geladen worden."); return; }
    const matchData = hub.matches as HubMatch[];
    const teamData = hub.teams as Team[];
    const playerData = hub.players as Player[];
    const clipData = hub.clips as HubClip[];
    setMatches((matchData as HubMatch[] | null) ?? []);
    setTeams(teamData ?? []); setPlayers(playerData ?? []); setStandardTags(tagData ?? []);
    setClips(clipData ?? []);
    setHasMoreFinished(hub.hasMoreFinished === true);
    setHasMoreUpcoming(hub.hasMoreUpcoming === true);
    setActiveTeamId(hub.activeTeamId ?? null);
    setTeamOptions(hub.teamOptions ?? []);
    setIsPlatformAdmin(hub.isPlatformAdmin === true);
    setCanManageMatches(hub.canManageMatches === true);
    setCanPrepareMatches(hub.canPrepareMatches === true);
    setCanCreateTagLink(hub.canCreateTagLink === true);
    setMatchOptionNames(Object.fromEntries((hub.matchOptions ?? []).map((option: { id: string; label: string }) => [option.id, option.label])));
    setAccountRole((hub.role as typeof accountRole) ?? "coach");
    if (user) {
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("account_role, full_name").eq("id", user.id).maybeSingle();
      setAccountRole((profile?.account_role as "coach" | "club_admin" | "club_admin_viewer" | "analyst" | "admin_viewer" | undefined) ?? "coach");
      setCoachName(profile?.full_name?.trim() || user.email?.split("@")[0] || t("matchHub.defaultCoachName"));
    }
    setIsAdminViewer(hub.role === "admin_viewer");
  }

  useEffect(() => { void load(); }, [activeClubId]);
  const processingClipIds = clips.filter((clip) => clip.render_status === "rendering").map((clip) => clip.id);
  const processingClipKey = processingClipIds.join(",");
  useEffect(() => {
    if (!processingClipKey) return;
    let stopped = false;
    let timer: number | undefined;
    let attempt = 0;
    let polling = false;
    const delays = [2000, 4000, 8000, 10000];

    const schedule = () => {
      if (stopped) return;
      timer = window.setTimeout(() => void poll(), delays[Math.min(attempt, delays.length - 1)]);
    };
    const poll = async () => {
      if (stopped || polling) return;
      if (document.hidden) { schedule(); return; }
      polling = true;
      try {
        const params = new URLSearchParams();
        for (const id of processingClipIds) params.append("id", id);
        const response = await fetch(`/api/clips/status?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) { attempt += 1; schedule(); return; }
        const body = await response.json() as { clips?: Array<{ id: string; render_status: string; clip_segments: Array<{ id: string; render_status: HubClip["clip_segments"][number]["render_status"] }> }> };
        const statuses = new Map((body.clips ?? []).map((clip) => [clip.id, clip]));
        const completed = processingClipIds.some((id) => statuses.get(id)?.render_status !== "rendering");
        if (completed) { await load(); return; }
        setClips((current) => current.map((clip) => {
          const status = statuses.get(clip.id);
          if (!status) return clip;
          const segmentStatuses = new Map(status.clip_segments.map((segment) => [segment.id, segment.render_status]));
          return { ...clip, clip_segments: clip.clip_segments.map((segment) => ({ ...segment, render_status: segmentStatuses.get(segment.id) ?? segment.render_status })) };
        }));
        attempt += 1;
        schedule();
      } catch {
        attempt += 1;
        schedule();
      } finally {
        polling = false;
      }
    };
    const handleVisibility = () => {
      if (document.hidden || stopped) return;
      if (timer !== undefined) window.clearTimeout(timer);
      attempt = 0;
      void poll();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    schedule();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [processingClipKey]);

  async function loadOlderFinished() {
    setLoadingOlderFinished(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const finishedCount = matches.filter((match) => match.status === "finished" || !!match.match_date && match.match_date < today).length;
      const response = await fetch(`/api/matches/hub?finishedOffset=${finishedCount}`, { cache: "no-store" });
      const hub = await response.json();
      if (!response.ok) { setNotice(hub.error || "Oudere wedstrijden konden niet geladen worden."); return; }
      const incomingMatches = (hub.matches as HubMatch[]).filter((match) => match.status === "finished" || !!match.match_date && match.match_date < today);
      const incomingClips = hub.clips as HubClip[];
      setMatches((current) => [...new Map([...current, ...incomingMatches].map((match) => [match.id, match])).values()]);
      setClips((current) => [...new Map([...current, ...incomingClips].map((clip) => [clip.id, clip])).values()]);
      setHasMoreFinished(hub.hasMoreFinished === true);
    } finally {
      setLoadingOlderFinished(false);
    }
  }

  async function loadMoreUpcoming() {
    setLoadingMoreUpcoming(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const upcomingCount = matches.filter((match) => match.status !== "finished" && (!match.match_date || match.match_date >= today)).length;
      const response = await fetch(`/api/matches/hub?upcomingOffset=${upcomingCount}`, { cache: "no-store" });
      const hub = await response.json();
      if (!response.ok) { setNotice(hub.error || "Volgende wedstrijden konden niet geladen worden."); return; }
      const incomingMatches = (hub.matches as HubMatch[]).filter((match) => match.status !== "finished" && (!match.match_date || match.match_date >= today));
      const incomingClips = hub.clips as HubClip[];
      setMatches((current) => [...new Map([...current, ...incomingMatches].map((match) => [match.id, match])).values()]);
      setClips((current) => [...new Map([...current, ...incomingClips].map((clip) => [clip.id, clip])).values()]);
      setHasMoreUpcoming(hub.hasMoreUpcoming === true);
      setShowAllUpcoming(true);
    } finally {
      setLoadingMoreUpcoming(false);
    }
  }

  const videoToMatch = useMemo(() => {
    const map = new Map<string, string>();
    for (const match of matches) for (const link of match.match_videos ?? []) map.set(link.video_id, match.id);
    return map;
  }, [matches]);
  const clipsByMatch = useMemo(() => {
    const map = new Map<string, HubClip[]>();
    for (const clip of clips) {
      const matchId = videoToMatch.get(clip.video_id);
      if (matchId) map.set(matchId, [...(map.get(matchId) ?? []), clip]);
    }
    return map;
  }, [clips, videoToMatch]);

  function playbackSegments(clip: HubClip): ClipSegmentPlayback[] {
    if (clip.render_status === "ready" && clip.rendered_segments?.length) return clip.rendered_segments.map((segment) => ({
      id: segment.id, name: segment.name, color: segment.color, start_time: segment.play_start ?? 0, end_time: segment.duration, url: segment.url
    }));
    return [...clip.clip_segments].sort((a, b) => a.sequence_order - b.sequence_order).filter((item) => !!item.tags).map((item) => ({
      id: item.id, name: item.tags!.name, color: item.tags!.color, start_time: item.tags!.start_time, end_time: item.tags!.end_time, url: item.videos?.video_url
    }));
  }

  async function createTagLink(match: HubMatch) {
    const response = await fetch(`/api/matches/${match.id}/tag-link`, { method: "POST" });
    const data = await response.json().catch(() => null) as { token?: string; error?: string } | null;
    if (!response.ok || !data?.token) { setNotice(data?.error || t("matchHub.linkFailed")); return; }
    const url = `${window.location.origin}/tag/${data.token}`;
    await navigator.clipboard.writeText(url);
    setNotice(t("matchHub.linkCopied"));
  }

  async function shareClip(clip: HubClip) {
    const existing = clip.share_links?.find((link) => !!link.token && !!link.short_code);
    if (existing) {
      setShareDialog({ clipName: clip.name, shareUrl: buildPublicShareUrl(existing.token), tvUrl: buildTvShareUrl(existing.short_code) });
      return;
    }
    const response = await fetch(`/api/clips/${clip.id}`, { method: "POST" });
    const body = await response.json().catch(() => null) as { shareLink?: { token: string; short_code: string }; error?: string } | null;
    if (!response.ok || !body?.shareLink) {
      setSelectedClip(null);
      setNotice(body?.error || t("share.createFailed"));
      return;
    }
    setClips((current) => current.map((item) => item.id === clip.id ? { ...item, share_links: [body.shareLink!, ...(item.share_links ?? [])] } : item));
    setShareDialog({ clipName: clip.name, shareUrl: buildPublicShareUrl(body.shareLink.token), tvUrl: buildTvShareUrl(body.shareLink.short_code) });
  }

  async function confirmDeleteClip() {
    const clip = deleteClipTarget;
    if (!clip) return;
    setDeletingClip(true);
    const response = await fetch(`/api/clips/${clip.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    setDeletingClip(false);
    setDeleteClipTarget(null);
    if (!response.ok) { setNotice(body?.error || t("matchHub.clipDeleteFailed")); return; }
    if (selectedClip?.id === clip.id) setSelectedClip(null);
    setNotice(t("matchHub.clipDeleted", { name: clip.name }));
    await load();
  }

  async function confirmDeleteMatch() {
    const match = deleteMatchTarget;
    if (!match) return;
    setDeletingMatch(true);
    const response = await fetch(`/api/matches/${match.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    setDeletingMatch(false);
    setDeleteMatchTarget(null);
    if (!response.ok) { setNotice(body?.error || t("matchHub.matchDeleteFailed")); return; }
    setExpandedId(null);
    setNotice(t("matchHub.matchDeleted", { name: `${match.team_a_name} - ${match.team_b_name}` }));
    await load();
  }

  async function sharePlayerClips(match: HubMatch, player: Player, relevantClips: HubClip[]) {
    if (!relevantClips.length) { setNotice(t("matchHub.noClipsToShare", { name: player.first_name })); return; }
    setSharingPlayerId(player.id);
    const uniqueClips = [...new Map(relevantClips.map((clip) => [clip.id, clip])).values()];
    const links: Array<{ clip: HubClip; token: string }> = [];
    for (const clip of uniqueClips) {
      let token = clip.share_links?.[0]?.token;
      if (!token) {
        const response = await fetch(`/api/clips/${clip.id}`, { method: "POST" });
        const body = await response.json().catch(() => null) as { shareLink?: { token: string; short_code: string }; error?: string } | null;
        if (!response.ok || !body?.shareLink) { setSharingPlayerId(""); setNotice(body?.error || t("share.createFailed")); return; }
        token = body.shareLink.token;
        setClips((current) => current.map((item) => item.id === clip.id ? { ...item, share_links: [body.shareLink!] } : item));
      }
      links.push({ clip, token });
    }
    const dateText = match.match_date
      ? t("matchHub.shareDateSuffix", { date: new Date(`${match.match_date}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB") })
      : "";
    const matchName = `${match.team_a_name} - ${match.team_b_name}`;
    const intro = t("matchHub.shareIntro", { coach: coachName, match: matchName, dateSuffix: dateText });
    const linkText = links.map(({ clip, token }, index) => `${index + 1}. ${clip.name}: ${buildPublicShareUrl(token)}`).join("\n");
    setPlayerShare({ playerName: `${player.first_name} ${player.last_name}`, title: t("matchHub.shareTitle", { match: matchName }), text: `${intro}\n\n${linkText}` });
    setSharingPlayerId("");
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = matches.filter((match) => match.status !== "finished" && (!match.match_date || match.match_date >= today))
    .sort((a, b) => `${a.match_date ?? "9999-99-99"}${a.start_time ?? ""}`.localeCompare(`${b.match_date ?? "9999-99-99"}${b.start_time ?? ""}`));
  const finished = matches.filter((match) => !upcoming.includes(match))
    .sort((a, b) => `${b.match_date ?? ""}${b.start_time ?? ""}`.localeCompare(`${a.match_date ?? ""}${a.start_time ?? ""}`));

  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-7">
      <SectionHeader title={t("common.matches")} showHome={false} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <TeamContextHeader teams={teamOptions} activeTeamId={activeTeamId} />
          {canManageMatches && <button type="button" onClick={() => setCreateOpen(true)} className="rounded-xl bg-accent px-5 py-3 font-bold text-page">+ {t("matchHub.new")}</button>}
        </div>
      </div>
      {notice && <button type="button" onClick={() => setNotice("")} className="mb-5 w-full rounded-xl border border-accent/30 bg-accentDim p-3 text-left text-sm text-textPrimary">{notice}</button>}

      <MatchSection title={t("matchHub.upcoming")} matches={showAllUpcoming ? upcoming : upcoming.slice(0, 3)} empty={t("matchHub.noUpcoming")} allowTagging={canCreateTagLink} canPrepare={canPrepareMatches} optionNames={matchOptionNames} canManage={canManageMatches} currentUserId={currentUserId} isPlatformAdmin={isPlatformAdmin} expandedId={expandedId} setExpandedId={setExpandedId} clipsByMatch={clipsByMatch} players={players} sharingPlayerId={sharingPlayerId} onSharePlayer={sharePlayerClips} onPrepare={setPreparationMatch} onDeleteMatch={setDeleteMatchTarget} onDeleteClip={setDeleteClipTarget} onTagLink={createTagLink} onClip={setSelectedClip} />
      {upcoming.length > 3 && <button type="button" onClick={() => setShowAllUpcoming(value => !value)} className="mt-3 rounded-lg border border-borderButton px-4 py-2 text-sm font-semibold text-accent">{showAllUpcoming ? t("matchHub.showFirstThree") : t("matchHub.showAllUpcoming")}</button>}
      {showAllUpcoming && hasMoreUpcoming && <button type="button" disabled={loadingMoreUpcoming} onClick={() => void loadMoreUpcoming()} className="ml-2 mt-3 rounded-lg border border-borderButton px-4 py-2 text-sm font-semibold text-accent disabled:opacity-50">{loadingMoreUpcoming ? "Laden…" : "Meer geplande wedstrijden laden"}</button>}
      <div className="mt-8"><MatchSection title={t("matchHub.finished")} matches={finished} empty={t("matchHub.noFinished")} allowTagging={false} canPrepare={canPrepareMatches} optionNames={matchOptionNames} canManage={canManageMatches} currentUserId={currentUserId} isPlatformAdmin={isPlatformAdmin} expandedId={expandedId} setExpandedId={setExpandedId} clipsByMatch={clipsByMatch} players={players} sharingPlayerId={sharingPlayerId} onSharePlayer={sharePlayerClips} onPrepare={setPreparationMatch} onDeleteMatch={setDeleteMatchTarget} onDeleteClip={setDeleteClipTarget} onTagLink={createTagLink} onClip={setSelectedClip} /></div>
      {hasMoreFinished && <button type="button" disabled={loadingOlderFinished} onClick={() => void loadOlderFinished()} className="mt-3 rounded-lg border border-borderButton px-4 py-2 text-sm font-semibold text-accent disabled:opacity-50">{loadingOlderFinished ? "Laden…" : "Oudere wedstrijden laden"}</button>}

      {createOpen && <MatchEditor match={null} teams={teams} allPlayers={players} standardTags={standardTags} onClose={() => setCreateOpen(false)} onSaved={async () => { setCreateOpen(false); await load(); }} />}
      {selectedClip && <ClipPreviewModal clipName={selectedClip.name} videoUrl={selectedClip.videos?.video_url ?? ""} segments={playbackSegments(selectedClip)} onClose={() => setSelectedClip(null)} onShare={() => void shareClip(selectedClip)} />}
      {shareDialog && <ShareClipDialog clipName={shareDialog.clipName} shareUrl={shareDialog.shareUrl} tvUrl={shareDialog.tvUrl} onClose={() => setShareDialog(null)} />}
      {playerShare && <PlayerClipsShareDialog {...playerShare} onClose={() => setPlayerShare(null)} />}
      {preparationMatch && <MatchPreparationDialog match={preparationMatch} onClose={() => setPreparationMatch(null)} onSaved={load} />}
      <ConfirmDialog open={!!deleteClipTarget} title={t("matchHub.deleteClipTitle")} message={t("matchHub.confirmDeleteClip", { name: deleteClipTarget?.name ?? "" })} busy={deletingClip} onCancel={() => setDeleteClipTarget(null)} onConfirm={() => void confirmDeleteClip()} />
      <ConfirmDialog open={!!deleteMatchTarget} title={t("matchHub.deleteMatchTitle")} message={t("matchHub.confirmDeleteMatch", { name: deleteMatchTarget ? `${deleteMatchTarget.team_a_name} - ${deleteMatchTarget.team_b_name}` : "" })} busy={deletingMatch} onCancel={() => setDeleteMatchTarget(null)} onConfirm={() => void confirmDeleteMatch()} />
    </main>
  );
}

function MatchSection({ title, matches, empty, allowTagging, canPrepare, optionNames, canManage, currentUserId, isPlatformAdmin, expandedId, setExpandedId, clipsByMatch, players, sharingPlayerId, onSharePlayer, onPrepare, onDeleteMatch, onDeleteClip, onTagLink, onClip }: {
  title: string; matches: HubMatch[]; empty: string; allowTagging: boolean; canPrepare: boolean; optionNames: Record<string, string>; canManage: boolean; expandedId: string | null; setExpandedId: (id: string | null) => void;
  currentUserId: string; isPlatformAdmin: boolean; clipsByMatch: Map<string, HubClip[]>; players: Player[]; sharingPlayerId: string; onSharePlayer: (match: HubMatch, player: Player, clips: HubClip[]) => void; onPrepare: (match: HubMatch) => void; onDeleteMatch: (match: HubMatch) => void; onDeleteClip: (clip: HubClip) => void; onTagLink: (match: HubMatch) => void; onClip: (clip: HubClip) => void;
}) {
  const { t } = useI18n();
  return <section><h2 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-textMuted">{title}</h2><div className="space-y-3">{matches.length ? matches.map((match) => {
    const expanded = expandedId === match.id; const matchClips = clipsByMatch.get(match.id) ?? [];
    const lineup = players.filter((player) => (match.player_ids ?? []).includes(player.id));
    const teamClips = matchClips.filter((clip) => clip.audience_type === "full_team");
    // Keep the stored home-away order; is_home_match identifies the club side only.
    const homeTeamName = match.team_a_name;
    const awayTeamName = match.team_b_name;
    const homeTeamLogo = match.team_a_logo;
    const awayTeamLogo = match.team_b_logo;
    const homeScore = match.score_a;
    const awayScore = match.score_b;
    return <article key={match.id} className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 p-3">
        <button type="button" onClick={() => setExpandedId(expanded ? null : match.id)} className="flex min-w-0 flex-1 items-center gap-4 rounded-xl p-1 text-left hover:bg-cardHover">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h3 className="flex min-w-0 items-center gap-1.5 truncate font-bold text-textBright"><ClubLogoImage logo={homeTeamLogo} naam={homeTeamName} purpose="ui" className="shrink-0" /><span className="truncate">{homeTeamName} – {awayTeamName}</span><ClubLogoImage logo={awayTeamLogo} naam={awayTeamName} purpose="ui" className="shrink-0" /></h3><span className="text-sm text-textMuted">{match.match_date || "—"}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}</span>{match.status === "live" && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-300">LIVE</span>}</div></div>
          {homeScore !== null && awayScore !== null && <strong className="rounded-xl bg-cardDeep px-4 py-2 text-xl text-textBright">{homeScore} – {awayScore}</strong>}
        </button>
        <button type="button" onClick={() => onPrepare(match)} title={t("matchPrep.open")} aria-label={t("matchPrep.open")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-borderButton bg-button text-sm font-black text-accent hover:border-accent">i</button>
      </div>
      {expanded && <div className="border-t border-border p-4">
        <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
          <HubInfo label="Afgesproken tijdstip" value={match.meeting_time_enabled ? match.meeting_time?.slice(0, 5) || "Nog niet bepaald" : "Niet ingesteld"} />
          <HubInfo label="Verzamelplaats" value={match.meeting_place_custom || optionNames[match.meeting_place_option_id ?? ""] || "Niet ingesteld"} />
          {match.is_home_match && <HubInfo label="Veld" value={optionNames[match.field_option_id ?? ""] || "Niet ingesteld"} />}
          {match.is_home_match && <HubInfo label="Kleedkamer thuis" value={optionNames[match.locker_room_option_id ?? ""] || "Niet ingesteld"} />}
          {match.is_home_match && <HubInfo label="Kleedkamer bezoekers" value={optionNames[match.visitor_locker_room_option_id ?? ""] || "Niet ingesteld"} />}
          <HubInfo label="Scheidsrechter" value={match.official_referee_name || optionNames[match.referee_option_id ?? ""] || "Aangeduid door KBVB"} />
          {match.official_assistant_referee_1_name && <HubInfo label="Assistent-scheidsrechter 1" value={match.official_assistant_referee_1_name} />}
          {match.official_assistant_referee_2_name && <HubInfo label="Assistent-scheidsrechter 2" value={match.official_assistant_referee_2_name} />}
        </dl>
        {canPrepare && <Link href={`/dashboard/games/${match.id}/preparation`} className="mb-3 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">Wedstrijdvoorbereiding</Link>}
        <div className="mb-5 flex flex-wrap gap-2"><Link href={`/dashboard/games/${match.id}${canManage ? "?edit=1" : ""}`} className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary">{canManage ? "Wedstrijd bewerken" : "Wedstrijdinfo"}</Link>{allowTagging && match.status !== "finished" && <button type="button" onClick={() => void onTagLink(match)} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">{t("matchHub.copyTagLink")}</button>}{match.match_videos?.length ? <Link href={`/dashboard/matches/${match.id}`} className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary">{t("common.videoViewer")}</Link> : canManage ? <Link href="/dashboard/videos" className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary">{t("matchHub.addVideo")}</Link> : null}{(isPlatformAdmin || match.coach_id === currentUserId) && <button type="button" onClick={() => void onDeleteMatch(match)} className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20">{t("matchHub.deleteMatch")}</button>}</div>
        <div className="mb-4 rounded-xl border border-accent/25 bg-accentDim/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-textBright">{t("matchHub.teamClips")}</h4><span className="text-xs text-textMuted">{teamClips.length}</span></div>
          <ClipPills clips={teamClips} onClip={onClip} onDelete={onDeleteClip} canDelete={(clip) => isPlatformAdmin || clip.coach_id === currentUserId} empty={t("matchHub.noTeamClips")} />
        </div>
        <div className="hidden grid-cols-[minmax(190px,1.2fr)_minmax(160px,1fr)_minmax(160px,1fr)_52px] gap-3 px-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-textMuted md:grid">
          <span>{t("matchHub.colPlayer")}</span><span>{t("matchHub.colSelectedClips")}</span><span>{t("matchHub.colTaggedClips")}</span><span className="text-center">{t("matchHub.colShare")}</span>
        </div>
        {lineup.length ? <div className="flex flex-col gap-2">{lineup.map((player) => {
          const selectedClips = matchClips.filter((clip) => clip.audience_type !== "full_team" && clip.audience_player_ids?.includes(player.id));
          const selectedClipIds = new Set(selectedClips.map((clip) => clip.id));
          const taggedClips = matchClips.filter((clip) =>
            clip.audience_type !== "full_team" &&
            !selectedClipIds.has(clip.id) &&
            clip.clip_segments.some((segment) => segment.tags?.player_ids.includes(player.id))
          );
          const playerShareClips = [...teamClips, ...selectedClips, ...taggedClips];
          return <div key={player.id} className="grid gap-3 rounded-xl border border-border bg-cardDeep px-3 py-3 md:grid-cols-[minmax(190px,1.2fr)_minmax(160px,1fr)_minmax(160px,1fr)_52px] md:items-center">
            <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-button text-xs font-bold text-accent">{player.jersey_number ?? player.initials}</span><span className="truncate text-sm text-textPrimary">{player.first_name} {player.last_name}</span></div>
            <div><span className="mb-1 block text-[10px] font-bold uppercase text-textMuted md:hidden">{t("matchHub.colSelectedClips")}</span><ClipPills clips={selectedClips} onClip={onClip} onDelete={onDeleteClip} canDelete={(clip) => isPlatformAdmin || clip.coach_id === currentUserId} /></div>
            <div><span className="mb-1 block text-[10px] font-bold uppercase text-textMuted md:hidden">{t("matchHub.colTaggedClips")}</span><ClipPills clips={taggedClips} onClip={onClip} onDelete={onDeleteClip} canDelete={(clip) => isPlatformAdmin || clip.coach_id === currentUserId} /></div>
            <button type="button" disabled={!playerShareClips.length || sharingPlayerId === player.id} onClick={() => onSharePlayer(match, player, playerShareClips)} title={t("matchHub.shareAllWith", { name: player.first_name })} aria-label={t("matchHub.shareAllWith", { name: player.first_name })} className="grid h-11 w-full place-items-center rounded-xl border border-accent/40 bg-accentDim text-xl text-accent hover:bg-accent hover:text-page disabled:cursor-not-allowed disabled:opacity-30 md:w-11">{sharingPlayerId === player.id ? <span className="text-xs">…</span> : <span aria-hidden="true">↗</span>}</button>
          </div>;
        })}</div> : <p className="text-sm text-textMuted">{t("matchHub.noPlayersAssigned")}</p>}
      </div>}
    </article>;
  }) : <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-textMuted">{empty}</p>}</div></section>;
}

function HubInfo({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-borderSubtle bg-cardDeep p-3"><dt className="text-xs text-textMuted">{label}</dt><dd className="mt-1 font-semibold text-textPrimary">{value}</dd></div>;
}

function ClipPills({ clips, onClip, onDelete, canDelete, empty }: { clips: HubClip[]; onClip: (clip: HubClip) => void; onDelete?: (clip: HubClip) => void; canDelete?: (clip: HubClip) => boolean; empty?: string }) {
  const { t } = useI18n();
  if (!clips.length) return <span className="text-xs text-textMuted">{empty ?? "—"}</span>;
  return <div className="flex flex-wrap gap-1.5">{clips.map((clip, index) => {
    const processing = clip.render_status === "rendering";
    const completedSegments = clip.clip_segments.filter((segment) => segment.render_status === "ready").length;
    const totalSegments = clip.clip_segments.length;
    const progress = totalSegments ? Math.round((completedSegments / totalSegments) * 100) : 0;
    const canSeeViews = clip.share_links?.some((link) => typeof link.view_count === "number");
    const viewCount = clip.share_links?.reduce((sum, link) => sum + (link.view_count ?? 0), 0) ?? 0;
    return <span key={clip.id} className="inline-flex flex-col overflow-hidden rounded-xl border border-accent/40 bg-accentDim">
      <span className="inline-flex">
        <button type="button" disabled={processing} onClick={() => onClip(clip)} title={clip.name} aria-label={`${clip.name} ${t("common.play")}`} className="flex h-8 min-w-10 max-w-44 items-center justify-center gap-1 px-2 text-xs font-bold text-accent hover:bg-accent hover:text-page disabled:cursor-wait disabled:cursor-not-allowed disabled:opacity-70"><span aria-hidden="true">{processing ? "…" : "▶"}</span><span className="truncate">{clip.display_number ?? clip.name}</span></button>
        {onDelete && canDelete?.(clip) && <button type="button" onClick={() => onDelete(clip)} title={`${clip.name} ${t("common.remove")}`} aria-label={`${clip.name} ${t("common.remove")}`} className="grid h-8 w-7 place-items-center border-l border-red-500/30 text-sm text-red-300 hover:bg-red-500/20">×</button>}
      </span>
      {processing && <span className="border-t border-accent/20 px-2 py-1 text-[9px] font-semibold text-textMuted" title={t("clip.estimateHelp")}>
        {t("clip.renderProgress", { completed: completedSegments, total: totalSegments })}
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-button"><span className="block h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} /></span>
      </span>}
      {!processing && canSeeViews && <span className="border-t border-accent/20 px-2 py-1 text-[9px] font-semibold text-textMuted" title="Aantal keer dat een gedeelde clippagina werd geopend">
        Bekeken: {viewCount}×
      </span>}
    </span>;
  })}</div>;
}

function MatchEditor({ match, teams, allPlayers, standardTags, onClose, onSaved }: { match: HubMatch | null; teams: Team[]; allPlayers: Player[]; standardTags: StandardTag[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [teamName, setTeamName] = useState(match?.team_a_name ?? "");
  const [teamId, setTeamId] = useState(match?.team_a_id ?? "");
  const [opponent, setOpponent] = useState(match?.team_b_name ?? "");
  const [date, setDate] = useState(match?.match_date ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(match?.start_time?.slice(0, 5) ?? new Date().toTimeString().slice(0, 5));
  const [status, setStatus] = useState(match?.status ?? "scheduled");
  const [scoreA, setScoreA] = useState(match?.score_a?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match?.score_b?.toString() ?? "");
  const [playerIds, setPlayerIds] = useState<string[]>(match?.player_ids ?? []);
  const [playersOpen, setPlayersOpen] = useState(false);
  const defaultTags = standardTags.filter((tag) => !["Start", "End"].includes(tag.name)).slice(0, 8).map((tag) => tag.name);
  const [tagNames, setTagNames] = useState<string[]>(() => uniqueTagNames(match?.live_tag_names?.length ? match.live_tag_names : defaultTags));
  const [customTagNames, setCustomTagNames] = useState<string[]>(() => uniqueTagNames([
    ...(match?.custom_live_tag_names ?? []),
    ...(match?.live_tag_names ?? []).filter((name) => !standardTags.some((tag) => normalizeTagName(tag.name) === normalizeTagName(name)))
  ]));
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const teamPlayers = allPlayers.filter((player) => player.team_id === teamId);
  const canConfigureTags = status !== "finished" && (!date || date >= new Date().toISOString().slice(0, 10));
  const fixedTags = standardTags.filter((tag, index, items) => {
    const key = normalizeTagName(tag.name);
    return !["start", "end"].includes(key)
      && items.findIndex((item) => normalizeTagName(item.name) === key) === index;
  });
  const tagOptions = uniqueTagNames([...fixedTags.map((tag) => tag.name), ...customTagNames]);

  function addTagName(name: string, rememberForMatch = false) {
    setTagNames((current) => uniqueTagNames([...current, name]));
    if (rememberForMatch && !fixedTags.some((tag) => normalizeTagName(tag.name) === normalizeTagName(name))) {
      setCustomTagNames((current) => uniqueTagNames([...current, name]));
    }
    setNewTagName("");
    setAddingTag(false);
  }

  function commitNewTag() {
    if (newTagName.trim()) addTagName(newTagName, true);
    else setAddingTag(false);
  }

  function handleTeamNameChange(value: string) {
    const matched = teams.find((team) => team.name.trim().toLowerCase() === value.trim().toLowerCase());
    const matchedId = matched?.id ?? "";
    if (matchedId !== teamId) setPlayerIds([]);
    setTeamName(value);
    setTeamId(matchedId);
  }

  async function save() {
    const homeTeamName = teamName.trim();
    if (!homeTeamName || !opponent.trim()) { setError(t("matchHub.required")); return; }
    setSaving(true); setError("");
    const matchedTeam = teams.find((team) => team.id === teamId);
    const payload = { team_a_id: matchedTeam?.id ?? null, team_a_name: matchedTeam?.name ?? homeTeamName, team_b_id: null, team_b_name: opponent.trim(), match_date: date || null, start_time: time || null, status, score_a: scoreA === "" ? null : Number(scoreA), score_b: scoreB === "" ? null : Number(scoreB), player_ids: playerIds, live_tag_names: uniqueTagNames(tagNames), custom_live_tag_names: uniqueTagNames(customTagNames) };
    const response = await fetch("/api/matches", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, id: match?.id })
    });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    setSaving(false); if (!response.ok) { setError(result?.error || "Wedstrijd kon niet worden bewaard."); return; } onSaved();
  }

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-4" onClick={onClose}><div className="my-4 w-full max-w-2xl rounded-2xl border border-border bg-cardAlt p-5" onClick={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold text-textBright">{match ? t("matchHub.edit") : t("matchHub.new")}</h2><p className="text-sm text-textMuted">{t("matchHub.prepare")}</p></div><button type="button" onClick={onClose} className="text-2xl text-textMuted">×</button></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-textSecondary">{t("matchHub.homeTeam")}<input list="match-home-team-options" value={teamName} onChange={(event) => handleTeamNameChange(event.target.value)} placeholder={t("matchHub.homeTeamPlaceholder")} className={inputClass} /><datalist id="match-home-team-options">{teams.map((team) => <option key={team.id} value={team.name} />)}</datalist></label><label className="text-sm text-textSecondary">{t("matchHub.awayTeam")}<input value={opponent} onChange={(event) => setOpponent(event.target.value)} className={inputClass} /></label><label className="text-sm text-textSecondary">{t("matchHub.date")}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} /></label><label className="text-sm text-textSecondary">{t("matchHub.kickoffTime")}<input type="time" value={time} onChange={(event) => setTime(event.target.value)} className={inputClass} /></label><label className="text-sm text-textSecondary">{t("matchHub.status")}<select value={status} onChange={(event) => setStatus(event.target.value as Match["status"])} className={inputClass}><option value="scheduled">{t("matchHub.scheduled")}</option><option value="live">{t("matchHub.live")}</option><option value="finished">{t("matchHub.finishedStatus")}</option></select></label><div className="grid grid-cols-2 gap-2"><label className="text-sm text-textSecondary">{t("matchHub.homeScore")}<input type="number" min="0" value={scoreA} onChange={(event) => setScoreA(event.target.value)} className={inputClass} /></label><label className="text-sm text-textSecondary">{t("matchHub.awayScore")}<input type="number" min="0" value={scoreB} onChange={(event) => setScoreB(event.target.value)} className={inputClass} /></label></div></div>
    <section className="mt-5">
      <button type="button" onClick={() => setPlayersOpen((current) => !current)} className="flex w-full items-center justify-between gap-2 text-left">
        <h3 className="text-sm font-semibold text-textBright">{t("matchHub.participatingPlayers")} <span className="font-normal text-textMuted">({playerIds.length}/{teamPlayers.length})</span></h3>
        <span className={`text-accent transition ${playersOpen ? "rotate-90" : ""}`}>▶</span>
      </button>
      {playersOpen && <div className="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border border-borderSubtle p-2">{teamPlayers.length ? teamPlayers.map((player) => { const selected = playerIds.includes(player.id); return <label key={player.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-textPrimary hover:bg-cardHover"><input type="checkbox" checked={selected} onChange={() => setPlayerIds((current) => selected ? current.filter((id) => id !== player.id) : [...current, player.id])} className="h-4 w-4 accent-accent" />{player.jersey_number ? `${player.jersey_number} · ` : ""}{player.first_name} {player.last_name}</label>; }) : <p className="px-2 py-1.5 text-sm text-textMuted">{t("matchHub.chooseTeamFirst")}</p>}</div>}
    </section>
    {canConfigureTags && <section className="mt-5">
      <h3 className="mb-2 text-sm font-semibold text-textBright">{t("matchHub.liveTagButtons")}</h3>
      <div className="flex flex-wrap items-center gap-2">
        {tagNames.map((name) => (
          <span key={name} className="inline-flex items-center overflow-hidden rounded-lg border border-accent bg-accentDim text-accent">
            <span className="px-3 py-2 text-sm font-semibold">{name}</span>
            <button type="button" onClick={() => setTagNames((current) => current.filter((item) => item !== name))} aria-label={t("matchHub.removeTag", { name })} title={t("matchHub.removeTag", { name })} className="grid h-full w-8 place-items-center border-l border-accent/40 hover:bg-accent hover:text-page">×</button>
          </span>
        ))}
        <button type="button" onClick={() => setAddingTag(true)} aria-label={t("matchHub.addTag")} title={t("matchHub.addTag")} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-borderButton text-lg font-bold text-accent transition hover:border-accent">+</button>
      </div>
      {addingTag && <div
        className="mt-3 rounded-xl border border-borderButton bg-cardDeep p-3"
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) commitNewTag(); }}
      >
        <div className="flex gap-2">
          <input
            autoFocus
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitNewTag(); } if (event.key === "Escape") { setNewTagName(""); setAddingTag(false); } }}
            placeholder={t("matchHub.newTagPlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-accent bg-input px-3 py-2 text-sm text-textPrimary"
          />
          <button type="button" onClick={commitNewTag} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-page">{t("common.add")}</button>
          <button type="button" onClick={() => { setNewTagName(""); setAddingTag(false); }} aria-label={t("common.close")} className="px-2 text-xl text-textMuted hover:text-textPrimary">×</button>
        </div>
        <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-textMuted">{t("matchHub.existingTags")}</p>
        {tagOptions.length
          ? <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">{tagOptions.map((name) => { const selected = tagNames.some((tagName) => normalizeTagName(tagName) === normalizeTagName(name)); return <button key={normalizeTagName(name)} type="button" disabled={selected} onClick={() => addTagName(name)} className="rounded-lg border border-borderButton bg-button px-3 py-2 text-sm text-textPrimary hover:bg-cardHover disabled:cursor-default disabled:border-accent/30 disabled:bg-accentDim disabled:text-accent">{selected ? "✓ " : ""}{name}</button>; })}</div>
          : <p className="text-sm text-textMuted">{t("matchHub.allExistingTagsAdded")}</p>}
      </div>}
      <Link href="/dashboard/settings#quick-tags" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs font-semibold text-accent hover:underline">{t("matchHub.manageTagLibrary")} ↗</Link>
    </section>}
    {error && <p className="mt-4 text-sm text-red-300">{error}</p>}<div className="mt-6 flex gap-3"><button type="button" onClick={onClose} className="flex-1 rounded-xl bg-button py-3 text-textPrimary">{t("common.cancel")}</button><button type="button" disabled={saving} onClick={() => void save()} className="flex-1 rounded-xl bg-accent py-3 font-bold text-page disabled:cursor-not-allowed disabled:opacity-50">{saving ? t("common.saving") : t("common.save")}</button></div>
  </div></div>;
}
