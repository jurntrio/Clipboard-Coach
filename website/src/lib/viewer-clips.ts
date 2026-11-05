export type ViewerClip = {
  id: string;
  name: string;
  creatorName: string | null;
  render_status: string;
  segments: Array<{ id: string; name: string; color: string; start_time: number; end_time: number; url?: string; video_id?: string | null; drawings?: Array<{ id: string; url: string; at_time: number; duration_seconds: number }> }>;
};

type ClipSource = {
  id: string; name: string; coach_id: string; render_status: string;
  rendered_segments: Array<{ id: string; name: string; color: string; url: string; duration: number; play_start?: number; drawings?: Array<{ id: string; url: string; at_seconds: number; duration_seconds: number }> }> | null;
  videos: { video_url: string } | null;
  clip_segments: Array<{ id: string; video_id?: string | null; sequence_order: number; videos: { video_url: string } | null; tags: { name: string; color: string; start_time: number; end_time: number } | null }>;
};

export function toViewerClip(clip: ClipSource, names: Map<string, string | null>): ViewerClip {
  const rendered = clip.render_status === "ready" ? (clip.rendered_segments ?? []).filter(segment => !!segment.url) : [];
  return {
    id: clip.id, name: clip.name, creatorName: names.get(clip.coach_id)?.trim() || null, render_status: clip.render_status,
    segments: rendered.length ? rendered.map(segment => ({
      id: segment.id, name: segment.name, color: segment.color, start_time: segment.play_start ?? 0, end_time: segment.duration, url: segment.url,
      drawings: segment.drawings?.map(drawing => ({ ...drawing, at_time: drawing.at_seconds }))
    })) : [...(clip.clip_segments ?? [])].sort((a, b) => a.sequence_order - b.sequence_order).flatMap(segment => segment.tags ? [{
      id: segment.id, video_id: segment.video_id, ...segment.tags, url: segment.videos?.video_url || clip.videos?.video_url
    }] : [])
  };
}
