import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteObject } from "@/lib/r2/upload";

type StoredSegment = { key?: string | null };

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
