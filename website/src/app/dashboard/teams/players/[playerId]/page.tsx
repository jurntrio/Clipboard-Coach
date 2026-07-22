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

type PlayerWithTeam = Player & { teams: { name: string } | null };
type PlayerClip = {
  id: string;
  name: string;
  created_at: string;
  team_id: string | null;
  audience_type: "full_team" | "selected_players" | "specific_players";
  audience_player_ids: string[];
  render_status: string;
  rendered_segments: { id: string; url: string; name: string; color: string; duration: number; play_start?: number }[];
  videos: { title: string | null; video_url: string } | null;
  clip_segments: {
    sequence_order: number;
    tags: { id: string; name: string; start_time: number; end_time: number; color: string; player_ids: string[] } | null;
  }[];
};

export default function PlayerClipsPage() {
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
        videos(title, video_url),
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

  function segmentsFor(clip: PlayerClip): ClipSegmentPlayback[] {
    if (clip.render_status === "ready" && clip.rendered_segments?.length) {
      return clip.rendered_segments.map((segment) => ({
        id: segment.id,
        name: segment.name,
        color: segment.color,
        start_time: segment.play_start ?? 0,
        end_time: segment.duration,
        url: segment.url
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
      setShareError(error?.message || "The share link could not be created.");
      return;
    }
    setShareDialog({ clipName: clip.name, shareUrl: buildPublicShareUrl(data.token) });
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-8 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Link href="/dashboard/teams" title="Back to teams" className="grid h-14 w-14 place-items-center rounded-lg border border-borderButton bg-button hover:border-accent"><Image src="/branding/back.png" alt="Back" width={38} height={38} /></Link>
        <Link href="/dashboard" title="Home" className="grid h-14 w-14 place-items-center rounded-lg border border-borderButton bg-button hover:border-accent"><Image src="/branding/home.png" alt="Home" width={34} height={34} /></Link>
        <div className="ml-3 flex min-w-0 flex-1 items-center gap-3">
          <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full border-2 border-accent bg-avatar font-bold text-accent">{player?.initials || "–"}</div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-textBright">{player ? getPlayerDisplayName(player) : "Player"}</h1>
            <p className="text-sm text-textMuted">{player?.teams?.name || "Team"}{player?.position ? ` · ${player.position}` : ""}</p>
          </div>
        </div>
        <button type="button" onClick={() => setEditing(true)} disabled={!player} title="Edit player" aria-label="Edit player" className="ml-auto grid h-14 w-14 flex-shrink-0 place-items-center rounded-lg border border-borderButton bg-button transition hover:border-accent disabled:opacity-40"><Image src="/branding/edit.png" alt="Edit" width={34} height={34} /></button>
      </header>

      {player && (
        <section className="mb-8 grid gap-3 rounded-xl border border-border bg-cardDeep p-4 sm:grid-cols-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">Date of birth</p><p className="mt-1 text-sm text-textPrimary">{player.date_of_birth ? new Date(`${player.date_of_birth}T00:00:00`).toLocaleDateString("nl-BE") : "–"}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">Email</p><p className="mt-1 break-all text-sm text-textPrimary">{player.email || "–"}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">Phone numbers</p><p className="mt-1 text-sm text-textPrimary">{player.phone_numbers?.join(", ") || "–"}</p></div>
        </section>
      )}

      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-textSecondary">Tagged clips</h2>
        <span className="rounded-full bg-accentDim px-2 py-0.5 text-xs text-accent">{clips.length}</span>
      </div>

      {loading ? (
        <p className="text-sm text-textMuted">Loading clips…</p>
      ) : clips.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clips.map((clip) => <ClipCard key={clip.id} name={clip.name} videoTitle={clip.videos?.title || "Untitled video"} segmentCount={clip.clip_segments.length} onClick={() => setSelectedClip(clip)} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-cardDeep p-5 text-sm text-textMuted">No clips contain a tag for this player yet.</div>
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
