import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTagColor } from "@/lib/utils";

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
    tagName?: string; taggerName?: string; clientEventId?: string;
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
  const taggerName = body?.taggerName?.trim().slice(0, 80) || null;
  const clientEventId = body?.clientEventId?.trim() ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientEventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  // Live tagging captures moments only. Goal details are completed in the video viewer.
  const { data, error } = await supabase.from("live_match_tags").upsert({
    match_id: link.matches.id,
    link_id: link.id,
    tag_name: tagName,
    player_ids: [],
    tagger_name: taggerName,
    client_event_id: clientEventId,
    event_type: null,
    score_home: null,
    score_away: null,
    scorer_id: null
  }, { onConflict: "link_id,client_event_id" }).select("id, occurred_at").single();
  if (error) return NextResponse.json({ error: "Tag could not be saved" }, { status: 500 });
  return NextResponse.json({ ...data, color: getTagColor(tagName) });
}
