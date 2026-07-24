"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ClipPreviewModal, type ClipSegmentPlayback } from "@/components/clips/ClipPreviewModal";
import { ShareClipDialog } from "@/components/clips/ShareClipDialog";
import { PlayerClipsShareDialog } from "@/components/clips/PlayerClipsShareDialog";
import { buildPublicShareUrl } from "@/lib/share-url";
import { useI18n } from "@/i18n/client";
import type { Match, Player, StandardTag, Team } from "@/types/database";

type HubMatch = Match & { match_videos: { video_id: string }[] };
type HubClip = {
  id: string; coach_id: string; video_id: string; name: string; render_status: string; audience_type: "full_team" | "selected_players" | "specific_players";
  audience_player_ids: string[];
  share_links: Array<{ token: string }>;
  rendered_segments: Array<{ id: string; url: string; name: string; color: string; duration: number; play_start?: number; mobile_compatible?: boolean }>;
  videos: { title: string | null; video_url: string } | null;
  clip_segments: Array<{ sequence_order: number; tags: { id: string; name: string; color: string; start_time: number; end_time: number; player_ids: string[] } | null }>;
};

const inputClass = "mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-textPrimary";

export default function MatchesHubPage() {
  const { t } = useI18n();
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
  const [coachName, setCoachName] = useState("Je trainer");
  const [playerShare, setPlayerShare] = useState<{ playerName: string; title: string; text: string } | null>(null);
  const [sharingPlayerId, setSharingPlayerId] = useState("");
  const [accountRole, setAccountRole] = useState<"coach" | "club_admin" | "analyst">("coach");
  const [currentUserId, setCurrentUserId] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const [{ data: matchData }, { data: teamData }, { data: playerData }, { data: tagData }, { data: clipData }] = await Promise.all([
      supabase.from("matches").select("*, match_videos(video_id)").order("match_date", { ascending: false, nullsFirst: false }).order("start_time", { ascending: false }),
      supabase.from("teams").select("*").not("name", "ilike", "EXTRA").order("name"),
      supabase.from("players").select("*").neq("role", "staff").order("last_name"),
      supabase.from("standard_tags").select("*").order("created_at"),
      supabase.from("clips").select("id, coach_id, video_id, name, render_status, audience_type, audience_player_ids, rendered_segments, share_links(token), videos(title, video_url), clip_segments(sequence_order, tags(id, name, color, start_time, end_time, player_ids))").order("created_at", { ascending: false })
    ]);
    setMatches((matchData as HubMatch[] | null) ?? []);
    setTeams(teamData ?? []); setPlayers(playerData ?? []); setStandardTags(tagData ?? []);
    setClips((clipData as unknown as HubClip[] | null) ?? []);
    if (user) {
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("account_role, full_name").eq("id", user.id).maybeSingle();
      setAccountRole((profile?.account_role as "coach" | "club_admin" | "analyst" | undefined) ?? "coach");
      setCoachName(profile?.full_name?.trim() || user.email?.split("@")[0] || "Je trainer");
    }
    const adminStatus = await fetch("/api/admin/status").then((response) => response.json()).catch(() => ({ isAdmin: false }));
    setIsPlatformAdmin(adminStatus.isAdmin === true);
    if (!expandedId && matchData?.length) setExpandedId(matchData[0].id);
  }

  useEffect(() => { void load(); }, []);
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
    return [...clip.clip_segments].sort((a, b) => a.sequence_order - b.sequence_order).map((item) => item.tags).filter((tag): tag is NonNullable<typeof tag> => !!tag).map((tag) => ({
      id: tag.id, name: tag.name, color: tag.color, start_time: tag.start_time, end_time: tag.end_time
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

  async function deleteClip(clip: HubClip) {
    if (!window.confirm(`Clip "${clip.name}" definitief verwijderen?`)) return;
    const response = await fetch(`/api/clips/${clip.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) { setNotice(body?.error || "De clip kon niet worden verwijderd."); return; }
    if (selectedClip?.id === clip.id) setSelectedClip(null);
    setNotice(`Clip "${clip.name}" is verwijderd.`);
    await load();
  }

  async function deleteMatch(match: HubMatch) {
    if (!window.confirm(`Wedstrijd "${match.team_a_name} - ${match.team_b_name}" en de gekoppelde gegevens definitief verwijderen?`)) return;
    const response = await fetch(`/api/matches/${match.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) { setNotice(body?.error || "De wedstrijd kon niet worden verwijderd."); return; }
    setExpandedId(null);
    setNotice(`Wedstrijd "${match.team_a_name} - ${match.team_b_name}" is verwijderd.`);
    await load();
  }

  async function sharePlayerClips(match: HubMatch, player: Player, relevantClips: HubClip[]) {
    if (!relevantClips.length) { setNotice(`Er zijn nog geen clips om met ${player.first_name} te delen.`); return; }
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
      ? ` op ${new Date(`${match.match_date}T12:00:00`).toLocaleDateString("nl-BE")}`
      : "";
    const intro = `Trainer ${coachName} heeft deze clips met je gedeeld van de wedstrijd ${match.team_a_name} - ${match.team_b_name}${dateText}.`;
    const linkText = links.map(({ clip, token }, index) => `${index + 1}. ${clip.name}: ${buildPublicShareUrl(token)}`).join("\n");
    setPlayerShare({ playerName: `${player.first_name} ${player.last_name}`, title: `Clips van ${match.team_a_name} - ${match.team_b_name}`, text: `${intro}\n\n${linkText}` });
    setSharingPlayerId("");
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = matches.filter((match) => match.status !== "finished" && (!match.match_date || match.match_date >= today));
  const finished = matches.filter((match) => !upcoming.includes(match));
  const canManageMatches = accountRole !== "analyst";

  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-7">
      <SectionHeader title={t("common.matches")} artworkSrc="/branding/clips.png" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div><h2 className="font-semibold text-textBright">{t("matchHub.title")}</h2><p className="text-sm text-textMuted">{t("matchHub.subtitle")}</p></div>
        {canManageMatches && <button type="button" onClick={() => setCreateOpen(true)} className="rounded-xl bg-accent px-5 py-3 font-bold text-page">+ {t("matchHub.new")}</button>}
      </div>
      {notice && <button type="button" onClick={() => setNotice("")} className="mb-5 w-full rounded-xl border border-accent/30 bg-accentDim p-3 text-left text-sm text-textPrimary">{notice}</button>}

      <MatchSection title={t("matchHub.upcoming")} matches={upcoming} empty={t("matchHub.noUpcoming")} allowTagging={canManageMatches} canManage={canManageMatches} currentUserId={currentUserId} isPlatformAdmin={isPlatformAdmin} expandedId={expandedId} setExpandedId={setExpandedId} clipsByMatch={clipsByMatch} players={players} sharingPlayerId={sharingPlayerId} onSharePlayer={sharePlayerClips} onEdit={setEditingMatch} onDeleteMatch={deleteMatch} onDeleteClip={deleteClip} onTagLink={createTagLink} onClip={setSelectedClip} />
      <div className="mt-8"><MatchSection title={t("matchHub.finished")} matches={finished} empty={t("matchHub.noFinished")} allowTagging={false} canManage={canManageMatches} currentUserId={currentUserId} isPlatformAdmin={isPlatformAdmin} expandedId={expandedId} setExpandedId={setExpandedId} clipsByMatch={clipsByMatch} players={players} sharingPlayerId={sharingPlayerId} onSharePlayer={sharePlayerClips} onEdit={setEditingMatch} onDeleteMatch={deleteMatch} onDeleteClip={deleteClip} onTagLink={createTagLink} onClip={setSelectedClip} /></div>

      {(createOpen || editingMatch) && <MatchEditor match={editingMatch} teams={teams} allPlayers={players} standardTags={standardTags} onClose={() => { setCreateOpen(false); setEditingMatch(null); }} onSaved={async () => { setCreateOpen(false); setEditingMatch(null); await load(); }} />}
      {selectedClip && <ClipPreviewModal clipName={selectedClip.name} videoUrl={selectedClip.videos?.video_url ?? ""} segments={playbackSegments(selectedClip)} onClose={() => setSelectedClip(null)} onShare={() => void shareClip(selectedClip)} />}
      {shareDialog && <ShareClipDialog clipName={shareDialog.clipName} shareUrl={shareDialog.shareUrl} onClose={() => setShareDialog(null)} />}
      {playerShare && <PlayerClipsShareDialog {...playerShare} onClose={() => setPlayerShare(null)} />}
    </main>
  );
}

function MatchSection({ title, matches, empty, allowTagging, canManage, currentUserId, isPlatformAdmin, expandedId, setExpandedId, clipsByMatch, players, sharingPlayerId, onSharePlayer, onEdit, onDeleteMatch, onDeleteClip, onTagLink, onClip }: {
  title: string; matches: HubMatch[]; empty: string; allowTagging: boolean; canManage: boolean; expandedId: string | null; setExpandedId: (id: string | null) => void;
  currentUserId: string; isPlatformAdmin: boolean; clipsByMatch: Map<string, HubClip[]>; players: Player[]; sharingPlayerId: string; onSharePlayer: (match: HubMatch, player: Player, clips: HubClip[]) => void; onEdit: (match: HubMatch) => void; onDeleteMatch: (match: HubMatch) => void; onDeleteClip: (clip: HubClip) => void; onTagLink: (match: HubMatch) => void; onClip: (clip: HubClip) => void;
}) {
  return <section><h2 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-textMuted">{title}</h2><div className="space-y-3">{matches.length ? matches.map((match) => {
    const expanded = expandedId === match.id; const matchClips = clipsByMatch.get(match.id) ?? [];
    const lineup = players.filter((player) => (match.player_ids ?? []).includes(player.id));
    const teamClips = matchClips.filter((clip) => clip.audience_type === "full_team");
    return <article key={match.id} className="overflow-hidden rounded-2xl border border-border bg-card">
      <button type="button" onClick={() => setExpandedId(expanded ? null : match.id)} className="flex w-full items-center gap-4 p-4 text-left hover:bg-cardHover">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold text-textBright">{match.team_a_name} – {match.team_b_name}</h3>{match.status === "live" && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-300">LIVE</span>}</div><p className="mt-1 text-sm text-textMuted">{match.match_date || "—"}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""} · {lineup.length} spelers · {matchClips.length} clips</p></div>
        {match.score_a !== null && match.score_b !== null && <strong className="rounded-xl bg-cardDeep px-4 py-2 text-xl text-textBright">{match.score_a} – {match.score_b}</strong>}<span className={`text-accent transition ${expanded ? "rotate-90" : ""}`}>▶</span>
      </button>
      {expanded && <div className="border-t border-border p-4">
        <div className="mb-5 flex flex-wrap gap-2">{allowTagging && match.status !== "finished" && <button type="button" onClick={() => void onTagLink(match)} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">Taglink kopiëren</button>}{canManage && <button type="button" onClick={() => onEdit(match)} className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary">Wedstrijd bewerken</button>}{match.match_videos?.length ? <Link href={`/dashboard/matches/${match.id}`} className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary">Video Viewer</Link> : canManage ? <Link href="/dashboard/videos" className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary">Video toevoegen</Link> : null}{(isPlatformAdmin || match.coach_id === currentUserId) && <button type="button" onClick={() => void onDeleteMatch(match)} className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20">Wedstrijd verwijderen</button>}</div>
        <div className="mb-4 rounded-xl border border-accent/25 bg-accentDim/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-textBright">Clips voor de volledige ploeg</h4><span className="text-xs text-textMuted">{teamClips.length}</span></div>
          <ClipPills clips={teamClips} onClip={onClip} onDelete={onDeleteClip} canDelete={(clip) => isPlatformAdmin || clip.coach_id === currentUserId} empty="Nog geen ploegclips" />
        </div>
        <div className="hidden grid-cols-[minmax(190px,1.2fr)_minmax(160px,1fr)_minmax(160px,1fr)_52px] gap-3 px-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-textMuted md:grid">
          <span>Speler</span><span>Geselecteerde clips</span><span>Individueel getagd</span><span className="text-center">Deel</span>
        </div>
        {lineup.length ? <div className="flex flex-col gap-2">{lineup.map((player) => {
          const selectedClips = matchClips.filter((clip) => clip.audience_type !== "full_team" && clip.audience_player_ids?.includes(player.id));
          const taggedClips = matchClips.filter((clip) => clip.clip_segments.some((segment) => segment.tags?.player_ids.includes(player.id)));
          const playerShareClips = [...teamClips, ...selectedClips, ...taggedClips];
          return <div key={player.id} className="grid gap-3 rounded-xl border border-border bg-cardDeep px-3 py-3 md:grid-cols-[minmax(190px,1.2fr)_minmax(160px,1fr)_minmax(160px,1fr)_52px] md:items-center">
            <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-button text-xs font-bold text-accent">{player.jersey_number ?? player.initials}</span><span className="truncate text-sm text-textPrimary">{player.first_name} {player.last_name}</span></div>
            <div><span className="mb-1 block text-[10px] font-bold uppercase text-textMuted md:hidden">Geselecteerd</span><ClipPills clips={selectedClips} onClip={onClip} onDelete={onDeleteClip} canDelete={(clip) => isPlatformAdmin || clip.coach_id === currentUserId} /></div>
            <div><span className="mb-1 block text-[10px] font-bold uppercase text-textMuted md:hidden">Individueel getagd</span><ClipPills clips={taggedClips} onClip={onClip} onDelete={onDeleteClip} canDelete={(clip) => isPlatformAdmin || clip.coach_id === currentUserId} /></div>
            <button type="button" disabled={!playerShareClips.length || sharingPlayerId === player.id} onClick={() => onSharePlayer(match, player, playerShareClips)} title={`Alle clips delen met ${player.first_name}`} aria-label={`Alle clips delen met ${player.first_name}`} className="grid h-11 w-full place-items-center rounded-xl border border-accent/40 bg-accentDim text-xl text-accent hover:bg-accent hover:text-page disabled:cursor-not-allowed disabled:opacity-30 md:w-11">{sharingPlayerId === player.id ? <span className="text-xs">…</span> : <span aria-hidden="true">↗</span>}</button>
          </div>;
        })}</div> : <p className="text-sm text-textMuted">Nog geen spelers aangeduid.</p>}
      </div>}
    </article>;
  }) : <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-textMuted">{empty}</p>}</div></section>;
}

