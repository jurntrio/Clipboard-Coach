import { NextResponse } from "next/server";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function context(clubId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const access = await getClubAccess(clubId, user);
  if (!["club_admin", "platform_admin"].includes(access.role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin: createAdminClient() };
}

export async function GET(request: Request) {
  const clubId = new URL(request.url).searchParams.get("clubId") ?? "";
  const ctx = await context(clubId);
  if ("response" in ctx) return ctx.response;
  const { data, error } = await ctx.admin.from("club_live_tag_templates").select("*")
    .eq("club_id", clubId).order("display_order").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tags: data ?? [] });
}

export async function PUT(request: Request) {
  type TagInput = { name?: unknown; liveStartOffsetSeconds?: unknown; liveEndOffsetSeconds?: unknown };
  const body = await request.json().catch(() => null) as { clubId?: string; tags?: TagInput[] } | null;
  if (!body?.clubId || !Array.isArray(body.tags)) return NextResponse.json({ error: "Ongeldige tags." }, { status: 400 });
  const ctx = await context(body.clubId);
  if ("response" in ctx) return ctx.response;
  const tags = body.tags.slice(0, 30).flatMap((item, displayOrder) => {
    const name = typeof item?.name === "string" ? item.name.trim().slice(0, 60) : "";
    const start = Number(item?.liveStartOffsetSeconds);
    const end = Number(item?.liveEndOffsetSeconds);
    if (!name || !Number.isFinite(start) || !Number.isFinite(end) || start < -180 || end > 180 || end < start) return [];
    return [{ club_id: body.clubId, name, live_start_offset_seconds: start, live_end_offset_seconds: end, display_order: displayOrder, updated_at: new Date().toISOString() }];
  });
  if (tags.length !== body.tags.length || new Set(tags.map(tag => tag.name.toLocaleLowerCase("nl"))).size !== tags.length) {
    return NextResponse.json({ error: "Controleer de namen en seconden; tag-namen moeten uniek zijn." }, { status: 400 });
  }
  const { error: deleteError } = await ctx.admin.from("club_live_tag_templates").delete().eq("club_id", body.clubId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
  if (tags.length) {
    const { error } = await ctx.admin.from("club_live_tag_templates").insert(tags);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ tags });
}
