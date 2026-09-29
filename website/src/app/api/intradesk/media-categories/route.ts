import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = { action?: "create" | "rename" | "activate" | "deactivate" | "assign"; id?: string; name?: string; clipId?: string; categoryId?: string; assigned?: boolean };

async function authorize() {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return null;
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!['club_admin', 'platform_admin'].includes(access.role) || access.readOnly) return null;
  return { userId: context.user.id, clubId: context.activeClubId, admin: createAdminClient() };
}

async function categoryRows(admin: ReturnType<typeof createAdminClient>, clubId: string) {
  const { data } = await admin.from("media_categories").select("id,name,is_active,is_default").eq("club_id", clubId).order("name");
  return (data ?? []).map(item => ({ id: item.id, name: item.name, active: item.is_active, isDefault: item.is_default }));
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (!auth) return NextResponse.json({ error: "Alleen een clubbeheerder kan mediacategorieën beheren." }, { status: 403 });
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.action) return NextResponse.json({ error: "Ongeldige actie." }, { status: 400 });

  if (body.action === "create") {
    const name = body.name?.trim();
    if (!name || name.length > 80) return NextResponse.json({ error: "Geef een categorienaam van maximaal 80 tekens op." }, { status: 400 });
    const { error } = await auth.admin.from("media_categories").insert({ club_id: auth.clubId, name, created_by: auth.userId });
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Deze categorie bestaat al." : error.message }, { status: 400 });
  } else if (body.action === "rename") {
    const name = body.name?.trim();
    if (!body.id || !name || name.length > 80) return NextResponse.json({ error: "Geef een geldige categorie en naam op." }, { status: 400 });
    const { error } = await auth.admin.from("media_categories").update({ name, updated_at: new Date().toISOString() }).eq("id", body.id).eq("club_id", auth.clubId);
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Deze categorie bestaat al." : error.message }, { status: 400 });
  } else if (body.action === "activate" || body.action === "deactivate") {
    if (!body.id) return NextResponse.json({ error: "Categorie ontbreekt." }, { status: 400 });
    const { error } = await auth.admin.from("media_categories").update({ is_active: body.action === "activate", updated_at: new Date().toISOString() }).eq("id", body.id).eq("club_id", auth.clubId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (body.action === "assign") {
    if (!body.clipId || !body.categoryId || typeof body.assigned !== "boolean") return NextResponse.json({ error: "Clip, categorie of keuze ontbreekt." }, { status: 400 });
    const [{ data: category }, { data: clip }] = await Promise.all([
      auth.admin.from("media_categories").select("id").eq("id", body.categoryId).eq("club_id", auth.clubId).maybeSingle(),
      auth.admin.from("clips").select("id,video_id,team_id").eq("id", body.clipId).maybeSingle()
    ]);
    const { data: matchLink } = clip ? await auth.admin.from("match_videos").select("id,matches!inner(club_id)").eq("video_id", clip.video_id).eq("matches.club_id", auth.clubId).limit(1).maybeSingle() : { data: null };
    const { data: teamLink } = clip?.team_id ? await auth.admin.from("teams").select("id,club_teams!inner(club_id)").eq("id", clip.team_id).eq("club_teams.club_id", auth.clubId).maybeSingle() : { data: null };
    if (!category || !clip || (!matchLink && !teamLink)) return NextResponse.json({ error: "Clip of categorie behoort niet tot de actieve club." }, { status: 404 });
    const query = auth.admin.from("clip_media_categories");
    const { error } = body.assigned
      ? await query.upsert({ clip_id: body.clipId, category_id: body.categoryId, assigned_by: auth.userId })
      : await query.delete().eq("clip_id", body.clipId).eq("category_id", body.categoryId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ categories: await categoryRows(auth.admin, auth.clubId) });
}
