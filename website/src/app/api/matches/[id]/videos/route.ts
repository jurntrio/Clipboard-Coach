import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { canManageMatchVideoSources } from "@/lib/auth/match-video-sources";

type VideoSourceBody = {
  video_url?: string;
  video_key?: string;
  title?: string;
  camera_number?: number | null;
  file_size?: number | null;
  duration?: number | null;
  sequence_order?: number;
  is_primary?: boolean;
  label?: string;
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, coach_id, club_id, club_team_id, team_a_id").eq("id", params.id).maybeSingle();
  if (!match?.club_id) return NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 });
  const access = await getClubAccess(match.club_id, user);
  const canManage = canManageMatchVideoSources({
    readOnly: access.readOnly,
    canAccessTeam: canAccessTeam(access, match.club_team_id),
    canCreateGames: hasClubPermission(access, "games.create"),
    role: access.role,
    matchCoachId: match.coach_id,
    userId: user.id
  });
  if (!canManage) return NextResponse.json({ error: "Geen recht om wedstrijdbeelden te beheren." }, { status: 403 });

  const body = await request.json().catch(() => null) as VideoSourceBody | null;
  if (!body?.video_url || !body.video_key || !body.label || !Number.isInteger(body.sequence_order) || typeof body.is_primary !== "boolean") {
    return NextResponse.json({ error: "Ongeldige videobron." }, { status: 400 });
  }
  if (!(body.video_url.startsWith("https://") || body.video_url.startsWith("local://"))) {
    return NextResponse.json({ error: "Ongeldige video-URL." }, { status: 400 });
  }

  const { data: video, error: videoError } = await admin.from("videos").insert({
    coach_id: match.coach_id,
    team_id: match.team_a_id,
    video_url: body.video_url,
    video_key: body.video_key,
    title: body.title?.trim() || body.label,
    camera_number: body.camera_number ?? null,
    file_size: body.file_size ?? null,
    duration: body.duration ?? null,
    processing_status: "ready"
  }).select("*").single();
  if (videoError || !video) return NextResponse.json({ error: videoError?.message || "Videobron kon niet worden opgeslagen." }, { status: 500 });

  const { error: linkError } = await admin.from("match_videos").insert({
    match_id: match.id,
    video_id: video.id,
    sequence_order: body.sequence_order,
    is_primary: body.is_primary,
    label: body.label
  });
  if (linkError) {
    await admin.from("videos").delete().eq("id", video.id);
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }
  return NextResponse.json({ video }, { status: 201 });
}
