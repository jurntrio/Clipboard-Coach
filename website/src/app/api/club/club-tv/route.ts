import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

async function context(manage = false) {
  const c = await getClubContext();
  if (!c.user || !c.activeClubId) return null;
  const access = await getClubAccess(c.activeClubId, c.user);
  if (!hasClubPermission(access, manage ? "sponsors.manage" : "sponsors.view"))
    return null;
  return { clubId: c.activeClubId, userId: c.user.id };
}
export async function GET() {
  const ctx = await context();
  if (!ctx)
    return NextResponse.json(
      { error: "Geen toegang tot Club TV." },
      { status: 403 },
    );
  const admin = createAdminClient();
  const [{ data: screens, error }, { data: matches }, { data: teams }] =
    await Promise.all([
      admin
        .from("club_tv_screens")
        .select("*, club_tv_blocks(*)")
        .eq("club_id", ctx.clubId)
        .order("name"),
      admin
        .from("matches")
        .select(
          "id,team_a_name,team_b_name,match_date,start_time,status,score_a,score_b",
        )
        .eq("club_id", ctx.clubId)
        .order("match_date", { ascending: false })
        .limit(100),
      admin
        .from("club_teams")
        .select(
          "id,name,age_category,status,season_id,club_seasons!club_teams_season_id_fkey(name,status)",
        )
        .eq("club_id", ctx.clubId)
        .eq("status", "active")
        .order("name"),
    ]);
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({
        screens: screens ?? [],
        matches: matches ?? [],
        teams: teams ?? [],
        clubId: ctx.clubId,
        canManage: !!(await context(true)),
      });
}
export async function POST(request: Request) {
  const ctx = await context(true);
  if (!ctx)
    return NextResponse.json(
      { error: "Geen recht om Club TV te beheren." },
      { status: 403 },
    );
  const body = await request.json(),
    admin = createAdminClient();
  if (body.action === "createScreen") {
    const name = String(body.name || "").trim();
    if (!name)
      return NextResponse.json(
        { error: "Schermnaam is verplicht." },
        { status: 400 },
      );
    const { data, error } = await admin
      .from("club_tv_screens")
      .insert({
        club_id: ctx.clubId,
        name,
        location: String(body.location || "").trim() || null,
        created_by: ctx.userId,
      })
      .select("id,public_token")
      .single();
    return error
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : NextResponse.json(data, { status: 201 });
  }
  if (body.action === "saveScreen") {
    const updates = {
      name: String(body.name || "").trim(),
      location: String(body.location || "").trim() || null,
      orientation: ["landscape", "portrait"].includes(body.orientation)
        ? body.orientation
        : "landscape",
      transition_effect: ["fade", "slide", "zoom", "none"].includes(
        body.transitionEffect,
      )
        ? body.transitionEffect
        : "fade",
      slide_duration_seconds: Math.max(
        2,
        Math.min(120, Number(body.slideDuration) || 8),
      ),
      show_clock: body.showClock !== false,
      active: body.active !== false,
    };
    const { error } = await admin
      .from("club_tv_screens")
      .update(updates)
      .eq("id", body.screenId)
      .eq("club_id", ctx.clubId);
    return error
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : NextResponse.json({ ok: true });
  }
  if (body.action === "addBlock") {
    const { data: screen } = await admin
      .from("club_tv_screens")
      .select("id")
      .eq("id", body.screenId)
      .eq("club_id", ctx.clubId)
      .maybeSingle();
    if (!screen)
      return NextResponse.json(
        { error: "Scherm niet gevonden." },
        { status: 404 },
      );
    const allowed = [
      "match",
      "match_header",
      "main_sponsors",
      "sponsors",
      "match_sponsors",
      "ball_donors",
      "players",
      "image",
    ];
    const type = allowed.includes(body.blockType) ? body.blockType : "sponsors";
    const { error } = await admin
      .from("club_tv_blocks")
      .insert({
        screen_id: screen.id,
        block_type: type,
        title: String(body.title || "").trim() || null,
        display_order: Number(body.displayOrder) || 0,
        configuration:
          body.configuration && typeof body.configuration === "object"
            ? body.configuration
            : {},
      });
    return error
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : NextResponse.json({ ok: true }, { status: 201 });
  }
  if (body.action === "updateBlock") {
    const { data: screen } = await admin
      .from("club_tv_screens")
      .select("id")
      .eq("id", body.screenId)
      .eq("club_id", ctx.clubId)
      .maybeSingle();
    if (!screen)
      return NextResponse.json(
        { error: "Scherm niet gevonden." },
        { status: 404 },
      );
    const updates: Record<string, unknown> = {};
    if (body.configuration && typeof body.configuration === "object")
      updates.configuration = body.configuration;
    if (typeof body.title === "string")
      updates.title = body.title.trim() || null;
    if (Number.isFinite(Number(body.displayOrder)))
      updates.display_order = Number(body.displayOrder);
    const { data: updatedBlock, error } = await admin
      .from("club_tv_blocks")
      .update(updates)
      .eq("id", body.blockId)
      .eq("screen_id", screen.id)
      .select("id,title,display_order,configuration")
      .maybeSingle();
    if (!error && !updatedBlock)
      return NextResponse.json(
        { error: "Inhoudsblok niet gevonden of niet bijgewerkt." },
        { status: 404 },
      );
    return error
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : NextResponse.json({ ok: true, block: updatedBlock });
  }
  if (body.action === "removeBlock") {
    const { data: screen } = await admin
      .from("club_tv_screens")
      .select("id")
      .eq("id", body.screenId)
      .eq("club_id", ctx.clubId)
      .maybeSingle();
    if (!screen)
      return NextResponse.json(
        { error: "Scherm niet gevonden." },
        { status: 404 },
      );
    const { error } = await admin
      .from("club_tv_blocks")
      .delete()
      .eq("id", body.blockId)
      .eq("screen_id", screen.id);
    return error
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : NextResponse.json({ ok: true });
  }
  if (body.action === "regenerateToken") {
    const { data, error } = await admin
      .from("club_tv_screens")
      .update({ public_token: crypto.randomUUID() })
      .eq("id", body.screenId)
      .eq("club_id", ctx.clubId)
      .select("public_token")
      .single();
    return error
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : NextResponse.json(data);
  }
  return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
}
