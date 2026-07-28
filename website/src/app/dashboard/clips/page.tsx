"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ClipPreviewModal, type ClipSegmentPlayback } from "@/components/clips/ClipPreviewModal";
import { ShareClipDialog } from "@/components/clips/ShareClipDialog";
import { PlayerClipsShareDialog } from "@/components/clips/PlayerClipsShareDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { buildPublicShareUrl } from "@/lib/share-url";
import { useI18n } from "@/i18n/client";
import type { Match, Player, StandardTag, Team } from "@/types/database";
import { useActiveClub } from "@/components/clubs/ActiveClubProvider";

type HubMatch = Match & { match_videos: { video_id: string }[] };
type HubClip = {
  id: string; coach_id: string; video_id: string; name: string; render_status: string; created_at: string; audience_type: "full_team" | "selected_players" | "specific_players";
  audience_player_ids: string[];
  share_links: Array<{ token: string; view_count?: number }>;
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
  const [editingMatch, setEditingMatch] = useState<HubMatch | null>(null);
  const [shareDialog, setShareDialog] = useState<{ clipName: string; shareUrl: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [coachName, setCoachName] = useState(() => t("matchHub.defaultCoachName"));
  const [playerShare, setPlayerShare] = useState<{ playerName: string; title: string; text: string } | null>(null);
  const [sharingPlayerId, setSharingPlayerId] = useState("");
  const [accountRole, setAccountRole] = useState<"coach" | "club_admin" | "club_admin_viewer" | "analyst" | "admin_viewer">("coach");
  const [currentUserId, setCurrentUserId] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teamFilterOpen, setTeamFilterOpen] = useState(false);
  const [deleteClipTarget, setDeleteClipTarget] = useState<HubClip | null>(null);
  const [deletingClip, setDeletingClip] = useState(false);
  const [deleteMatchTarget, setDeleteMatchTarget] = useState<HubMatch | null>(null);
  const [deletingMatch, setDeletingMatch] = useState(false);

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
    setIsPlatformAdmin(hub.isPlatformAdmin === true);
    setAccountRole((hub.role as typeof accountRole) ?? "coach");
    if (user) {
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("account_role, full_name").eq("id", user.id).maybeSingle();
      setAccountRole((profile?.account_role as "coach" | "club_admin" | "club_admin_viewer" | "analyst" | "admin_viewer" | undefined) ?? "coach");
      setCoachName(profile?.full_name?.trim() || user.email?.split("@")[0] || t("matchHub.defaultCoachName"));
    }
    setIsAdminViewer(hub.role === "admin_viewer");
    if (!expandedId && matchData?.length) setExpandedId(matchData[0].id);
  }

  useEffect(() => { void load(); }, [activeClubId]);
  const hasProcessingClips = clips.some((clip) => clip.render_status === "rendering");
  useEffect(() => {
    if (!hasProcessingClips) return;
    const refreshTimer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(refreshTimer);
  }, [hasProcessingClips]);

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
    const { data, error } = await supabase.from("share_links").insert({ clip_id: clip.id }).select().single();
    if (error || !data) { setNotice(error?.message || t("share.createFailed")); return; }
    setShareDialog({ clipName: clip.name, shareUrl: buildPublicShareUrl(data.token) });
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
        const { data, error } = await supabase.from("share_links").insert({ clip_id: clip.id }).select("token").single();
        if (error || !data) { setSharingPlayerId(""); setNotice(error?.message || t("share.createFailed")); return; }
        token = data.token;
        setClips((current) => current.map((item) => item.id === clip.id ? { ...item, share_links: [{ token: data.token }] } : item));
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
  const canFilterByTeam = accountRole === "club_admin" || accountRole === "club_admin_viewer" || isPlatformAdmin || isAdminViewer;
  const teamFiltered = canFilterByTeam && selectedTeamIds.length ? matches.filter((match) => match.team_a_id && selectedTeamIds.includes(match.team_a_id)) : matches;
  const upcoming = teamFiltered.filter((match) => match.status !== "finished" && (!match.match_date || match.match_date >= today));
  const finished = teamFiltered.filter((match) => !upcoming.includes(match));
  const canManageMatches = !["analyst", "club_admin_viewer", "admin_viewer"].includes(accountRole);
  const teamFilterLabel = selectedTeamIds.length ? teams.filter((team) => selectedTeamIds.includes(team.id)).map((team) => team.name).join(", ") : t("matchHub.allTeams");

  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-7">
      <SectionHeader title={t("common.matches")} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div><h2 className="font-semibold text-textBright">{t("matchHub.title")}</h2><p className="text-sm text-textMuted">{t("matchHub.subtitle")}</p></div>
        <div className="flex flex-wrap items-center gap-3">
          {canFilterByTeam && (
            <div className="relative">
              <button type="button" onClick={() => setTeamFilterOpen((current) => !current)} className="flex items-center gap-2 rounded-xl border border-borderButton bg-button px-4 py-3 text-sm font-semibold text-textPrimary hover:border-accent">
                {teamFilterLabel}<span className={`text-accent transition ${teamFilterOpen ? "rotate-90" : ""}`}>▶</span>
              </button>
              {teamFilterOpen && <div className="absolute right-0 z-20 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-border bg-cardAlt p-2 shadow-lg">
                <button type="button" onClick={() => setSelectedTeamIds([])} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold hover:bg-cardHover ${selectedTeamIds.length === 0 ? "text-accent" : "text-textPrimary"}`}>{selectedTeamIds.length === 0 ? "✓" : <span className="w-3.5" />} {t("matchHub.allTeams")}</button>
                <div className="my-1 border-t border-borderSubtle" />
                {teams.map((team) => { const selected = selectedTeamIds.includes(team.id); return <label key={team.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-textPrimary hover:bg-cardHover"><input type="checkbox" checked={selected} onChange={() => setSelectedTeamIds((current) => selected ? current.filter((id) => id !== team.id) : [...current, team.id])} className="h-4 w-4 accent-accent" />{team.name}</label>; })}
              </div>}
            </div>
          )}
          {canManageMatches && <button type="button" onClick={() => setCreateOpen(true)} className="rounded-xl bg-accent px-5 py-3 font-bold text-page">+ {t("matchHub.new")}</button>}
        </div>
      </div>
      {notice && <button type="button" onClick={() => setNotice("")} className="mb-5 w-full rounded-xl border border-accent/30 bg-accentDim p-3 text-left text-sm text-textPrimary">{notice}</button>}

      <MatchSection title={t("matchHub.upcoming")} matches={upcoming} empty={t("matchHub.noUpcoming")} allowTagging={canManageMatches} canManage={canManageMatches} currentUserId={currentUserId} isPlatformAdmin={isPlatformAdmin} expandedId={expandedId} setExpandedId={setExpandedId} clipsByMatch={clipsByMatch} players={players} sharingPlayerId={sharingPlayerId} onSharePlayer={sharePlayerClips} onEdit={setEditingMatch} onDeleteMatch={setDeleteMatchTarget} onDeleteClip={setDeleteClipTarget} onTagLink={createTagLink} onClip={setSelectedClip} />
      <div className="mt-8"><MatchSection title={t("matchHub.finished")} matches={finished} empty={t("matchHub.noFinished")} allowTagging={false} canManage={canManageMatches} currentUserId={currentUserId} isPlatformAdmin={isPlatformAdmin} expandedId={expandedId} setExpandedId={setExpandedId} clipsByMatch={clipsByMatch} players={players} sharingPlayerId={sharingPlayerId} onSharePlayer={sharePlayerClips} onEdit={setEditingMatch} onDeleteMatch={setDeleteMatchTarget} onDeleteClip={setDeleteClipTarget} onTagLink={createTagLink} onClip={setSelectedClip} /></div>

      {(createOpen || editingMatch) && <MatchEditor match={editingMatch} teams={teams} allPlayers={players} standardTags={standardTags} onClose={() => { setCreateOpen(false); setEditingMatch(null); }} onSaved={async () => { setCreateOpen(false); setEditingMatch(null); await load(); }} />}
      {selectedClip && <ClipPreviewModal clipName={selectedClip.name} videoUrl={selectedClip.videos?.video_url ?? ""} segments={playbackSegments(selectedClip)} onClose={() => setSelectedClip(null)} onShare={() => void shareClip(selectedClip)} />}
      {shareDialog && <ShareClipDialog clipName={shareDialog.clipName} shareUrl={shareDialog.shareUrl} onClose={() => setShareDialog(null)} />}
      {playerShare && <PlayerClipsShareDialog {...playerShare} onClose={() => setPlayerShare(null)} />}
      <ConfirmDialog open={!!deleteClipTarget} title={t("matchHub.deleteClipTitle")} message={t("matchHub.confirmDeleteClip", { name: deleteClipTarget?.name ?? "" })} busy={deletingClip} onCancel={() => setDeleteClipTarget(null)} onConfirm={() => void confirmDeleteClip()} />
      <ConfirmDialog open={!!deleteMatchTarget} title={t("matchHub.deleteMatchTitle")} message={t("matchHub.confirmDeleteMatch", { name: deleteMatchTarget ? `${deleteMatchTarget.team_a_name} - ${deleteMatchTarget.team_b_name}` : "" })} busy={deletingMatch} onCancel={() => setDeleteMatchTarget(null)} onConfirm={() => void confirmDeleteMatch()} />
    </main>
  );
}

function MatchSection({ title, matches, empty, allowTagging, canManage, currentUserId, isPlatformAdmin, expandedId, setExpandedId, clipsByMatch, players, sharingPlayerId, onSharePlayer, onEdit, onDeleteMatch, onDeleteClip, onTagLink, onClip }: {
  title: string; matches: HubMatch[]; empty: string; allowTagging: boolean; canManage: boolean; expandedId: string | null; setExpandedId: (id: string | null) => void;
  currentUserId: string; isPlatformAdmin: boolean; clipsByMatch: Map<string, HubClip[]>; players: Player[]; sharingPlayerId: string; onSharePlayer: (match: HubMatch, player: Player, clips: HubClip[]) => void; onEdit: (match: HubMatch) => void; onDeleteMatch: (match: HubMatch) => void; onDeleteClip: (clip: HubClip) => void; onTagLink: (match: HubMatch) => void; onClip: (clip: HubClip) => void;
}) {
  const { t } = useI18n();
  return <section><h2 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-textMuted">{title}</h2><div className="space-y-3">{matches.length ? matches.map((match) => {
    const expanded = expandedId === match.id; const matchClips = clipsByMatch.get(match.id) ?? [];
    const lineup = players.filter((player) => (match.player_ids ?? []).includes(player.id));
    const teamClips = matchClips.filter((clip) => clip.audience_type === "full_team");
    return <article key={match.id} className="overflow-hidden rounded-2xl border border-border bg-card">
      <button type="button" onClick={() => setExpandedId(expanded ? null : match.id)} className="flex w-full items-center gap-4 p-4 text-left hover:bg-cardHover">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold text-textBright">{match.team_a_name} – {match.team_b_name}</h3>{match.status === "live" && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-300">LIVE</span>}</div><p className="mt-1 text-sm text-textMuted">{match.match_date || "—"}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""} · {t("matchHub.lineupCount", { count: lineup.length })} · {matchClips.length} {t("common.clips")}</p></div>
        {match.score_a !== null && match.score_b !== null && <strong className="rounded-xl bg-cardDeep px-4 py-2 text-xl text-textBright">{match.score_a} – {match.score_b}</strong>}<span className={`text-accent transition ${expanded ? "rotate-90" : ""}`}>▶</span>
      </button>
      {expanded && <div className="border-t border-border p-4">
        <div className="mb-5 flex flex-wrap gap-2">{allowTagging && match.status !== "finished" && <button type="button" onClick={() => void onTagLink(match)} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">{t("matchHub.copyTagLink")}</button>}{canManage && <button type="button" onClick={() => onEdit(match)} className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary">{t("matchHub.edit")}</button>}{match.match_videos?.length ? <Link href={`/dashboard/matches/${match.id}`} className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary">{t("common.videoViewer")}</Link> : canManage ? <Link href="/dashboard/videos" className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary">{t("matchHub.addVideo")}</Link> : null}{(isPlatformAdmin || match.coach_id === currentUserId) && <button type="button" onClick={() => void onDeleteMatch(match)} className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20">{t("matchHub.deleteMatch")}</button>}</div>
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
        <button type="button" disabled={processing} onClick={() => onClip(clip)} title={clip.name} aria-label={`${clip.name} ${t("common.play")}`} className="flex h-8 min-w-10 items-center justify-center gap-1 px-2 text-xs font-bold text-accent hover:bg-accent hover:text-page disabled:cursor-wait disabled:opacity-70"><span aria-hidden="true">{processing ? "…" : "▶"}</span><span>{index + 1}</span></button>
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
  const [tagNames, setTagNames] = useState<string[]>(match?.live_tag_names?.length ? match.live_tag_names : defaultTags);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const teamPlayers = allPlayers.filter((player) => player.team_id === teamId);
  const canConfigureTags = status !== "finished" && (!date || date >= new Date().toISOString().slice(0, 10));
  const suggestedTags = standardTags.filter((tag) => !["Start", "End"].includes(tag.name) && !tagNames.includes(tag.name));

  function commitNewTag() {
    const trimmed = newTagName.trim();
    if (trimmed && !tagNames.includes(trimmed)) setTagNames((current) => [...current, trimmed]);
    setNewTagName("");
    setAddingTag(false);
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
    const payload = { team_a_id: matchedTeam?.id ?? null, team_a_name: matchedTeam?.name ?? homeTeamName, team_b_id: null, team_b_name: opponent.trim(), match_date: date || null, start_time: time || null, status, score_a: scoreA === "" ? null : Number(scoreA), score_b: scoreB === "" ? null : Number(scoreB), player_ids: playerIds, live_tag_names: tagNames };
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
        {addingTag ? (
          <input
            autoFocus
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitNewTag(); } if (event.key === "Escape") { setNewTagName(""); setAddingTag(false); } }}
            onBlur={commitNewTag}
            placeholder={t("matchHub.newTagPlaceholder")}
            className="w-32 rounded-lg border border-accent bg-input px-3 py-2 text-sm text-textPrimary"
          />
        ) : (
          <button type="button" onClick={() => setAddingTag(true)} aria-label={t("matchHub.addTag")} title={t("matchHub.addTag")} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-borderButton text-lg font-bold text-accent transition hover:border-accent">+</button>
        )}
      </div>
      {!!suggestedTags.length && <div className="mt-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-textMuted">{t("matchHub.suggestions")}</p>
        <div className="flex flex-wrap gap-2">{suggestedTags.map((tag) => <button key={tag.id} type="button" onClick={() => setTagNames((current) => [...current, tag.name])} className="rounded-lg border border-borderButton bg-button px-3 py-2 text-sm text-textPrimary hover:bg-cardHover">{tag.name}</button>)}</div>
      </div>}
      <Link href="/dashboard/settings#quick-tags" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs font-semibold text-accent hover:underline">{t("matchHub.manageTagLibrary")} ↗</Link>
    </section>}
    {error && <p className="mt-4 text-sm text-red-300">{error}</p>}<div className="mt-6 flex gap-3"><button type="button" onClick={onClose} className="flex-1 rounded-xl bg-button py-3 text-textPrimary">{t("common.cancel")}</button><button type="button" disabled={saving} onClick={() => void save()} className="flex-1 rounded-xl bg-accent py-3 font-bold text-page disabled:opacity-50">{saving ? t("common.saving") : t("common.save")}</button></div>
  </div></div>;
}
