import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_CLIP_IDS = 25;

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ids = Array.from(new Set(new URL(request.url).searchParams.getAll("id")))
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, MAX_CLIP_IDS);
  if (!ids.length) return NextResponse.json({ clips: [] });

  // Use the caller-bound client so the existing clips RLS policy remains the
  // authorization boundary; the status endpoint never broadens clip access.
  const { data, error } = await supabase
    .from("clips")
    .select("id, render_status, clip_segments(id, render_status)")
    .in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ clips: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" }
  });
}
