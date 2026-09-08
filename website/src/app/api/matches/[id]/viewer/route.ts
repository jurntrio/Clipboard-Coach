import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { canManageMatchVideoSources } from "@/lib/auth/match-video-sources";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: match } = await admin.from("matches")
    .select("*, match_videos(id, sequence_order, label, is_primary, recording_started_at, videos(*))")
    .eq("id", params.id)
    .maybeSingle();
  if (!match?.club_id) return NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 });

  const access = await getClubAccess(match.club_id, user);
  if (!hasClubPermission(access, "games.view") || !hasClubPermission(access, "video.view") || !canAccessTeam(access, match.club_team_id)) {
    return NextResponse.json({ error: "Geen toegang tot de wedstrijdbeelden." }, { status: 403 });
  }

  const videoIds = (match.match_videos ?? [])
    .map((block: { videos: { id: string } | null }) => block.videos?.id)
    .filter((id: string | undefined): id is string => typeof id === "string");
  const [{ data: tags }, { data: liveTags }, { data: club }] = await Promise.all([
    videoIds.length ? admin.from("tags").select("*").in("video_id", videoIds) : Promise.resolve({ data: [] }),
    admin.from("live_match_tags").select("*").eq("match_id", match.id).order("occurred_at"),
    admin.from("clubs").select("external_recording_url_template, external_recording_camera_count").eq("id", match.club_id).maybeSingle()
  ]);
  const canManageSources = canManageMatchVideoSources({
    readOnly: access.readOnly,
    canAccessTeam: canAccessTeam(access, match.club_team_id),
    canManageVideoSources: hasClubPermission(access, "games.video_sources.manage"),
    role: access.role,
    matchCoachId: match.coach_id,
    userId: user.id
  });

  return NextResponse.json({ match, tags: tags ?? [], liveTags: liveTags ?? [], canManageSources, recordingConfig: club ?? null });
}
