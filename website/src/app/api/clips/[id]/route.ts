import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteObject } from "@/lib/r2/upload";

type StoredSegment = { key?: string | null };

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: clip } = await admin.from("clips").select("id, coach_id, video_id").eq("id", params.id).maybeSingle();
  if (!clip) return NextResponse.json({ error: "Clip niet gevonden." }, { status: 404 });

  let allowed = clip.coach_id === user.id;
  if (!allowed) {
    const { data: links } = await admin.from("match_videos")
      .select("matches!inner(club_id, club_team_id)")
      .eq("video_id", clip.video_id);
    for (const link of links ?? []) {
      const match = (Array.isArray(link.matches) ? link.matches[0] : link.matches) as { club_id: string | null; club_team_id: string | null } | null;
      if (!match?.club_id) continue;
      const access = await getClubAccess(match.club_id, user);
      if (!access.readOnly && canAccessTeam(access, match.club_team_id) && hasClubPermission(access, "clips.share")) {
        allowed = true;
        break;
      }
    }
  }
  if (!allowed) {
    console.error("Clip share forbidden", { clipId: clip.id, userId: user.id, coachId: clip.coach_id, videoId: clip.video_id });
    return NextResponse.json({ error: "Geen recht om deze clip te delen." }, { status: 403 });
  }

  const { data: shareLink, error } = await admin.from("share_links").insert({ clip_id: clip.id }).select("token, short_code").single();
  if (error || !shareLink) {
    console.error("Clip share link creation failed", { clipId: clip.id, userId: user.id, error: error?.message });
    return NextResponse.json({ error: error?.message || "Deellink kon niet worden gemaakt." }, { status: 500 });
  }
  return NextResponse.json({ shareLink }, { status: 201 });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const platformAdmin = isAdminEmail(user.email);
  const database = platformAdmin ? createAdminClient() : supabase;
  const { data: clip, error: loadError } = await database.from("clips").select("id, coach_id, rendered_segments").eq("id", params.id).single();
  if (loadError || !clip || (!platformAdmin && clip.coach_id !== user.id)) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  const keys = ((clip.rendered_segments ?? []) as StoredSegment[]).map((segment) => segment.key).filter((key): key is string => !!key);
  try {
    await Promise.all(keys.map((key) => deleteObject(key)));
  } catch (error) {
    console.error("Could not delete clip files:", error);
    return NextResponse.json({ error: "The online clip files could not be removed" }, { status: 502 });
  }

  const { error: deleteError } = await database.from("clips").delete().eq("id", clip.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
