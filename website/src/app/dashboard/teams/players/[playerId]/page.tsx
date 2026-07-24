"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { buildPublicShareUrl } from "@/lib/share-url";
import { getPlayerDisplayName } from "@/lib/utils";
import type { Player } from "@/types/database";
import { ClipCard } from "@/components/clips/ClipCard";
import { ClipPreviewModal, type ClipSegmentPlayback } from "@/components/clips/ClipPreviewModal";
import { EditPlayerModal } from "@/components/teams/EditPlayerModal";
import { ShareClipDialog } from "@/components/clips/ShareClipDialog";
import { useI18n } from "@/i18n/client";

type PlayerWithTeam = Player & { teams: { name: string } | null };
type PlayerClip = {
  id: string;
  name: string;
  created_at: string;
  team_id: string | null;
  audience_type: "full_team" | "selected_players" | "specific_players";
  audience_player_ids: string[];
  render_status: string;
  rendered_segments: { id: string; url: string; name: string; color: string; duration: number; play_start?: number; drawing_time_base?: "clip"; mobile_compatible?: boolean; drawings?: Array<{ id: string; url: string; at_seconds: number; duration_seconds: number }> }[];
  videos: {
    id: string;
    title: string | null;
    video_url: string;
    match_videos: {
      match_id: string;
      matches: {
        id: string;
        team_a_name: string;
        team_b_name: string;
        match_date: string | null;
        start_time: string | null;
        score_a: number | null;
        score_b: number | null;
      } | null;
    }[];
  } | null;
  clip_segments: {
    sequence_order: number;
    tags: { id: string; name: string; start_time: number; end_time: number; color: string; player_ids: string[] } | null;
  }[];
};

