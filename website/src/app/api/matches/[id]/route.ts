import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteObject } from "@/lib/r2/upload";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const platformAdmin = isAdminEmail(user.email);
  const database = createAdminClient();
  const { data: match } = await database.from("matches").select("id, coach_id, club_id, club_team_id, match_videos(video_id, videos(video_key))").eq("id", params.id).maybeSingle();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.club_id) {
    const access = await getClubAccess(match.club_id, user);
    if (!hasClubPermission(access, "games.create") || !canAccessTeam(access, match.club_team_id)) {
      return NextResponse.json({ error: "Geen recht om deze wedstrijd te verwijderen." }, { status: 403 });
    }
  } else if (!platformAdmin && match.coach_id !== user.id) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const linked = (match.match_videos as unknown as { video_id: string; videos: { video_key: string } | null }[] | null) ?? [];
  const disposable: { id: string; key: string }[] = [];
  for (const item of linked) {
    const { count } = await database.from("match_videos").select("id", { count: "exact", head: true }).eq("video_id", item.video_id).neq("match_id", match.id);
    if (!count) disposable.push({ id: item.video_id, key: item.videos?.video_key ?? "" });
  }

  const disposableIds = disposable.map((video) => video.id);
  if (disposableIds.length) {
    const { data: clips } = await database.from("clips").select("rendered_segments").in("video_id", disposableIds);
    const clipKeys = (clips ?? []).flatMap((clip) => ((clip.rendered_segments ?? []) as { key?: string | null }[]).map((segment) => segment.key).filter((key): key is string => !!key));
    try {
      await Promise.all(clipKeys.map((key) => deleteObject(key)));
    } catch {
      return NextResponse.json({ error: "The online clip files could not be removed." }, { status: 502 });
    }
  }

  const { error: matchError } = await database.from("matches").delete().eq("id", match.id);
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });

  for (const video of disposable) {
    const { error } = await database.from("videos").delete().eq("id", video.id);
    if (!error && video.key && !video.key.startsWith("local/")) await deleteObject(video.key).catch(() => undefined);
  }

  return NextResponse.json({ deleted: true });
}
