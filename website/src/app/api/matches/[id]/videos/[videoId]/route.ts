import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess } from "@/lib/auth/club-access";

export async function DELETE(_request: Request, { params }: { params: { id: string; videoId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, coach_id, club_id, club_team_id").eq("id", params.id).maybeSingle();
  if (!match?.club_id) return NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 });
  const access = await getClubAccess(match.club_id, user);
  const canManage = !access.readOnly && canAccessTeam(access, match.club_team_id)
    && (match.coach_id === user.id || access.role === "club_admin" || access.role === "platform_admin");
  if (!canManage) return NextResponse.json({ error: "Geen recht om wedstrijdbeelden te beheren." }, { status: 403 });

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
