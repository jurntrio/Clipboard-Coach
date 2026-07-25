import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTagColor } from "@/lib/utils";

async function loadLink(token: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("match_tag_links")
    .select("id, active, matches(id, team_a_name, team_b_name, match_date, start_time, status, live_tag_names, player_ids)")
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
  const body = await request.json().catch(() => null) as { tagName?: string; playerIds?: string[]; taggerName?: string } | null;
  const tagName = body?.tagName?.trim() ?? "";
  const allowedTags = (link.matches.live_tag_names ?? []) as string[];
  if (!tagName || !allowedTags.includes(tagName)) return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  const allowedPlayers = new Set((link.matches.player_ids ?? []) as string[]);
  const playerIds = (body?.playerIds ?? []).filter((id) => allowedPlayers.has(id)).slice(0, 4);
  const taggerName = body?.taggerName?.trim().slice(0, 80) || null;
  const { data, error } = await supabase.from("live_match_tags").insert({
    match_id: link.matches.id,
    link_id: link.id,
    tag_name: tagName,
    player_ids: playerIds,
    tagger_name: taggerName
  }).select("id, occurred_at").single();
  if (error) return NextResponse.json({ error: "Tag could not be saved" }, { status: 500 });
  return NextResponse.json({ ...data, color: getTagColor(tagName) });
}