function ClipPills({ clips, onClip, onDelete, canDelete, empty }: { clips: HubClip[]; onClip: (clip: HubClip) => void; onDelete?: (clip: HubClip) => void; canDelete?: (clip: HubClip) => boolean; empty?: string }) {
  if (!clips.length) return <span className="text-xs text-textMuted">{empty ?? "—"}</span>;
  return <div className="flex flex-wrap gap-1.5">{clips.map((clip, index) => <span key={clip.id} className="inline-flex items-center overflow-hidden rounded-full border border-accent/40 bg-accentDim"><button type="button" disabled={clip.render_status === "rendering"} onClick={() => onClip(clip)} title={clip.name} aria-label={`${clip.name} afspelen`} className="flex h-8 min-w-10 items-center justify-center gap-1 px-2 text-xs font-bold text-accent hover:bg-accent hover:text-page disabled:cursor-wait disabled:opacity-50"><span aria-hidden="true">▶</span><span>{index + 1}</span></button>{onDelete && canDelete?.(clip) && <button type="button" onClick={() => onDelete(clip)} title={`${clip.name} verwijderen`} aria-label={`${clip.name} verwijderen`} className="grid h-8 w-7 place-items-center border-l border-red-500/30 text-sm text-red-300 hover:bg-red-500/20">×</button>}</span>)}</div>;
}

