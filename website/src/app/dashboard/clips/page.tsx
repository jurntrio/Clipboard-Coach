"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ClipCard } from "@/components/clips/ClipCard";
import { ClipPreviewModal, type ClipSegmentPlayback } from "@/components/clips/ClipPreviewModal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { buildPublicShareUrl } from "@/lib/share-url";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type ClipWithDetails = {
  id: string;
  coach_id: string;
  video_id: string;
  name: string;
  render_status: string;
  audience_type: string;
  audience_player_ids: string[];
  matchTitle: string;
  audienceLabel: string;
  rendered_segments: { id: string; url: string; name: string; color: string; duration: number; play_start?: number }[];
  videos: { id: string; title: string | null; video_url: string } | null;
  clip_segments: {
    sequence_order: number;
    tags: { id: string; name: string; start_time: number; end_time: number; color: string; player_ids: string[] } | null;
  }[];
};

export default function ClipsPage() {
  const [clips, setClips] = useState<ClipWithDetails[]>([]);
  const [selectedClip, setSelectedClip] = useState<ClipWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClipWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const supabase = createClient();

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ""));
    loadClips();
  }, []);

  async function loadClips() {
    const [{ data }, { data: playerData }, { data: matchData }] = await Promise.all([
      supabase.from("clips").select(
        `id, coach_id, video_id, name, render_status, rendered_segments, audience_type, audience_player_ids,
         videos ( id, title, video_url ),
         clip_segments ( sequence_order, tags ( id, name, start_time, end_time, color, player_ids ) )`).order("created_at", { ascending: false }),
      supabase.from("players").select("id, first_name, last_name"),
      supabase.from("matches").select("id, team_a_name, team_b_name, match_date, match_videos(video_id)")
    ]);

    const playerNames = new Map((playerData ?? []).map((player) => [player.id, `${player.first_name} ${player.last_name}`.trim()]));
    const matchesByVideo = new Map<string, string>();
    for (const match of matchData ?? []) {
      const title = `${match.team_a_name || "Team A"} – ${match.team_b_name || "Team B"}${match.match_date ? ` · ${match.match_date}` : ""}`;
      for (const link of match.match_videos ?? []) matchesByVideo.set(link.video_id, title);
    }
    const loaded = ((data as unknown as Omit<ClipWithDetails, "matchTitle" | "audienceLabel">[] | null) ?? []).map((clip) => ({
      ...clip,
      matchTitle: matchesByVideo.get(clip.video_id) || clip.videos?.title || "Untitled match",
      audienceLabel: clip.audience_type === "full_team" ? "Full selected team" : clip.audience_player_ids.map((id) => playerNames.get(id)).filter(Boolean).join(", ") || "No players selected",
      clip_segments: clip.clip_segments.map((segment) => ({ ...segment, tags: segment.tags ? { ...segment.tags, playerNames: segment.tags.player_ids.map((id) => playerNames.get(id)).filter((name): name is string => !!name) } : null }))
    }));
    setClips(loaded as ClipWithDetails[]);
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

  async function shareClip(clipId: string) {
    const { data } = await supabase.from("share_links").insert({ clip_id: clipId }).select().single();
    if (data) {
      const shareUrl = buildPublicShareUrl(data.token);
      await navigator.clipboard.writeText(shareUrl);
      alert(`Share link copied:\n${shareUrl}`);
    }
  }

  async function deleteClip() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    const response = await fetch(`/api/clips/${deleteTarget.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      setDeleteError(body?.error || "The clip could not be deleted.");
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
      <SectionHeader title="Clips" artworkSrc="/branding/clips.png" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            name={clip.name}
            videoTitle={clip.matchTitle}
            segmentCount={clip.clip_segments.length}
            onClick={() => setSelectedClip(clip)}
            onDelete={clip.coach_id === currentUserId ? () => setDeleteTarget(clip) : undefined}
          />
        ))}
        {clips.length === 0 && <p className="text-textMuted">No clips yet. Build one from a video's tags.</p>}
      </div>

      {selectedClip && (
        <ClipPreviewModal
          clipName={selectedClip.name}
          videoUrl={selectedClip.videos?.video_url || ""}
          segments={segmentsFor(selectedClip)}
          onClose={() => setSelectedClip(null)}
          onShare={selectedClip.coach_id === currentUserId ? () => shareClip(selectedClip.id) : undefined}
          matchTitle={selectedClip.matchTitle}
          audienceLabel={selectedClip.audienceLabel}
        />
      )}
      {deleteError && <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{deleteError}</p>}
      <ConfirmDialog open={!!deleteTarget} title="Delete clip?" message={`Delete ${deleteTarget?.name ?? "this clip"}, its share links and all uploaded video segments? This cannot be undone.`} busy={deleting} onCancel={() => { setDeleteTarget(null); setDeleteError(""); }} onConfirm={() => void deleteClip()} />
    </div>
  );
}
