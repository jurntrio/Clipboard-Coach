import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { makeReportGoal, validateGoalRange } from "@/lib/goal-media";

async function authorize(matchId: string, write: boolean) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id,club_id,club_team_id,team_a_id,is_home_match").eq("id", matchId).maybeSingle();
  if (!match?.club_id) return { error: NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 }) };
  const access = await getClubAccess(match.club_id, user);
  const allowed = !write || !access.readOnly && (hasClubPermission(access, "games.tag") || hasClubPermission(access, "games.report.manage"));
  if (!allowed || !hasClubPermission(access, "games.view") || !hasClubPermission(access, "video.view") || !canAccessTeam(access, match.club_team_id)) {
    return { error: NextResponse.json({ error: "Geen toegang tot doelpuntbeelden." }, { status: 403 }) };
  }
  return { admin, match, user, access };
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id, false);
  if ("error" in auth) return auth.error;
  const { data: links, error: linksError } = await auth.admin.from("match_videos").select("video_id,videos(video_url)").eq("match_id", params.id);
  const ids = (links ?? []).map(link => link.video_id);
  const [dossier, media, tags, players] = await Promise.all([
    auth.admin.from("match_dossiers").select("goal_events").eq("match_id", params.id).maybeSingle(),
    auth.admin.from("match_goal_media").select("*,clips(id,render_status,render_error,rendered_segments)").eq("match_id", params.id),
    ids.length ? auth.admin.from("tags").select("id,video_id,name,event_type,event_metadata,start_time,end_time,occurred_at_seconds")
      .in("video_id", ids).or("event_type.in.(goal_for,goal_against),name.ilike.goal%") : Promise.resolve({ data: [], error: null }),
    auth.match.team_a_id ? auth.admin.from("players").select("id,first_name,last_name").eq("team_id", auth.match.team_a_id).eq("role", "player").order("last_name") : Promise.resolve({ data: [], error: null })
  ]);
  const error = linksError ?? dossier.error ?? media.error ?? tags.error ?? players.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goals: dossier.data?.goal_events ?? [], media: media.data ?? [], tags: tags.data ?? [], players: players.data ?? [], videos: links ?? [],
    canEdit: !auth.access.readOnly && (hasClubPermission(auth.access, "games.tag") || hasClubPermission(auth.access, "games.report.manage")) });
}

export async function POST(request: Request, context: { params: { id: string } }) { return save(request, context, false); }
export async function PATCH(request: Request, context: { params: { id: string } }) { return save(request, context, true); }
async function save(request: Request, { params }: { params: { id: string } }, editing: boolean) {
  const auth = await authorize(params.id, editing);
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json();
    if (body.saveClip && (auth.access.readOnly || !(hasClubPermission(auth.access, "games.tag") || hasClubPermission(auth.access, "games.report.manage")))) {
      return NextResponse.json({ error: "Geen recht om doelpuntclips te bewaren." }, { status: 403 });
    }
    if (typeof body.tagId !== "string") throw new Error("Kies een doelpunttag.");
    if (editing && (typeof body.mediaId !== "string" || typeof body.previousGoalId !== "string")) throw new Error("Kies de koppeling die je wilt bewerken.");
    const { data: tag } = await auth.admin.from("tags").select("id,video_id,name,event_type,start_time,end_time").eq("id", body.tagId).maybeSingle();
    if (!tag || (!/^goal(?:\s|$)/i.test(tag.name.trim()) && !["goal_for", "goal_against"].includes(tag.event_type))) throw new Error("Kies een doelpunttag.");
    const { data: videoLink } = await auth.admin.from("match_videos").select("video_id,videos(duration,video_url)").eq("match_id", params.id).eq("video_id", tag.video_id).maybeSingle();
    if (!videoLink) throw new Error("Deze tag hoort niet bij de wedstrijd.");
    const { data: dossier } = await auth.admin.from("match_dossiers").select("goal_events").eq("match_id", params.id).maybeSingle();
    const goals = Array.isArray(dossier?.goal_events) ? dossier.goal_events : [];
    const existing = body.goalId ? goals.find((goal: { id: string }) => goal.id === body.goalId) : null;
    if (body.goalId && !existing) throw new Error("Doelpunt niet gevonden. Vernieuw de lijst.");
    if (existing) makeReportGoal({ scoreAfter: existing.scoreAfter, team: existing.team, minute: existing.minute });
    const ownSide = auth.match.is_home_match === false ? "away" : "home";
    const side = tag.event_type === "goal_for" ? ownSide : tag.event_type === "goal_against" ? (ownSide === "home" ? "away" : "home") : body.team;
    const goal = existing ? { ...existing,
      ...(!existing.scorerType && body.scorerId ? { scorerType: "player", scorerPlayerId: body.scorerId } : {}),
      ...(existing.assistType === "none" && body.assistId ? { assistType: "player", assistPlayerId: body.assistId } : {})
    } : makeReportGoal({ scoreAfter: body.scoreAfter, team: side, minute: body.minute, scorerId: body.scorerId, assistId: body.assistId });
    if (existing && existing.team !== side && tag.event_type) throw new Error("De scorende ploeg van deze tag en dit doelpunt verschillen.");
    if (editing) Object.assign(goal, { _relink_media_id: body.mediaId, _previous_goal_id: body.previousGoalId });
    const playerIds = [body.scorerId, body.assistId].filter((id): id is string => typeof id === "string" && !!id);
    if (playerIds.length) {
      if (body.scorerId && body.scorerId === body.assistId) throw new Error("De doelpuntenmaker kan niet ook de assistgever zijn.");
      const { data: players } = auth.match.team_a_id ? await auth.admin.from("players").select("id").eq("team_id", auth.match.team_a_id).in("id", playerIds) : { data: [] };
      if (playerIds.some(id => !(players ?? []).some(player => player.id === id))) throw new Error("Speler hoort niet bij deze ploeg.");
    }
    const video = (Array.isArray(videoLink.videos) ? videoLink.videos[0] : videoLink.videos) as { duration: number | null; video_url: string } | null;
    const range = body.saveClip ? validateGoalRange(body.startTime, body.endTime, video?.duration) : null;
    const { data, error } = await auth.admin.rpc("link_match_goal_media", {
      p_match_id: params.id, p_tag_id: tag.id, p_goal: goal, p_user_id: auth.user.id,
      p_create_clip: !!range, p_start: range?.start ?? null, p_end: range?.end ?? null
    });
    if (error) throw new Error(error.message.includes("TAG_ALREADY_LINKED") ? "Deze tag is al aan een ander doelpunt gekoppeld." : error.message.includes("STALE_GOAL_MEDIA") ? "Deze koppeling is intussen gewijzigd. Vernieuw de lijst." : error.message);
    return NextResponse.json({ ...data, videoId: tag.video_id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Doelpunt kon niet worden gekoppeld." }, { status: 400 });
  }
}
