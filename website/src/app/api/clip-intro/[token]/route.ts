import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { getIntroContext, writeIntro } from "@/lib/clip-intro-storage";
import { defaultClipIntro, parseClipIntro } from "@/lib/clip-intro";
import { getPublicUrl, getUploadUrl } from "@/lib/r2/upload";

async function context(token: string) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return null;
  const db = createAdminClient();
  const { data: link } = await db.from("share_links").select("clip_id,expires_at").eq("token", token).maybeSingle();
  if (!link || (link.expires_at && new Date(link.expires_at) < new Date())) return null;
  const { data: clip } = await db.from("clips").select("id,coach_id,video_id,team_id").eq("id", link.clip_id).single();
  if (!clip) return null;
  const intro = await getIntroContext(clip);
  const access = intro.clubId ? await getClubAccess(intro.clubId, user) : null;
  const canShare = !!access && !access.readOnly && canAccessTeam(access, intro.teamId) && hasClubPermission(access, "clips.share");
  if (clip.coach_id !== user.id && !canShare) return null;
  const canSaveDefaults = !!access && !access.readOnly && canAccessTeam(access, intro.teamId) && hasClubPermission(access, "sponsors.manage");
  return { ...intro, clipId: clip.id, canSaveDefaults, userId: user.id };
}

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const data = await context(params.token);
    if (!data) return NextResponse.json({ error: "Geen recht om dit introbeeld te wijzigen." }, { status: 403 });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Introbeeld kon niet worden geladen. Probeer opnieuw." }, { status: 500 }); }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const data = await context(params.token);
    if (!data) return NextResponse.json({ error: "Geen recht om dit introbeeld te wijzigen." }, { status: 403 });
    const body = await request.json();
    if (body.action === "upload") {
      const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
      if (!extensions[body.contentType] || !Number.isFinite(body.size) || body.size <= 0 || body.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Kies een PNG, JPEG of WebP van maximaal 5 MB." }, { status: 400 });
      const key = `clip-intros/assets/${data.clipId}/${crypto.randomUUID()}.${extensions[body.contentType]}`;
      return NextResponse.json({ uploadUrl: await getUploadUrl(key, body.contentType), publicUrl: getPublicUrl(key) });
    }
    if ((body.saveMatch || body.saveTeam) && !data.canSaveDefaults) return NextResponse.json({ error: "Geen recht om standaardinstellingen te wijzigen." }, { status: 403 });
    let settings;
    try { settings = parseClipIntro(body.settings); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ongeldig introbeeld." }, { status: 400 }); }
    if (body.saveMatch && data.matchId) await writeIntro("match", data.matchId, settings);
    if (body.saveTeam && data.teamId) await writeIntro("team", data.teamId, { ...defaultClipIntro, enabled: settings.enabled, duration: settings.duration });
    await writeIntro("clip", data.clipId, settings);
    return NextResponse.json({ saved: true });
  } catch { return NextResponse.json({ error: "Introbeeld kon niet worden bewaard. Probeer opnieuw." }, { status: 500 }); }
}
