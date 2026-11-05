import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { getRecordingDownloadUrl } from "@/lib/recordings360-download";

// Saved camera recordings use authenticated app routes rather than public URLs.
// Resolve only the selected sources, after checking the clip maker's match access.
export async function clipRecordingSources(clipId: string, user: User): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const { data: segments, error } = await admin.from("clip_segments")
    .select("video_id, videos(id, video_url), tags(video_id, videos(id, video_url))").eq("clip_id", clipId);
  if (error) throw new Error("De videobronnen van de clip konden niet worden geladen.");
  const sources: Record<string, string> = {};
  type SourceVideo = { id: string; video_url: string };
  const rows = (segments ?? []) as unknown as Array<{ videos: SourceVideo | null; tags: { videos: SourceVideo | null } | null }>;
  for (const segment of rows) {
    const video = segment.videos ?? segment.tags?.videos;
    if (!video || sources[video.id]) continue;
    const recording = /^\/api\/recordings360\/video\/([0-9a-f-]{36})$/i.exec(video.video_url);
    if (!recording) continue;
    const { data: job, error: jobError } = await admin.from("recording_copy_jobs")
      .select("object_key, recording_copy_plans!inner(match_id)").eq("id", recording[1]).eq("status", "done").maybeSingle();
    if (jobError || !job?.object_key) throw new Error("De opgeslagen cameraopname is nog niet beschikbaar.");
    const plan = job.recording_copy_plans as unknown as { match_id: string };
    const { data: match, error: matchError } = await admin.from("matches")
      .select("club_id, club_team_id, match_videos(video_id)").eq("id", plan.match_id).maybeSingle();
    if (matchError || !match?.club_id || !match.match_videos.some(link => link.video_id === video.id)) {
      throw new Error("De cameraopname hoort niet bij deze wedstrijdvideo.");
    }
    const access = await getClubAccess(match.club_id, user);
    if (!hasClubPermission(access, "games.view") || !hasClubPermission(access, "video.view") || !canAccessTeam(access, match.club_team_id)) {
      throw new Error("Geen toegang tot de cameraopname voor deze clip.");
    }
    sources[video.id] = await getRecordingDownloadUrl(job.object_key);
  }
  return sources;
}
