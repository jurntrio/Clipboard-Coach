import { NextResponse } from "next/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { getClubContext } from "@/lib/auth/active-club";
import { deleteObject, getPublicUrl, getUploadUrl } from "@/lib/r2/upload";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const maxSize = 15 * 1024 * 1024;

async function authorizedSession(sessionId: string) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return null;
  const admin = createAdminClient();
  const { data: session } = await admin.from("team_training_sessions")
    .select("id, club_id, club_team_id, player_group_id, staff_ids, attachment_key")
    .eq("id", sessionId).eq("club_id", context.activeClubId).maybeSingle();
  if (!session) return null;
  const access = await getClubAccess(context.activeClubId, context.user);
  if (access.readOnly || !hasClubPermission(access, "training.manage")) return null;
  const { data: trainer } = await admin.from("club_trainers").select("id")
    .eq("club_id", context.activeClubId).eq("profile_id", context.user.id).maybeSingle();
  const assignedStaff = session.staff_ids.includes(trainer?.id ?? "");
  const { count: groupCount } = session.player_group_id && trainer
    ? await admin.from("player_group_staff").select("group_id", { count: "exact", head: true }).eq("group_id", session.player_group_id).eq("trainer_id", trainer.id)
    : { count: 0 };
  if (!canAccessTeam(access, session.club_team_id) && !groupCount && !assignedStaff && access.teamIds !== null) return null;
  return { admin, session };
}

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  const auth = await authorizedSession(params.sessionId);
  if (!auth) return NextResponse.json({ error: "Geen toegang tot deze training." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (body?.action === "prepare") {
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const size = typeof body.size === "number" ? body.size : 0;
    if (!allowedTypes.has(contentType) || size <= 0 || size > maxSize) return NextResponse.json({ error: "Kies een PDF, JPEG, PNG of WebP van maximaal 15 MB." }, { status: 400 });
    const extension = contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const key = `training-attachments/${auth.session.club_id}/${auth.session.id}/${crypto.randomUUID()}.${extension}`;
    return NextResponse.json({ key, publicUrl: getPublicUrl(key), uploadUrl: await getUploadUrl(key, contentType) });
  }
  if (body?.action === "confirm") {
    const key = typeof body.key === "string" ? body.key : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 180) : "";
    const prefix = `training-attachments/${auth.session.club_id}/${auth.session.id}/`;
    if (!key.startsWith(prefix) || !allowedTypes.has(contentType) || !name) return NextResponse.json({ error: "Ongeldige bijlage." }, { status: 400 });
    const previousKey = auth.session.attachment_key;
    const attachmentUrl = getPublicUrl(key);
    const { error } = await auth.admin.from("team_training_sessions").update({ attachment_url: attachmentUrl, attachment_key: key, attachment_name: name, attachment_content_type: contentType }).eq("id", auth.session.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (previousKey && previousKey !== key) await deleteObject(previousKey).catch(() => undefined);
    return NextResponse.json({ attachment: { url: attachmentUrl, name, contentType } });
  }
  return NextResponse.json({ error: "Ongeldige actie." }, { status: 400 });
}

export async function DELETE(_request: Request, { params }: { params: { sessionId: string } }) {
  const auth = await authorizedSession(params.sessionId);
  if (!auth) return NextResponse.json({ error: "Geen toegang tot deze training." }, { status: 403 });
  const previousKey = auth.session.attachment_key;
  const { error } = await auth.admin.from("team_training_sessions").update({ attachment_url: null, attachment_key: null, attachment_name: null, attachment_content_type: null }).eq("id", auth.session.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (previousKey) await deleteObject(previousKey).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
