type CameraBlock = {
  sequence_order: number;
  is_primary: boolean;
  videos: { video_key: string } | null;
};

export function isR2Recording(video: { video_key: string; video_url: string }) {
  return video.video_key.startsWith("recordings360/")
    || video.video_url.startsWith("/api/recordings360/video/");
}

// Older publications assigned each camera a different order, leaving the
// non-primary cameras unreachable. Repair the view without changing stored data.
export function normalizeRecordingCameraBlocks<T extends CameraBlock>(blocks: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const block of blocks) {
    const key = block.videos?.video_key ?? "";
    const recording = /^external\/(.+)\/ch\d+$/.exec(key)?.[1]
      ?? /^recordings360\/[^/]+\/[^/]+\/([^/]+)\/C\d+\.mp4$/.exec(key)?.[1];
    if (!recording) continue;
    const group = groups.get(recording) ?? [];
    group.push(block);
    groups.set(recording, group);
  }
  const replacements = new Map<T, T>();
  for (const group of groups.values()) {
    const order = Math.min(...group.map(block => block.sequence_order));
    const primary = group.find(block => block.is_primary) ?? group[0];
    for (const block of group) replacements.set(block, {
      ...block, sequence_order: order, is_primary: block === primary
    });
  }
  return blocks.map(block => replacements.get(block) ?? block);
}
