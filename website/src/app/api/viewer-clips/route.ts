import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { toViewerClip } from "@/lib/viewer-clips";

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const matchId = params.get("matchId");
  const videoId = params.get("videoId");
  if ((!matchId && !videoId) || (matchId && videoId)) return NextResponse.json({ error: "Invalid viewer scope" }, { status: 400 });
  const admin = createAdminClient();
  let videoIds: string[];
  let client = supabase;
  if (matchId) {
    const { data: match, error } = await admin.from("matches").select("club_id, club_team_id, match_videos(video_id)").eq("id", matchId).maybeSingle();
    if (error) return NextResponse.json({ error: "Clips konden niet worden geladen." }, { status: 500 });
    if (!match?.club_id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const access = await getClubAccess(match.club_id, user);
    if (!hasClubPermission(access, "games.view") || !hasClubPermission(access, "video.view") || !canAccessTeam(access, match.club_team_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    videoIds = (match.match_videos ?? []).map(link => link.video_id);
    client = admin;
  } else {
    // Standalone videos and clips retain the caller's row-level visibility.
    const { data: video } = await supabase.from("videos").select("id").eq("id", videoId!).maybeSingle();
    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    videoIds = [video.id];
  }
  if (!videoIds.length) return NextResponse.json({ clips: [] });
  const { data, error } = await client.from("clips").select("id, name, coach_id, render_status, rendered_segments, videos(video_url), clip_segments(id, video_id, sequence_order, videos(video_url), tags(name, color, start_time, end_time))")
    .in("video_id", videoIds).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Clips konden niet worden geladen." }, { status: 500 });
  const coachIds = [...new Set((data ?? []).map(clip => clip.coach_id))];
  // A maker's display name is optional: its lookup must never hide saved clips.
  const names = new Map<string, string | null>();
  if (coachIds.length) {
    try {
      const { data: profiles, error: profileError } = await admin.from("profiles").select("id, full_name").in("id", coachIds);
      if (!profileError) for (const profile of profiles ?? []) names.set(profile.id, profile.full_name);
    } catch { /* The viewer already has a fallback for an unknown maker. */ }
  }
  return NextResponse.json({ clips: (data ?? []).map(clip => toViewerClip(clip as unknown as Parameters<typeof toViewerClip>[0], names)) });
}
