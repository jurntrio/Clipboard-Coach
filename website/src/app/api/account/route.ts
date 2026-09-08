import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteObject } from "@/lib/r2/upload";

type StoredSegment = { key?: string | null };
type StoredClipFile = { key?: string | null };
type StoredDrawing = { key?: string | null; base_frame_key?: string | null };

export async function DELETE() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: clips, error: clipError }, { data: tags, error: tagError }] = await Promise.all([
    admin.from("clips").select("rendered_segments, rendered_clip").eq("coach_id", user.id),
    admin.from("tags").select("drawings, videos!inner(coach_id)").eq("videos.coach_id", user.id)
  ]);
  if (clipError || tagError) return NextResponse.json({ error: clipError?.message || tagError?.message }, { status: 500 });

  const keys = new Set<string>();
  for (const clip of clips ?? []) {
    for (const segment of (clip.rendered_segments ?? []) as StoredSegment[]) if (segment.key) keys.add(segment.key);
    const renderedClipKey = (clip.rendered_clip as StoredClipFile | null)?.key;
    if (renderedClipKey) keys.add(renderedClipKey);
  }
  for (const tag of tags ?? []) for (const drawing of (tag.drawings ?? []) as StoredDrawing[]) { if (drawing.key) keys.add(drawing.key); if (drawing.base_frame_key) keys.add(drawing.base_frame_key); }

  try {
    await Promise.all([...keys].map((key) => deleteObject(key)));
  } catch (error) {
    console.error("Account deletion could not remove online assets:", error);
    return NextResponse.json({ error: "Online files could not be removed. The account was not deleted." }, { status: 502 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