function MatchEditor({ match, teams, allPlayers, standardTags, onClose, onSaved }: { match: HubMatch | null; teams: Team[]; allPlayers: Player[]; standardTags: StandardTag[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n(); const supabase = createClient();
  const [teamId, setTeamId] = useState(match?.team_a_id ?? "");
  const [opponent, setOpponent] = useState(match?.team_b_name ?? "");
  const [date, setDate] = useState(match?.match_date ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(match?.start_time?.slice(0, 5) ?? new Date().toTimeString().slice(0, 5));
  const [status, setStatus] = useState(match?.status ?? "scheduled");
  const [scoreA, setScoreA] = useState(match?.score_a?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match?.score_b?.toString() ?? "");
  const [playerIds, setPlayerIds] = useState<string[]>(match?.player_ids ?? []);
  const defaultTags = standardTags.filter((tag) => !["Start", "End"].includes(tag.name)).slice(0, 8).map((tag) => tag.name);
  const [tagNames, setTagNames] = useState<string[]>(match?.live_tag_names?.length ? match.live_tag_names : defaultTags);
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const teamPlayers = allPlayers.filter((player) => player.team_id === teamId);
  const canConfigureTags = status !== "finished" && (!date || date >= new Date().toISOString().slice(0, 10));

  async function save() {
    const team = teams.find((item) => item.id === teamId);
    if (!team || !opponent.trim()) { setError(t("matchHub.required")); return; }
    setSaving(true); setError("");
    const payload = { team_a_id: team.id, team_a_name: team.name, team_b_id: null, team_b_name: opponent.trim(), match_date: date || null, start_time: time || null, status, score_a: scoreA === "" ? null : Number(scoreA), score_b: scoreB === "" ? null : Number(scoreB), player_ids: playerIds, live_tag_names: tagNames };
    let result = match ? await supabase.from("matches").update(payload).eq("id", match.id) : await supabase.from("matches").insert(payload);
    if (result.error?.message.includes("schema cache")) {
      const legacyPayload = { team_a_id: team.id, team_a_name: team.name, team_b_id: null, team_b_name: opponent.trim(), match_date: date || null, start_time: time || null };
      result = match ? await supabase.from("matches").update(legacyPayload).eq("id", match.id) : await supabase.from("matches").insert(legacyPayload);
    }
    if (!result.error && match && status === "finished") {
      await supabase.from("match_tag_links").update({ active: false }).eq("match_id", match.id);
    }
    setSaving(false); if (result.error) { setError(result.error.message); return; } onSaved();
  }

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-4" onClick={onClose}><div className="my-4 w-full max-w-2xl rounded-2xl border border-border bg-cardAlt p-5" onClick={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold text-textBright">{match ? t("matchHub.edit") : t("matchHub.new")}</h2><p className="text-sm text-textMuted">{t("matchHub.prepare")}</p></div><button type="button" onClick={onClose} className="text-2xl text-textMuted">×</button></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-textSecondary">Eigen team<select value={teamId} onChange={(event) => { setTeamId(event.target.value); setPlayerIds([]); }} className={inputClass}><option value="">Selecteer team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label className="text-sm text-textSecondary">Tegenstander<input value={opponent} onChange={(event) => setOpponent(event.target.value)} className={inputClass} /></label><label className="text-sm text-textSecondary">Datum<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} /></label><label className="text-sm text-textSecondary">Aanvangsuur<input type="time" value={time} onChange={(event) => setTime(event.target.value)} className={inputClass} /></label><label className="text-sm text-textSecondary">Status<select value={status} onChange={(event) => setStatus(event.target.value as Match["status"])} className={inputClass}><option value="scheduled">Gepland</option><option value="live">Live</option><option value="finished">Afgewerkt</option></select></label><div className="grid grid-cols-2 gap-2"><label className="text-sm text-textSecondary">Score thuis<input type="number" min="0" value={scoreA} onChange={(event) => setScoreA(event.target.value)} className={inputClass} /></label><label className="text-sm text-textSecondary">Score uit<input type="number" min="0" value={scoreB} onChange={(event) => setScoreB(event.target.value)} className={inputClass} /></label></div></div>
    <section className="mt-5"><h3 className="mb-2 text-sm font-semibold text-textBright">Spelers die deelnemen</h3><div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">{teamPlayers.map((player) => { const selected = playerIds.includes(player.id); return <button key={player.id} type="button" onClick={() => setPlayerIds((current) => selected ? current.filter((id) => id !== player.id) : [...current, player.id])} className={`rounded-full border px-3 py-2 text-sm ${selected ? "border-accent bg-accentDim text-accent" : "border-borderButton bg-button text-textPrimary"}`}>{player.jersey_number ? `${player.jersey_number} · ` : ""}{player.first_name} {player.last_name}</button>; })}</div></section>
    {canConfigureTags && <section className="mt-5"><h3 className="mb-2 text-sm font-semibold text-textBright">Tagknoppen voor deze wedstrijd</h3><div className="flex flex-wrap gap-2">{standardTags.filter((tag) => !["Start", "End"].includes(tag.name)).map((tag) => { const selected = tagNames.includes(tag.name); return <button key={tag.id} type="button" onClick={() => setTagNames((current) => selected ? current.filter((name) => name !== tag.name) : [...current, tag.name])} className={`rounded-lg border px-3 py-2 text-sm ${selected ? "border-accent bg-accentDim text-accent" : "border-borderButton bg-button text-textPrimary"}`}>{tag.name}</button>; })}</div></section>}
    {error && <p className="mt-4 text-sm text-red-300">{error}</p>}<div className="mt-6 flex gap-3"><button type="button" onClick={onClose} className="flex-1 rounded-xl bg-button py-3 text-textPrimary">{t("common.cancel")}</button><button type="button" disabled={saving} onClick={() => void save()} className="flex-1 rounded-xl bg-accent py-3 font-bold text-page disabled:opacity-50">{saving ? t("common.saving") : t("common.save")}</button></div>
  </div></div>;
}
