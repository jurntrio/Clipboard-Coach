import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTagColor } from "@/lib/utils";
import { getTagEventKind } from "@/lib/tag-events";

function brusselsKickoff(date: string | null, time: string | null) {
  if (!date || !time) return null;
  const target = `${date}T${time.slice(0, 5)}:${time.slice(6, 8) || "00"}`;
  const candidate = new Date(`${target}+02:00`);
  if (Number.isNaN(candidate.getTime())) return null;
  const localHour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels", hour: "2-digit", hour12: false
  }).format(candidate));
  const requestedHour = Number(time.slice(0, 2));
  if (localHour === requestedHour) return candidate;
  return new Date(candidate.getTime() + (requestedHour - localHour) * 60 * 60 * 1000);
}

async function loadLink(token: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("match_tag_links")
    .select("id, active, matches(id, team_a_name, team_b_name, is_home_match, match_date, start_time, status, score_a, score_b, live_tag_names, player_ids)")
    .eq("token", token)
    .eq("active", true)
    .single();
  const link = data as any;
  const today = new Date().toISOString().slice(0, 10);
  const hasEnded = link?.matches?.status === "finished" || (link?.matches?.match_date && link.matches.match_date < today);
  return { supabase, link: hasEnded ? null : link };
}

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const { supabase, link } = await loadLink(params.token);
  if (!link?.matches) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const playerIds = link.matches.player_ids ?? [];
  const { data: players } = playerIds.length
    ? await supabase.from("players").select("id, first_name, last_name, jersey_number").in("id", playerIds)
    : { data: [] };
  return NextResponse.json({ match: link.matches, players: players ?? [] });
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const { supabase, link } = await loadLink(params.token);
  if (!link?.matches) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const body = await request.json().catch(() => null) as {
    tagName?: string; playerIds?: string[]; taggerName?: string; clientEventId?: string;
    goal?: { eventType?: string; scorerId?: string | null; homeScore?: number; awayScore?: number };
  } | null;
  const tagName = body?.tagName?.trim() ?? "";
  const allowedTags = (link.matches.live_tag_names ?? []) as string[];
  if (!tagName || !allowedTags.includes(tagName)) return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  const kickoff = brusselsKickoff(link.matches.match_date, link.matches.start_time);
  if (kickoff && Date.now() < kickoff.getTime()) {
    return NextResponse.json({ error: "De wedstrijd is nog niet begonnen." }, { status: 409 });
  }
  if (kickoff) {
    await supabase.from("live_match_tags").delete()
      .eq("match_id", link.matches.id)
      .lt("occurred_at", kickoff.toISOString());
  }
  const allowedPlayers = new Set((link.matches.player_ids ?? []) as string[]);
  let playerIds = (body?.playerIds ?? []).filter((id) => allowedPlayers.has(id)).slice(0, 4);
  const taggerName = body?.taggerName?.trim().slice(0, 80) || null;
  const clientEventId = body?.clientEventId?.trim() ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientEventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  const isGoal = getTagEventKind(tagName) === "goal";
  const goalType = body?.goal?.eventType === "goal_against" ? "goal_against" : body?.goal?.eventType === "goal_for" ? "goal_for" : null;
  const homeScore = Number(body?.goal?.homeScore);
  const awayScore = Number(body?.goal?.awayScore);
  if (isGoal && (!goalType || !Number.isInteger(homeScore) || homeScore < 0 || homeScore > 30 || !Number.isInteger(awayScore) || awayScore < 0 || awayScore > 30)) {
    return NextResponse.json({ error: "Vul een geldige stand na de goal in." }, { status: 400 });
  }
  const scorerId = isGoal && goalType === "goal_for" && typeof body?.goal?.scorerId === "string" && allowedPlayers.has(body.goal.scorerId)
    ? body.goal.scorerId : null;
  if (isGoal) playerIds = scorerId ? [scorerId] : [];

  const { data, error } = await supabase.from("live_match_tags").upsert({
    match_id: link.matches.id,
    link_id: link.id,
    tag_name: tagName,
    player_ids: playerIds,
    tagger_name: taggerName,
    client_event_id: clientEventId,
    event_type: isGoal ? goalType : null,
    score_home: isGoal ? homeScore : null,
    score_away: isGoal ? awayScore : null,
    scorer_id: scorerId
  }, { onConflict: "link_id,client_event_id" }).select("id, occurred_at").single();
  if (error) return NextResponse.json({ error: "Tag could not be saved" }, { status: 500 });
  if (isGoal && goalType) {
    const ownTeamSide = link.matches.is_home_match ? "home" : "away";
    const scoringSide = goalType === "goal_for" ? ownTeamSide : ownTeamSide === "home" ? "away" : "home";
    const minute = kickoff ? Math.max(0, Math.min(120, Math.floor((new Date(data.occurred_at).getTime() - kickoff.getTime()) / 60_000) + 1)) : null;
    const { data: dossier } = await supabase.from("match_dossiers").select("goal_events").eq("match_id", link.matches.id).maybeSingle();
    const existingEvents = Array.isArray(dossier?.goal_events) ? dossier.goal_events as Array<Record<string, unknown>> : [];
    const goalEvent = {
      id: `live-goal-${data.id}`, liveTagId: data.id, team: scoringSide, scoreAfter: `${homeScore}-${awayScore}`, minute,
      scorerType: scorerId ? "player" : "", scorerPlayerId: scorerId ?? "", scorerName: "",
      assistType: "none", assistPlayerId: "", assistName: "", description: ""
    };
    const nextEvents = existingEvents.some((event) => event.liveTagId === data.id)
      ? existingEvents.map((event) => event.liveTagId === data.id ? goalEvent : event)
      : [...existingEvents, goalEvent];
    const dossierResult = dossier
      ? await supabase.from("match_dossiers").update({ goal_events: nextEvents, updated_at: new Date().toISOString() }).eq("match_id", link.matches.id)
      : await supabase.from("match_dossiers").insert({ match_id: link.matches.id, goal_events: nextEvents });
    if (dossierResult.error) return NextResponse.json({ error: "De goal werd getagd, maar kon niet aan het wedstrijdverslag worden toegevoegd." }, { status: 500 });
    const internalScore = link.matches.is_home_match ? { score_a: homeScore, score_b: awayScore } : { score_a: awayScore, score_b: homeScore };
    const { error: scoreError } = await supabase.from("matches").update(internalScore).eq("id", link.matches.id);
    if (scoreError) return NextResponse.json({ error: "De goal werd getagd, maar de stand kon niet worden bijgewerkt." }, { status: 500 });
    return NextResponse.json({ ...data, color: getTagColor(tagName), scoreA: internalScore.score_a, scoreB: internalScore.score_b });
  }
  return NextResponse.json({ ...data, color: getTagColor(tagName) });
}
