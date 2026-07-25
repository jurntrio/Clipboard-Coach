import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: clips, error: clipError } = await supabase.from("clips").select("id").eq("coach_id", user.id);
  if (clipError) return NextResponse.json({ error: clipError.message }, { status: 500 });
  const ids = (clips ?? []).map((clip) => clip.id);
  if (!ids.length) return NextResponse.json({ revoked: 0 });
  const { data, error } = await supabase.from("share_links").delete().in("clip_id", ids).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ revoked: data?.length ?? 0 });
}

