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
  const canPrepare = hasClubPermission(access, "games.planning.manage") || hasClubPermission(access, "games.selection.manage")
    || hasClubPermission(access, "games.tag") || hasClubPermission(access, "games.tag_link.create");
  if (!canPrepare) return { response: NextResponse.json({ error: "Geen recht om deze wedstrijd voor te bereiden." }, { status: 403 }) };
  return { admin, match, access };
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await context(params.id);
  if ("response" in ctx) return ctx.response;
  const canPlan = hasClubPermission(ctx.access, "games.planning.manage");
  const canSelect = hasClubPermission(ctx.access, "games.selection.manage");
  const canTags = hasClubPermission(ctx.access, "games.tag");
  const canCreateTagLink = hasClubPermission(ctx.access, "games.tag_link.create");
  const [{ data: options }, { data: selections }, { data: team }] = await Promise.all([
    canPlan || canSelect ? ctx.admin.from("club_match_options").select("*").eq("club_id", ctx.match.club_id).eq("active", true).order("label") : Promise.resolve({ data: [] }),
    canSelect ? ctx.admin.from("match_player_selections").select("*").eq("match_id", params.id) : Promise.resolve({ data: [] }),
    canSelect && ctx.match.team_a_id
      ? ctx.admin.from("teams").select("id, players(*)").eq("id", ctx.match.team_a_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);
  const allowedPlayerIds = ctx.access.goalkeeperPlayerIds;
  return NextResponse.json({
    match: allowedPlayerIds === null ? ctx.match : { ...ctx.match, player_ids: (ctx.match.player_ids ?? []).filter((id: string) => allowedPlayerIds.has(id)) },
    options: options ?? [], selections: allowedPlayerIds === null ? selections ?? [] : (selections ?? []).filter((selection) => allowedPlayerIds.has(selection.player_id)),
    players: allowedPlayerIds === null ? team?.players ?? [] : (team?.players ?? []).filter((player) => allowedPlayerIds.has(player.id)),
    extraPlayers: [], guestPlayers: [], capabilities: { canPlan, canSelect, canTags, canCreateTagLink }
  });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const ctx = await context(params.id);
  if ("response" in ctx) return ctx.response;
  const canPlan = hasClubPermission(ctx.access, "games.planning.manage");
  const canSelect = hasClubPermission(ctx.access, "games.selection.manage");
  const canTags = hasClubPermission(ctx.access, "games.tag");
  const body = await request.json().catch(() => null) as Record<string, any> | null;
  const time = (value: unknown) => typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : null;
  const id = (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  const selectedRows = Array.isArray(body?.players) ? body.players.slice(0, 100).flatMap((row: any) => {
    if (!id(row?.playerId)) return [];
    return [{
      match_id: params.id, player_id: row.playerId, selected: row.selected === true,
      jersey_number: Number.isInteger(row.jerseyNumber) && row.jerseyNumber >= 0 && row.jerseyNumber <= 99 ? row.jerseyNumber : null,
      non_selection_reason_id: row.selected === true ? null : id(row.reasonId),
      note: typeof row.note === "string" ? row.note.trim().slice(0, 500) || null : null,
      updated_at: new Date().toISOString()
    }];
  }) : [];

  if (canSelect && !ctx.match.team_a_id) return NextResponse.json({ error: "Match has no linked team." }, { status: 400 });
  if (canSelect && selectedRows.length) {
    const { data: rosterPlayers } = await ctx.admin.from("players").select("id, team_id").in("id", selectedRows.map((row: any) => row.player_id));
    const validIds = new Set((rosterPlayers ?? []).filter(player => player.team_id === ctx.match.team_a_id).map(player => player.id));
    if (validIds.size !== new Set(selectedRows.map((row: any) => row.player_id)).size) {
      return NextResponse.json({ error: "Ongeldige spelerselectie." }, { status: 400 });
    }
    if (ctx.access.goalkeeperPlayerIds !== null && selectedRows.some((row: any) => !ctx.access.goalkeeperPlayerIds?.has(row.player_id))) {
      return NextResponse.json({ error: "Je kunt alleen toegewezen doelmannen in de selectie wijzigen." }, { status: 403 });
    }
  }

  const optionIds = [
    ...(canPlan ? [id(body?.fieldOptionId), id(body?.lockerRoomOptionId), id(body?.visitorLockerRoomOptionId), id(body?.refereeOptionId), body?.meetingPlaceEnabled === true ? id(body?.meetingPlaceOptionId) : null] : []),
    ...(canSelect ? selectedRows.map((row: any) => row.non_selection_reason_id) : [])
  ].filter((value): value is string => !!value);
  if (optionIds.length) {
    const { data: validOptions } = await ctx.admin.from("club_match_options").select("id").eq("club_id", ctx.match.club_id).eq("active", true).in("id", optionIds);
    if (new Set(validOptions?.map(option => option.id)).size !== new Set(optionIds).size) {
      return NextResponse.json({ error: "Ongeldige clubinstelling." }, { status: 400 });
    }
  }

  const isHomeMatch = ctx.match.is_home_match !== false;
  const tags = Array.isArray(body?.tagNames)
    ? body.tagNames.filter((value: unknown): value is string => typeof value === "string").map((value: string) => value.trim().slice(0, 60)).filter(Boolean).slice(0, 30)
    : [];
  const update = {
    ...(canPlan ? {
      meeting_time_enabled: body?.meetingTimeEnabled === true,
      meeting_time: body?.meetingTimeEnabled === true ? time(body?.meetingTime) : null,
      departure_time_enabled: !isHomeMatch && body?.departureTimeEnabled === true,
      departure_time: !isHomeMatch && body?.departureTimeEnabled === true ? time(body?.departureTime) : null,
      field_option_id: isHomeMatch ? id(body?.fieldOptionId) : null,
      locker_room_option_id: isHomeMatch ? id(body?.lockerRoomOptionId) : null,
      visitor_locker_room_option_id: isHomeMatch ? id(body?.visitorLockerRoomOptionId) : null,
      referee_option_id: id(body?.refereeOptionId),
      meeting_place_option_id: body?.meetingPlaceEnabled === true ? id(body?.meetingPlaceOptionId) : null,
      meeting_place_custom: body?.meetingPlaceEnabled === true && typeof body?.meetingPlaceCustom === "string" ? body.meetingPlaceCustom.trim().slice(0, 150) || null : null,
      ...(canTags ? { live_tag_names: tags } : {})
    } : {}),
    ...(canSelect ? { player_ids: ctx.access.goalkeeperPlayerIds === null
      ? selectedRows.filter((row: any) => row.selected).map((row: any) => row.player_id)
      : [
          ...((ctx.match.player_ids ?? []) as string[]).filter((playerId) => !ctx.access.goalkeeperPlayerIds?.has(playerId)),
          ...selectedRows.filter((row: any) => row.selected).map((row: any) => row.player_id)
        ]
    } : {})
  };
  const { error } = await ctx.admin.from("matches").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (canSelect && selectedRows.length) {
    const { error: selectionError } = await ctx.admin.from("match_player_selections").upsert(selectedRows, { onConflict: "match_id,player_id" });
    if (selectionError) return NextResponse.json({ error: selectionError.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
