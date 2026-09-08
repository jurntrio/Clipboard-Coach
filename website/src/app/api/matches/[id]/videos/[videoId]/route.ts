import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { canManageMatchVideoSources } from "@/lib/auth/match-video-sources";

type UpdateVideoSourceBody = {
  video_url?: string;
  video_key?: string;
  title?: string;
  label?: string;
  camera_number?: number | null;
};

async function getManageableMatch(admin: ReturnType<typeof createAdminClient>, matchId: string, user: { id: string }) {
  const { data: match } = await admin.from("matches").select("id, coach_id, club_id, club_team_id").eq("id", matchId).maybeSingle();
  if (!match?.club_id) return { error: NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 }) };
  const access = await getClubAccess(match.club_id, user);
  const canManage = canManageMatchVideoSources({
    readOnly: access.readOnly,
    canAccessTeam: canAccessTeam(access, match.club_team_id),
    canManageVideoSources: hasClubPermission(access, "games.video_sources.manage"),
    role: access.role,
    matchCoachId: match.coach_id,
    userId: user.id
  });
  return canManage
    ? { match }
    : { error: NextResponse.json({ error: "Geen recht om wedstrijdbeelden te beheren." }, { status: 403 }) };
}

export async function PATCH(request: Request, { params }: { params: { id: string; videoId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const accessResult = await getManageableMatch(admin, params.id, user);
  if (accessResult.error) return accessResult.error;
  const match = accessResult.match!;
  const { data: link } = await admin.from("match_videos").select("id").eq("match_id", match.id).eq("video_id", params.videoId).maybeSingle();
  if (!link) return NextResponse.json({ error: "Videobron niet gevonden." }, { status: 404 });

  const body = await request.json().catch(() => null) as UpdateVideoSourceBody | null;
  const title = body?.title?.trim();
  const label = body?.label?.trim();
  const videoUrl = body?.video_url?.trim();
  const videoKey = body?.video_key?.trim();
  const cameraNumber = body?.camera_number;
  if (!body || !title || !label || (videoUrl !== undefined && !videoUrl.startsWith("https://"))
    || (cameraNumber !== null && cameraNumber !== undefined && (!Number.isInteger(cameraNumber) || cameraNumber < 1))) {
    return NextResponse.json({ error: "Ongeldige videobron." }, { status: 400 });
  }

  const videoChanges: Record<string, string | number | null> = { title, camera_number: cameraNumber ?? null };
  if (videoUrl !== undefined) videoChanges.video_url = videoUrl;
  if (videoKey) videoChanges.video_key = videoKey;
  const { data: video, error: videoError } = await admin.from("videos").update(videoChanges).eq("id", params.videoId).select("*").single();
  if (videoError || !video) return NextResponse.json({ error: videoError?.message || "Videobron kon niet worden gewijzigd." }, { status: 500 });
  const { error: linkError } = await admin.from("match_videos").update({ label }).eq("id", link.id);
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  return NextResponse.json({ video, label });
}

export async function DELETE(_request: Request, { params }: { params: { id: string; videoId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const accessResult = await getManageableMatch(admin, params.id, user);
  if (accessResult.error) return accessResult.error;
  const match = accessResult.match!;

  const { data: link } = await admin.from("match_videos").select("id, sequence_order, is_primary").eq("match_id", match.id).eq("video_id", params.videoId).maybeSingle();
  if (!link) return NextResponse.json({ error: "Videobron niet gevonden." }, { status: 404 });
  const { error } = await admin.from("match_videos").delete().eq("id", link.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (link.is_primary) {
    const { data: replacement } = await admin.from("match_videos").select("id")
      .eq("match_id", match.id).eq("sequence_order", link.sequence_order).order("created_at").limit(1).maybeSingle();
    if (replacement) await admin.from("match_videos").update({ is_primary: true }).eq("id", replacement.id);
  }

  const { count } = await admin.from("match_videos").select("id", { count: "exact", head: true }).eq("video_id", params.videoId);
  if (!count) await admin.from("videos").delete().eq("id", params.videoId);
  return NextResponse.json({ ok: true });
}
