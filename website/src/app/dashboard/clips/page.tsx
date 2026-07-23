"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ClipCard } from "@/components/clips/ClipCard";
import { ClipPreviewModal, type ClipSegmentPlayback } from "@/components/clips/ClipPreviewModal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { buildPublicShareUrl } from "@/lib/share-url";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ShareClipDialog } from "@/components/clips/ShareClipDialog";
import Link from "next/link";
import { useI18n } from "@/i18n/client";

type ClipWithDetails = {
  id: string;
  coach_id: string;
  video_id: string;
  name: string;
  render_status: string;
  audience_type: string;
  audience_player_ids: string[];
  team_id: string | null;
  created_at: string;
  matchId: string | null;
  matchTitle: string;
  audienceLabel: string;
  rendered_segments: { id: string; url: string; name: string; color: string; duration: number; play_start?: number; drawing_time_base?: "clip"; mobile_compatible?: boolean; drawings?: Array<{ id: string; url: string; at_seconds: number; duration_seconds: number }> }[];
  videos: { id: string; title: string | null; video_url: string } | null;
  clip_segments: {
    sequence_order: number;
    tags: { id: string; name: string; start_time: number; end_time: number; color: string; player_ids: string[] } | null;
  }[];
};

type MatchSummary = { id: string; coach_id: string; team_a_name: string; team_b_name: string; match_date: string | null; created_at: string; match_videos: { video_id: string }[] };

