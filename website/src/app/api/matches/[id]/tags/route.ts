import { NextResponse } from "next/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTagColor } from "@/lib/utils";

async function authorizedMatch(matchId: string, creating = false) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches")
    .select("id, coach_id, club_id, club_team_id, team_a_id, match_date")
    .eq("id", matchId).maybeSingle();
  if (!match?.club_id) return { error: NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 }) };
  const access = await getClubAccess(match.club_id, user);
  const canView = hasClubPermission(access, "games.view") && hasClubPermission(access, "video.view") && canAccessTeam(access, match.club_team_id);
  const canManage = !access.readOnly && canAccessTeam(access, match.club_team_id)
    && (match.coach_id === user.id || access.role === "club_admin" || access.role === "platform_admin" || hasClubPermission(access, "games.tag"));
  if (!(creating ? canView : canManage)) return { error: NextResponse.json({ error: "Geen recht om tags te beheren." }, { status: 403 }) };
  return { admin, user, match };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizedMatch(params.id, true);
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null) as {
    videoId?: string; name?: string; occurredAtSeconds?: number; startTime?: number; endTime?: number; playerIds?: string[];
    eventType?: "goal_for" | "goal_against"; scorerId?: string | null; assistId?: string | null;
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
  const isGoal = /^goal(?:\s|$)/i.test(name);
  if (isGoal && !["goal_for", "goal_against"].includes(body.eventType ?? "")) {
    return NextResponse.json({ error: "Kies goal voor of goal tegen." }, { status: 400 });
  }
  if (!isGoal && (body.eventType || body.scorerId || body.assistId)) {
    return NextResponse.json({ error: "Doelpuntgegevens horen bij een goaltag." }, { status: 400 });
  }
  const goalPlayerIds = [body.scorerId, body.assistId].filter((id): id is string => typeof id === "string" && !!id);
  if (body.scorerId && body.scorerId === body.assistId) {
    return NextResponse.json({ error: "De doelpuntenmaker kan niet ook de assistgever zijn." }, { status: 400 });
  }
  if (goalPlayerIds.length) {
    const { data: players, error } = auth.match.team_a_id
      ? await auth.admin.from("players").select("id").eq("team_id", auth.match.team_a_id).eq("role", "player").in("id", goalPlayerIds)
      : { data: [], error: null };
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (goalPlayerIds.some(id => !(players ?? []).some(player => player.id === id))) {
      return NextResponse.json({ error: "Speler hoort niet bij deze ploeg." }, { status: 400 });
    }
  }
  const video = Array.isArray(matchVideo.videos) ? matchVideo.videos[0] : matchVideo.videos;
  const safeMoment = Math.max(0, Math.min(video?.duration ?? Number.POSITIVE_INFINITY, moment));
  const explicitRange = typeof body.startTime === "number" && Number.isFinite(body.startTime)
    && typeof body.endTime === "number" && Number.isFinite(body.endTime);
  const { data: profile } = explicitRange ? { data: null } : await auth.admin.from("standard_tags")
    .select("start_offset_seconds, end_offset_seconds")
    .eq("coach_id", auth.user.id).ilike("name", name).limit(1).maybeSingle();
  const startTime = explicitRange
    ? Math.max(0, Math.min(video?.duration ?? Number.POSITIVE_INFINITY, body.startTime as number))
    : Math.max(0, safeMoment + (profile?.start_offset_seconds ?? -5));
  const endTime = explicitRange
    ? Math.max(startTime, Math.min(video?.duration ?? Number.POSITIVE_INFINITY, body.endTime as number))
    : Math.min(video?.duration ?? Number.POSITIVE_INFINITY, Math.max(startTime, safeMoment + (profile?.end_offset_seconds ?? 5)));
  if (endTime - startTime > 180) return NextResponse.json({ error: "De tag is te lang." }, { status: 400 });
  const { data: tag, error } = await auth.admin.from("tags").insert({
    video_id: body.videoId,
    name,
    occurred_at_seconds: safeMoment,
    start_time: startTime,
    end_time: endTime,
    color: getTagColor(name),
    player_ids: body.playerIds?.length ? body.playerIds : video?.active_player_ids ?? [],
    event_type: isGoal ? body.eventType : null,
    event_metadata: {
      created_by: auth.user.id,
      ...(isGoal && body.scorerId ? { scorer_id: body.scorerId } : {}),
      ...(isGoal && body.assistId ? { assist_id: body.assistId } : {})
    }
  }).select("*").single();
  if (error || !tag) return NextResponse.json({ error: error?.message || "Tag kon niet worden opgeslagen." }, { status: 500 });
  if (isGoal && body.eventType === "goal_for" && goalPlayerIds.length) {
    const events = [
      ...(body.scorerId ? [{ player_id: body.scorerId, stat_type: "goal" }] : []),
      ...(body.assistId ? [{ player_id: body.assistId, stat_type: "assist" }] : [])
    ].map(event => ({ ...event, coach_id: auth.user.id, match_id: auth.match.id, tag_id: tag.id,
      team_id: auth.match.team_a_id, season: String(new Date(auth.match.match_date).getUTCFullYear()) }));
    const { error: statsError } = await auth.admin.from("player_stat_events").insert(events);
    if (statsError) {
      // Tag deletion also cascades any related statistic rows.
      const { error: cleanupError } = await auth.admin.from("tags").delete().eq("id", tag.id);
      if (cleanupError) return NextResponse.json({ tag, warning: "Goal opgeslagen, maar spelersstatistieken konden niet worden opgeslagen." }, { status: 201 });
      return NextResponse.json({ error: "Goal kon niet volledig worden opgeslagen. Probeer opnieuw." }, { status: 500 });
    }
  }
  return NextResponse.json({ tag }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizedMatch(params.id);
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null) as { tagId?: string; name?: string; startTime?: number; endTime?: number } | null;
  const name = body?.name?.trim();
  const changesName = typeof name === "string" && name.length > 0;
  const changesTimes = typeof body?.startTime === "number" && Number.isFinite(body.startTime)
    && typeof body.endTime === "number" && Number.isFinite(body.endTime);
  if (!body?.tagId || (!changesName && !changesTimes)) return NextResponse.json({ error: "Ongeldige tagwijziging." }, { status: 400 });
  const { data: tag } = await auth.admin.from("tags").select("id, video_id").eq("id", body.tagId).maybeSingle();
  if (!tag) return NextResponse.json({ error: "Tag niet gevonden." }, { status: 404 });
  const { data: link } = await auth.admin.from("match_videos").select("id")
    .eq("match_id", auth.match.id).eq("video_id", tag.video_id).maybeSingle();
  if (!link) return NextResponse.json({ error: "Tag hoort niet bij deze wedstrijd." }, { status: 403 });
  const update: { name?: string; color?: string; start_time?: number; end_time?: number } = {};
  if (changesName) { update.name = name; update.color = getTagColor(name); }
  if (changesTimes) {
    const startTime = Math.max(0, body.startTime as number);
    const endTime = Math.max(startTime, body.endTime as number);
    if (endTime - startTime > 180) return NextResponse.json({ error: "De tag is te lang." }, { status: 400 });
    update.start_time = startTime;
    update.end_time = endTime;
  }
  const { data: updated, error } = await auth.admin.from("tags").update(update).eq("id", tag.id).select("*").single();
  if (error || !updated) {
    console.error("Match tag rename failed", { matchId: auth.match.id, tagId: tag.id, userId: auth.user.id, error: error?.message });
    return NextResponse.json({ error: error?.message || "Tag kon niet worden hernoemd." }, { status: 500 });
  }
  if (changesName) {
    const { error: liveTagError } = await auth.admin.from("live_match_tags").update({ tag_name: name }).eq("match_id", auth.match.id).eq("tag_id", tag.id);
    if (liveTagError) console.error("Linked live tag rename failed", { matchId: auth.match.id, tagId: tag.id, error: liveTagError.message });
  }
  return NextResponse.json({ tag: updated });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizedMatch(params.id);
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null) as { tagId?: string } | null;
  if (!body?.tagId) return NextResponse.json({ error: "Ongeldige tag." }, { status: 400 });

  const { data: tag } = await auth.admin.from("tags").select("id, video_id").eq("id", body.tagId).maybeSingle();
  if (!tag) return NextResponse.json({ error: "Tag niet gevonden." }, { status: 404 });
  const { data: link } = await auth.admin.from("match_videos").select("id")
    .eq("match_id", auth.match.id).eq("video_id", tag.video_id).maybeSingle();
  if (!link) return NextResponse.json({ error: "Tag hoort niet bij deze wedstrijd." }, { status: 403 });

  const { error: liveTagError } = await auth.admin.from("live_match_tags")
    .delete().eq("match_id", auth.match.id).eq("tag_id", tag.id);
  if (liveTagError) return NextResponse.json({ error: liveTagError.message }, { status: 500 });
  const { error } = await auth.admin.from("tags").delete().eq("id", tag.id);
  if (error) return NextResponse.json({ error: error.message || "Tag kon niet worden verwijderd." }, { status: 500 });
  return NextResponse.json({ deleted: true, tagId: tag.id });
}
