"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ClipCard } from "@/components/clips/ClipCard";
import { ClipPreviewModal, type ClipSegmentPlayback } from "@/components/clips/ClipPreviewModal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { buildPublicShareUrl } from "@/lib/share-url";

type ClipWithDetails = {
  id: string;
  name: string;
  render_status: string;
  rendered_segments: { id: string; url: string; name: string; color: string; duration: number; play_start?: number }[];
  videos: { title: string | null; video_url: string } | null;
  clip_segments: {
    sequence_order: number;
    tags: { id: string; name: string; start_time: number; end_time: number; color: string } | null;
  }[];
};

export default function ClipsPage() {
  const [clips, setClips] = useState<ClipWithDetails[]>([]);
  const [selectedClip, setSelectedClip] = useState<ClipWithDetails | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadClips();
  }, []);

  async function loadClips() {
    const { data } = await supabase
      .from("clips")
      .select(
        `id, name, render_status, rendered_segments,
         videos ( title, video_url ),
         clip_segments ( sequence_order, tags ( id, name, start_time, end_time, color ) )`
      )
      .order("created_at", { ascending: false });

    setClips((data as unknown as ClipWithDetails[] | null) ?? []);
  }

  function segmentsFor(clip: ClipWithDetails): ClipSegmentPlayback[] {
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
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        start_time: tag.start_time,
        end_time: tag.end_time
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <SectionHeader title="Clips" artworkSrc="/branding/clips.png" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            name={clip.name}
            videoTitle={clip.videos?.title || "Untitled video"}
            segmentCount={clip.clip_segments.length}
            onClick={() => setSelectedClip(clip)}
          />
        ))}
        {clips.length === 0 && <p className="text-textMuted">No clips yet. Build one from a video's tags.</p>}
      </div>

      {selectedClip && selectedClip.videos && (
        <ClipPreviewModal
          clipName={selectedClip.name}
          videoUrl={selectedClip.videos.video_url}
          segments={segmentsFor(selectedClip)}
          onClose={() => setSelectedClip(null)}
          onShare={() => shareClip(selectedClip.id)}
        />
      )}
    </div>
  );
}
