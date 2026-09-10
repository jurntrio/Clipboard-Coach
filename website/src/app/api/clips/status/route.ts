import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_CLIP_IDS = 25;
const STALE_PENDING_MS = 2 * 60 * 1000;
const STALE_SEGMENT_MS = 20 * 60 * 1000;

type ClipStatusRow = {
  id: string;
  render_status: string;
  created_at?: string | null;
  clip_segments?: Array<{
    id: string;
    render_status: string;
    render_started_at?: string | null;
    render_attempts?: number | null;
  }>;
};

async function retriggerStaleClip(clipId: string) {
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SHARED_SECRET;
  if (!workerUrl || !workerSecret) return;

  await fetch(`${workerUrl}/process-clip`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerSecret}` },
    body: JSON.stringify({ clipId, mode: "remote" }),
    signal: AbortSignal.timeout(10000)
  }).catch(() => undefined);
}

function isStaleRenderingClip(clip: ClipStatusRow, now: number) {
  if (clip.render_status !== "rendering") return false;

  const segments = clip.clip_segments ?? [];
  const hasStartedSegment = segments.some((segment) => (segment.render_attempts ?? 0) > 0 || !!segment.render_started_at);
  const createdAt = clip.created_at ? Date.parse(clip.created_at) : NaN;
  if (!hasStartedSegment && Number.isFinite(createdAt) && now - createdAt > STALE_PENDING_MS) return true;

  return segments.some((segment) => {
    if (segment.render_status !== "rendering" || !segment.render_started_at) return false;
    const startedAt = Date.parse(segment.render_started_at);
    return Number.isFinite(startedAt) && now - startedAt > STALE_SEGMENT_MS;
  });
}

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
    .select("id, render_status, created_at, clip_segments(id, render_status, render_started_at, render_attempts)")
    .in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const clips = (data ?? []) as ClipStatusRow[];
  const now = Date.now();
  await Promise.all(clips.filter((clip) => isStaleRenderingClip(clip, now)).map((clip) => retriggerStaleClip(clip.id)));

  return NextResponse.json({ clips }, {
    headers: { "Cache-Control": "private, no-store" }
  });
}