export default function ClipsPage() {
  const [clips, setClips] = useState<ClipWithDetails[]>([]);
  const [selectedClip, setSelectedClip] = useState<ClipWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClipWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [shareDialog, setShareDialog] = useState<{ clipName: string; shareUrl: string } | null>(null);
  const [shareError, setShareError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [expandedMatchIds, setExpandedMatchIds] = useState<Set<string>>(new Set());
  const supabase = createClient();
  const { t } = useI18n();

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ""));
    loadClips();
  }, []);

  async function loadClips() {
    const [{ data }, { data: playerData }, { data: matchData }] = await Promise.all([
      supabase.from("clips").select(
        `id, coach_id, video_id, team_id, name, created_at, render_status, rendered_segments, audience_type, audience_player_ids,
         videos ( id, title, video_url ),
         clip_segments ( sequence_order, tags ( id, name, start_time, end_time, color, player_ids ) )`).order("created_at", { ascending: false }),
      supabase.from("players").select("id, first_name, last_name"),
      supabase.from("matches").select("id, coach_id, team_a_name, team_b_name, match_date, created_at, match_videos(video_id)").order("match_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })
    ]);

    const playerNames = new Map((playerData ?? []).map((player) => [player.id, `${player.first_name} ${player.last_name}`.trim()]));
    const loadedMatches = (matchData as MatchSummary[] | null) ?? [];
    setMatches(loadedMatches);
    setExpandedMatchIds((current) => current.size ? current : new Set(loadedMatches.slice(0, 1).map((match) => match.id)));
    const matchIdsByVideo = new Map<string, string>();
    for (const match of loadedMatches) for (const link of match.match_videos ?? []) matchIdsByVideo.set(link.video_id, match.id);
    const matchesByVideo = new Map<string, string>();
    for (const match of matchData ?? []) {
      const title = `${match.team_a_name || t("match.teamA")} – ${match.team_b_name || t("match.teamB")}${match.match_date ? ` · ${match.match_date}` : ""}`;
      for (const link of match.match_videos ?? []) matchesByVideo.set(link.video_id, title);
    }
    const loaded = ((data as unknown as Omit<ClipWithDetails, "matchTitle" | "audienceLabel">[] | null) ?? []).map((clip) => ({
      ...clip,
      matchId: matchIdsByVideo.get(clip.video_id) ?? null,
      matchTitle: matchesByVideo.get(clip.video_id) || clip.videos?.title || t("clip.untitledMatch"),
      audienceLabel: clip.audience_type === "full_team" ? t("clip.fullSelectedTeam") : clip.audience_player_ids.map((id) => playerNames.get(id)).filter(Boolean).join(", ") || t("clip.noPlayersSelected"),
      clip_segments: clip.clip_segments.map((segment) => ({ ...segment, tags: segment.tags ? { ...segment.tags, playerNames: segment.tags.player_ids.map((id) => playerNames.get(id)).filter((name): name is string => !!name) } : null }))
    }));
    setClips(loaded as ClipWithDetails[]);
  }

  function toggleMatch(matchId: string) {
    setExpandedMatchIds((current) => { const next = new Set(current); if (next.has(matchId)) next.delete(matchId); else next.add(matchId); return next; });
  }

  function segmentsFor(clip: ClipWithDetails): ClipSegmentPlayback[] {
    if (clip.render_status === "ready" && clip.rendered_segments?.length) {
      return clip.rendered_segments.map((segment, index) => ({
        id: segment.id,
        name: segment.name,
        color: segment.color,
        start_time: segment.play_start ?? 0,
        end_time: segment.duration,
        url: segment.url,
        drawings: (segment.mobile_compatible ? [] : segment.drawings ?? []).map((drawing) => ({
          id: drawing.id,
          url: drawing.url,
          at_time: (segment.drawing_time_base === "clip" ? (segment.play_start ?? 0) : 0) + drawing.at_seconds,
          duration_seconds: drawing.duration_seconds
        })),
        playerNames: (clip.clip_segments[index]?.tags as any)?.playerNames ?? []
      }));
    }
    return [...clip.clip_segments]
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map((segment) => segment.tags)
      .filter((tag): tag is NonNullable<typeof tag> => !!tag)
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        start_time: tag.start_time,
        end_time: tag.end_time,
        playerNames: (tag as any).playerNames ?? []
      }));
  }

  async function shareClip(clip: ClipWithDetails) {
    setShareError("");
    const { data, error } = await supabase.from("share_links").insert({ clip_id: clip.id }).select().single();
    if (error || !data) {
      setShareError(error?.message || t("share.createFailed"));
      return;
    }
    setShareDialog({ clipName: clip.name, shareUrl: buildPublicShareUrl(data.token) });
  }

  async function deleteClip() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    const response = await fetch(`/api/clips/${deleteTarget.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      setDeleteError(body?.error || t("clip.deleteFailed"));
      setDeleting(false);
      return;
    }
    setClips((current) => current.filter((clip) => clip.id !== deleteTarget.id));
    if (selectedClip?.id === deleteTarget.id) setSelectedClip(null);
    setDeleteTarget(null);
    setDeleting(false);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <SectionHeader title={t("common.clips")} artworkSrc="/branding/clips.png" />

      <div className="space-y-4">
        {matches.map((match) => {
          const matchClips = clips.filter((clip) => clip.matchId === match.id);
          const expanded = expandedMatchIds.has(match.id);
          return <article key={match.id} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-borderSubtle bg-cardDeep p-4">
              <button type="button" onClick={() => toggleMatch(match.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className={`text-accent transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span><span className="min-w-0"><strong className="block truncate text-textBright">{match.team_a_name || t("match.teamA")} – {match.team_b_name || t("match.teamB")}</strong><span className="mt-0.5 block text-xs text-textMuted">{match.match_date || t("match.noDate")} · {t("clip.count", { count: matchClips.length })}</span></span></button>
              {match.coach_id === currentUserId && <Link href={`/dashboard/matches/${match.id}`} className="flex-shrink-0 rounded-lg border border-accent bg-accentDim px-3 py-2 text-sm font-semibold text-accent hover:bg-cardHover">{t("common.videoViewer")}</Link>}
            </div>
            {expanded && <div className="p-4">{matchClips.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{matchClips.map((clip) => <ClipCard key={clip.id} name={clip.name} videoTitle="" segmentCount={clip.clip_segments.length} audienceLabel={clip.audienceLabel} onClick={() => setSelectedClip(clip)} onDelete={clip.coach_id === currentUserId ? () => setDeleteTarget(clip) : undefined} />)}</div> : <p className="text-sm text-textMuted">{t("clip.noneForMatch")}</p>}</div>}
          </article>;
        })}
        {clips.some((clip) => !clip.matchId) && <article className="overflow-hidden rounded-xl border border-border bg-card"><button type="button" onClick={() => toggleMatch("unmatched")} className="flex w-full items-center gap-3 border-b border-borderSubtle bg-cardDeep p-4 text-left"><span className={`text-accent transition-transform ${expandedMatchIds.has("unmatched") ? "rotate-90" : ""}`}>▶</span><span><strong className="block text-textBright">{t("clip.otherVideos")}</strong><span className="text-xs text-textMuted">{t("clip.notLinked")}</span></span></button>{expandedMatchIds.has("unmatched") && <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{clips.filter((clip) => !clip.matchId).map((clip) => <ClipCard key={clip.id} name={clip.name} videoTitle={clip.matchTitle} segmentCount={clip.clip_segments.length} audienceLabel={clip.audienceLabel} onClick={() => setSelectedClip(clip)} onDelete={clip.coach_id === currentUserId ? () => setDeleteTarget(clip) : undefined} />)}</div>}</article>}
        {!matches.length && !clips.length && <p className="text-textMuted">{t("clip.none")}</p>}
      </div>

      {selectedClip && (
        <ClipPreviewModal
          clipName={selectedClip.name}
          videoUrl={selectedClip.videos?.video_url || ""}
          segments={segmentsFor(selectedClip)}
          onClose={() => setSelectedClip(null)}
          onShare={selectedClip.coach_id === currentUserId ? () => void shareClip(selectedClip) : undefined}
          matchTitle={selectedClip.matchTitle}
          audienceLabel={selectedClip.audienceLabel}
        />
      )}
      {deleteError && <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{deleteError}</p>}
      {shareError && <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{shareError}</p>}
      {shareDialog && <ShareClipDialog clipName={shareDialog.clipName} shareUrl={shareDialog.shareUrl} onClose={() => setShareDialog(null)} />}
      <ConfirmDialog open={!!deleteTarget} title={t("clip.deleteTitle")} message={t("clip.deleteMessage", { name: deleteTarget?.name ?? t("share.thisClip") })} busy={deleting} onCancel={() => { setDeleteTarget(null); setDeleteError(""); }} onConfirm={() => void deleteClip()} />
    </div>
  );
}
