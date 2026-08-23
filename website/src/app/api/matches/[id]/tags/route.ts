import { NextResponse } from "next/server";
import { canAccessTeam, getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTagColor } from "@/lib/utils";

async function authorizedMatch(matchId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches")
    .select("id, coach_id, club_id, club_team_id")
    .eq("id", matchId).maybeSingle();
  if (!match?.club_id) return { error: NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 }) };
  const access = await getClubAccess(match.club_id, user);
  const canManage = !access.readOnly && canAccessTeam(access, match.club_team_id)
    && (match.coach_id === user.id || access.role === "club_admin" || access.role === "platform_admin");
  if (!canManage) return { error: NextResponse.json({ error: "Geen recht om tags te beheren." }, { status: 403 }) };
  return { admin, user, match };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizedMatch(params.id);
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null) as {
    videoId?: string; name?: string; occurredAtSeconds?: number; playerIds?: string[];
  } | null;
  const name = body?.name?.trim() ?? "";
  const moment = body?.occurredAtSeconds;
  if (!body?.videoId || !name || typeof moment !== "number" || !Number.isFinite(moment)) {
    return NextResponse.json({ error: "Ongeldige tag." }, { status: 400 });
  }
  const { data: matchVideo } = await auth.admin.from("match_videos")
    .select("video_id, videos(duration, active_player_ids)")
    .eq("match_id", auth.match.id).eq("video_id", body.videoId).maybeSingle();
  if (!matchVideo) return NextResponse.json({ error: "Videobron niet gevonden." }, { status: 404 });
  const video = Array.isArray(matchVideo.videos) ? matchVideo.videos[0] : matchVideo.videos;
  const { data: profile } = await auth.admin.from("standard_tags")
    .select("start_offset_seconds, end_offset_seconds")
    .eq("coach_id", auth.user.id).ilike("name", name).limit(1).maybeSingle();
  const safeMoment = Math.max(0, Math.min(video?.duration ?? Number.POSITIVE_INFINITY, moment));
  const startTime = Math.max(0, safeMoment + (profile?.start_offset_seconds ?? -5));
  const endTime = Math.min(video?.duration ?? Number.POSITIVE_INFINITY, Math.max(startTime, safeMoment + (profile?.end_offset_seconds ?? 5)));
  const { data: tag, error } = await auth.admin.from("tags").insert({
    video_id: body.videoId,
    name,
    occurred_at_seconds: safeMoment,
    start_time: startTime,
    end_time: endTime,
    color: getTagColor(name),
    player_ids: body.playerIds?.length ? body.playerIds : video?.active_player_ids ?? []
  }).select("*").single();
  if (error || !tag) return NextResponse.json({ error: error?.message || "Tag kon niet worden opgeslagen." }, { status: 500 });
  return NextResponse.json({ tag }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizedMatch(params.id);
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null) as { tagId?: string; name?: string } | null;
  const name = body?.name?.trim() ?? "";
  if (!body?.tagId || !name) return NextResponse.json({ error: "Ongeldige tagnaam." }, { status: 400 });
  const { data: tag } = await auth.admin.from("tags").select("id, video_id").eq("id", body.tagId).maybeSingle();
  if (!tag) return NextResponse.json({ error: "Tag niet gevonden." }, { status: 404 });
  const { data: link } = await auth.admin.from("match_videos").select("id")
    .eq("match_id", auth.match.id).eq("video_id", tag.video_id).maybeSingle();
  if (!link) return NextResponse.json({ error: "Tag hoort niet bij deze wedstrijd." }, { status: 403 });
  const color = getTagColor(name);
  const { data: updated, error } = await auth.admin.from("tags").update({ name, color }).eq("id", tag.id).select("*").single();
  if (error || !updated) {
    console.error("Match tag rename failed", { matchId: auth.match.id, tagId: tag.id, userId: auth.user.id, error: error?.message });
    return NextResponse.json({ error: error?.message || "Tag kon niet worden hernoemd." }, { status: 500 });
  }
  const { error: liveTagError } = await auth.admin.from("live_match_tags").update({ tag_name: name }).eq("match_id", auth.match.id).eq("tag_id", tag.id);
  if (liveTagError) console.error("Linked live tag rename failed", { matchId: auth.match.id, tagId: tag.id, error: liveTagError.message });
  return NextResponse.json({ tag: updated });
}
