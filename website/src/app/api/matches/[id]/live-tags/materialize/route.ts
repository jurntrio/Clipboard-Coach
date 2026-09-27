import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

type Body = {
  liveTagId?: string;
  videoId?: string;
  occurredAtSeconds?: number;
  startTime?: number;
  endTime?: number;
  color?: string;
  playerIds?: string[];
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: match } = await admin.from("matches")
    .select("id, coach_id, club_id, club_team_id")
    .eq("id", params.id).maybeSingle();
  if (!match?.club_id) return NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 });

  const access = await getClubAccess(match.club_id, user);
  const canManage = !access.readOnly && canAccessTeam(access, match.club_team_id)
    && (match.coach_id === user.id || access.role === "club_admin" || access.role === "platform_admin" || hasClubPermission(access, "games.tag"));
  if (!canManage) return NextResponse.json({ error: "Geen recht om tags te beheren." }, { status: 403 });

  const body = await request.json().catch(() => null) as Body | null;
  const values = [body?.occurredAtSeconds, body?.startTime, body?.endTime];
  if (!body?.liveTagId || !body.videoId || values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    return NextResponse.json({ error: "Ongeldige live-tag." }, { status: 400 });
  }
  const occurredAtSeconds = Math.max(0, body.occurredAtSeconds as number);
  const startTime = Math.max(0, body.startTime as number);
  const endTime = Math.max(startTime, body.endTime as number);
  if (endTime - startTime > 180) return NextResponse.json({ error: "De tag is te lang." }, { status: 400 });

  const [{ data: liveTag }, { data: matchVideo }] = await Promise.all([
    admin.from("live_match_tags").select("id, tag_id, tag_name, player_ids, event_type, score_home, score_away, scorer_id").eq("id", body.liveTagId).eq("match_id", match.id).maybeSingle(),
    admin.from("match_videos").select("video_id, videos(duration, active_player_ids)").eq("match_id", match.id).eq("video_id", body.videoId).maybeSingle()
  ]);
  if (!liveTag || !matchVideo) return NextResponse.json({ error: "Live-tag of videobron niet gevonden." }, { status: 404 });
  if (liveTag.tag_id) {
    const { data: existing } = await admin.from("tags").select("*").eq("id", liveTag.tag_id).maybeSingle();
    return NextResponse.json({ tag: existing });
  }

  const video = Array.isArray(matchVideo.videos) ? matchVideo.videos[0] : matchVideo.videos;
  const playerIds = body.playerIds?.length ? body.playerIds : liveTag.player_ids?.length ? liveTag.player_ids : video?.active_player_ids ?? [];
  const { data: createdTag, error: tagError } = await admin.from("tags").insert({
    video_id: body.videoId,
    name: liveTag.tag_name,
    occurred_at_seconds: occurredAtSeconds,
    start_time: startTime,
    end_time: endTime,
    color: body.color || "#22c55e",
    player_ids: playerIds,
    event_type: liveTag.event_type,
    event_metadata: liveTag.event_type ? {
      scorer_id: liveTag.scorer_id,
      score_home: liveTag.score_home,
      score_away: liveTag.score_away,
      live_tag_id: liveTag.id
    } : {}
  }).select("*").single();
  if (tagError || !createdTag) return NextResponse.json({ error: tagError?.message || "Tag kon niet worden aangemaakt." }, { status: 500 });

  const { data: claimed, error: linkError } = await admin.from("live_match_tags")
    .update({ tag_id: createdTag.id }).eq("id", liveTag.id).is("tag_id", null).select("id");
  if (linkError || !claimed?.length) {
    await admin.from("tags").delete().eq("id", createdTag.id);
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
    const { data: current } = await admin.from("live_match_tags").select("tag_id").eq("id", liveTag.id).single();
    const { data: existing } = current?.tag_id ? await admin.from("tags").select("*").eq("id", current.tag_id).single() : { data: null };
    return NextResponse.json({ tag: existing });
  }
  return NextResponse.json({ tag: createdTag }, { status: 201 });
}
