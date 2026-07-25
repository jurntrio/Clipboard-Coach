import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: clip } = await supabase.from("clips").select("id, coach_id").eq("id", params.id).single();
  if (!clip || clip.coach_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SHARED_SECRET;
  if (!workerUrl || !workerSecret) return NextResponse.json({ error: "Video worker is not configured" }, { status: 503 });

  const response = await fetch(`${workerUrl}/process-clip`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerSecret}` },
    body: JSON.stringify({ clipId: clip.id })
  });
  if (!response.ok) return NextResponse.json({ error: "Video worker rejected the clip" }, { status: 502 });
  return NextResponse.json({ triggered: true });
}
