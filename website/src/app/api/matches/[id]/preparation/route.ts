import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

async function context(matchId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).maybeSingle();
  if (!match?.club_id) return { response: NextResponse.json({ error: "Match not found" }, { status: 404 }) };
  const access = await getClubAccess(match.club_id, user);
  if (!hasClubPermission(access, "games.view") || !canAccessTeam(access, match.club_team_id)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin, match, access };
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await context(params.id);
  if ("response" in ctx) return ctx.response;
  const [{ data: options }, { data: selections }, { data: team }] = await Promise.all([
    ctx.admin.from("club_match_options").select("*").eq("club_id", ctx.match.club_id).eq("active", true).order("label"),
    ctx.admin.from("match_player_selections").select("*").eq("match_id", params.id),
    ctx.match.team_a_id
      ? ctx.admin.from("teams").select("id, players(*)").eq("id", ctx.match.team_a_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);
  return NextResponse.json({ match: ctx.match, options: options ?? [], selections: selections ?? [], players: team?.players ?? [] });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const ctx = await context(params.id);
  if ("response" in ctx) return ctx.response;
  if (!hasClubPermission(ctx.access, "games.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, any> | null;
  const time = (value: unknown) => typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : null;
  const id = (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  const selectedRows = Array.isArray(body?.players) ? body.players.slice(0, 100).flatMap((row: any) => {
    if (!id(row?.playerId)) return [];
    return [{
      match_id: params.id,
      player_id: row.playerId,
      selected: row.selected === true,
      jersey_number: Number.isInteger(row.jerseyNumber) && row.jerseyNumber >= 0 && row.jerseyNumber <= 99 ? row.jerseyNumber : null,
      non_selection_reason_id: row.selected === true ? null : id(row.reasonId),
      note: typeof row.note === "string" ? row.note.trim().slice(0, 500) || null : null,
      updated_at: new Date().toISOString()
    }];
  }) : [];
  if (selectedRows.length) {
    if (!ctx.match.team_a_id) return NextResponse.json({ error: "Match has no linked team." }, { status: 400 });
    const { data: rosterPlayers } = await ctx.admin.from("players").select("id").eq("team_id", ctx.match.team_a_id)
      .in("id", selectedRows.map((row: any) => row.player_id));
    if (new Set(rosterPlayers?.map(player => player.id)).size !== new Set(selectedRows.map((row: any) => row.player_id)).size) {
      return NextResponse.json({ error: "Invalid player selection." }, { status: 400 });
    }
  }
  const optionIds = [
    id(body?.fieldOptionId), id(body?.lockerRoomOptionId), id(body?.meetingPlaceOptionId),
    ...selectedRows.map((row: any) => row.non_selection_reason_id)
  ].filter((value): value is string => !!value);
  if (optionIds.length) {
    const { data: validOptions } = await ctx.admin.from("club_match_options").select("id")
      .eq("club_id", ctx.match.club_id).eq("active", true).in("id", optionIds);
    if (new Set(validOptions?.map(option => option.id)).size !== new Set(optionIds).size) {
      return NextResponse.json({ error: "Invalid club option." }, { status: 400 });
    }
  }
  const matchUpdate = {
    is_home_match: body?.isHomeMatch !== false,
    meeting_time_enabled: body?.meetingTimeEnabled === true,
    meeting_time: body?.meetingTimeEnabled === true ? time(body?.meetingTime) : null,
    departure_time_enabled: body?.departureTimeEnabled === true,
    departure_time: body?.departureTimeEnabled === true ? time(body?.departureTime) : null,
    field_option_id: body?.isHomeMatch !== false ? id(body?.fieldOptionId) : null,
    locker_room_option_id: body?.isHomeMatch !== false ? id(body?.lockerRoomOptionId) : null,
    meeting_place_option_id: id(body?.meetingPlaceOptionId),
    meeting_place_custom: typeof body?.meetingPlaceCustom === "string" ? body.meetingPlaceCustom.trim().slice(0, 150) || null : null,
    player_ids: selectedRows.filter((row: any) => row.selected).map((row: any) => row.player_id)
  };
  const { error } = await ctx.admin.from("matches").update(matchUpdate).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (selectedRows.length) {
    const { error: selectionError } = await ctx.admin.from("match_player_selections").upsert(selectedRows, { onConflict: "match_id,player_id" });
    if (selectionError) return NextResponse.json({ error: selectionError.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
