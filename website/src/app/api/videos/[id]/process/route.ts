import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: video } = await supabase
    .from("videos")
    .select("id, video_key, coach_id")
    .eq("id", params.id)
    .single();

  if (!video || video.coach_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SHARED_SECRET;

  if (!workerUrl || !workerSecret) {
    // Worker isn't deployed yet - leave the video playable from the raw
    // upload rather than failing the request.
    return NextResponse.json({ triggered: false });
  }

  await fetch(`${workerUrl}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerSecret}` },
    body: JSON.stringify({ videoId: video.id, videoKey: video.video_key })
  }).catch((error) => {
    console.error("Failed to trigger video processing:", error);
  });

  return NextResponse.json({ triggered: true });
}
