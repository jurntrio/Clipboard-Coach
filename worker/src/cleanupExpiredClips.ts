import { deleteObject } from "./r2";
import { supabase } from "./supabase";

const RETENTION_DAYS = 365;
const BATCH_SIZE = 100;

type StoredSegment = { key?: string | null };
type ExpiredClip = { id: string; rendered_segments: StoredSegment[] | null };

export async function cleanupExpiredClips() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let deletedClips = 0;
  let deletedObjects = 0;

  while (true) {
    const { data, error } = await supabase
      .from("clips")
      .select("id, rendered_segments")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;

    const clips = (data ?? []) as ExpiredClip[];
    if (!clips.length) break;

    for (const clip of clips) {
      const keys = Array.from(new Set((clip.rendered_segments ?? []).map((segment) => segment.key).filter((key): key is string => !!key)));
      keys.push(`clip-intros/renders/${clip.id}.json`, `clip-intros/render-assets/${clip.id}/opening.png`);
      for (const key of keys) {
        await deleteObject(key);
        deletedObjects += 1;
      }

      // Deleting the clip cascades to clip_segments and share_links.
      const { error: deleteError } = await supabase.from("clips").delete().eq("id", clip.id);
      if (deleteError) throw deleteError;
      deletedClips += 1;
    }

    if (clips.length < BATCH_SIZE) break;
  }

  return { cutoff, deletedClips, deletedObjects };
}