export default function PlayerClipsPage() {
  const { t, locale } = useI18n();
  const { playerId } = useParams<{ playerId: string }>();
  const [player, setPlayer] = useState<PlayerWithTeam | null>(null);
  const [clips, setClips] = useState<PlayerClip[]>([]);
  const [selectedClip, setSelectedClip] = useState<PlayerClip | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shareDialog, setShareDialog] = useState<{ clipName: string; shareUrl: string } | null>(null);
  const [shareError, setShareError] = useState("");
  const supabase = createClient();

  useEffect(() => { void loadPlayerAndClips(); }, [playerId]);

  async function loadPlayerAndClips() {
    setLoading(true);
    const [playerResult, clipResult] = await Promise.all([
      supabase.from("players").select("*, teams(name)").eq("id", playerId).single(),
      supabase.from("clips").select(`
        id, name, created_at, team_id, audience_type, audience_player_ids, render_status, rendered_segments,
        videos(id, title, video_url, match_videos(match_id, matches(id, team_a_name, team_b_name, match_date, start_time, score_a, score_b))),
        clip_segments(sequence_order, tags(id, name, start_time, end_time, color, player_ids))
      `).order("created_at", { ascending: false })
    ]);

    setPlayer((playerResult.data as unknown as PlayerWithTeam | null) ?? null);
    const allClips = (clipResult.data as unknown as PlayerClip[] | null) ?? [];
    const loadedPlayer = (playerResult.data as unknown as PlayerWithTeam | null) ?? null;
    setClips(allClips.filter((clip) => {
      if (!loadedPlayer) return false;
      if (clip.audience_player_ids.includes(playerId) || clip.clip_segments.some((segment) => segment.tags?.player_ids.includes(playerId))) return true;
      return clip.team_id === loadedPlayer.team_id && clip.audience_type === "full_team";
    }));
    setLoading(false);
  }

  const clipGroups = clips.reduce((groups, clip) => {
    const match = clip.videos?.match_videos?.[0]?.matches ?? null;
    const key = match?.id ?? `video:${clip.videos?.id ?? clip.id}`;
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.clips.push(clip);
    } else {
      groups.push({
        key,
        match,
        videoTitle: clip.videos?.title || t("team.untitledVideo"),
        clips: [clip]
      });
    }
    return groups;
  }, [] as {
    key: string;
    match: NonNullable<PlayerClip["videos"]>["match_videos"][number]["matches"];
    videoTitle: string;
    clips: PlayerClip[];
  }[]);

  function segmentsFor(clip: PlayerClip): ClipSegmentPlayback[] {
    if (clip.render_status === "ready" && clip.rendered_segments?.length) {
      return clip.rendered_segments.map((segment) => ({
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
        }))
      }));
    }

    return [...clip.clip_segments]
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map((segment) => segment.tags)
      .filter((tag): tag is NonNullable<typeof tag> => !!tag)
      .map((tag) => ({ id: tag.id, name: tag.name, color: tag.color, start_time: tag.start_time, end_time: tag.end_time }));
  }

  async function shareClip(clip: PlayerClip) {
    setShareError("");
    const { data, error } = await supabase.from("share_links").insert({ clip_id: clip.id }).select().single();
    if (error || !data) {
      setShareError(error?.message || t("share.createFailed"));
      return;
    }
    setShareDialog({ clipName: clip.name, shareUrl: buildPublicShareUrl(data.token) });
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-8 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Link href="/dashboard/teams" title={t("team.back")} className="grid h-14 w-14 place-items-center rounded-lg border border-borderButton bg-button hover:border-accent"><Image src="/branding/back.png" alt={t("team.back")} width={38} height={38} /></Link>
        <Link href="/dashboard" title={t("nav.home")} className="grid h-14 w-14 place-items-center rounded-lg border border-borderButton bg-button hover:border-accent"><Image src="/branding/home.png" alt={t("nav.home")} width={34} height={34} /></Link>
        <div className="ml-3 flex min-w-0 flex-1 items-center gap-3">
          <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full border-2 border-accent bg-avatar font-bold text-accent">{player?.initials || "–"}</div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-textBright">{player ? getPlayerDisplayName(player) : t("team.player")}</h1>
            <p className="text-sm text-textMuted">{player?.teams?.name || t("team.team")}{player?.position ? ` · ${player.position}` : ""}</p>
          </div>
        </div>
        <button type="button" onClick={() => setEditing(true)} disabled={!player} title={t("team.editPlayer")} aria-label={t("team.editPlayer")} className="ml-auto grid h-14 w-14 flex-shrink-0 place-items-center rounded-lg border border-borderButton bg-button transition hover:border-accent disabled:opacity-40"><Image src="/branding/edit.png" alt={t("common.edit")} width={34} height={34} /></button>
      </header>

      {player && (
        <section className="mb-8 grid gap-3 rounded-xl border border-border bg-cardDeep p-4 sm:grid-cols-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("team.dateOfBirth")}</p><p className="mt-1 text-sm text-textPrimary">{player.date_of_birth ? new Date(`${player.date_of_birth}T00:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB") : "–"}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("auth.email")}</p><p className="mt-1 break-all text-sm text-textPrimary">{player.email || "–"}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("team.phoneNumbers")}</p><p className="mt-1 text-sm text-textPrimary">{player.phone_numbers?.join(", ") || "–"}</p></div>
        </section>
      )}

      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-textSecondary">Wedstrijden met gedeelde clips</h2>
        <span className="rounded-full bg-accentDim px-2 py-0.5 text-xs text-accent">{clips.length}</span>
      </div>

      {loading ? (
        <p className="text-sm text-textMuted">{t("team.loadingClips")}</p>
      ) : clips.length ? (
        <div className="space-y-5">
          {clipGroups.map((group) => (
            <section key={group.key} className="overflow-hidden rounded-xl border border-border bg-cardDeep">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borderSubtle px-4 py-3">
                <div>
                  <h3 className="font-semibold text-textBright">
                    {group.match ? `${group.match.team_a_name} – ${group.match.team_b_name}` : group.videoTitle}
                  </h3>
                  <p className="mt-0.5 text-xs text-textMuted">
                    {group.match?.match_date
                      ? new Date(`${group.match.match_date}T00:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB")
                      : "Oudere clip zonder wedstrijdkoppeling"}
                    {group.match?.start_time ? ` · ${group.match.start_time.slice(0, 5)}` : ""}
                    {group.match && group.match.score_a !== null && group.match.score_b !== null ? ` · ${group.match.score_a}–${group.match.score_b}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-accentDim px-2.5 py-1 text-xs font-semibold text-accent">{group.clips.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.clips.map((clip) => <ClipCard key={clip.id} name={clip.name} videoTitle={clip.videos?.title || t("team.untitledVideo")} segmentCount={clip.clip_segments.length} onClick={() => setSelectedClip(clip)} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-cardDeep p-5 text-sm text-textMuted">{t("team.noTaggedClips")}</div>
      )}

      {selectedClip && selectedClip.videos && (
        <ClipPreviewModal clipName={selectedClip.name} videoUrl={selectedClip.videos.video_url} segments={segmentsFor(selectedClip)} onClose={() => setSelectedClip(null)} onShare={() => void shareClip(selectedClip)} />
      )}
      {shareError && <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{shareError}</p>}
      {shareDialog && <ShareClipDialog clipName={shareDialog.clipName} shareUrl={shareDialog.shareUrl} onClose={() => setShareDialog(null)} />}
      {editing && player && <EditPlayerModal player={player} onClose={() => setEditing(false)} onSaved={() => void loadPlayerAndClips()} />}
    </div>
  );
}
