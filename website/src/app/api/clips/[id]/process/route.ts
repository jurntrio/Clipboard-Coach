import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emptyClipImages, makeClipImageManifest, parseClipImages, parseExcludedDrawingTagIds } from "@/lib/clip-images";
import { clipImageSource, creationImageKey, readImageObject, renderOpeningCard, writeImageObject } from "@/lib/clip-images-server";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: clip } = await supabase.from("clips").select("id, coach_id, video_id, rendered_segments").eq("id", params.id).single();
  if (!clip || clip.coach_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SHARED_SECRET;
  if (!workerUrl || !workerSecret) return NextResponse.json({ error: "Video worker is not configured" }, { status: 503 });

  try {
    const text = await request.text();
    if (text.length > 100_000) return NextResponse.json({ error: "Te veel clipbeelden." }, { status: 413 });
    let body: { images?: unknown; excludedDrawingTagIds?: unknown } = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: "Clipbeelden konden niet worden gelezen. Probeer de afbeeldingen opnieuw toe te voegen." }, { status: 400 });
    }
    const images = body.images ? parseClipImages(body.images) : emptyClipImages();
    const excludedDrawings = parseExcludedDrawingTagIds(body.excludedDrawingTagIds);
    const hasImages = !!images.opening || Object.keys(images.tags).length > 0;
    if (hasImages || excludedDrawings.length) {
      const health = await fetch(`${workerUrl}/health`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      const capabilities = health.ok ? await health.json() : null;
      if (!capabilities || (hasImages && capabilities.clipImageIntros !== 1) || (excludedDrawings.length && capabilities.clipDrawingSelection !== 1)) return NextResponse.json({ error: "De verwerking van clipbeelden is nog niet beschikbaar. Probeer straks opnieuw." }, { status: 503 });
      const { data: segments, error } = await supabase.from("clip_segments").select("id,tag_id,sequence_order,render_status,render_started_at").eq("clip_id", clip.id).order("sequence_order");
      if (error || !segments?.length) throw new Error("De clipfragmenten ontbreken.");
      if (segments.some(segment => segment.render_started_at || segment.render_status === "ready")) return NextResponse.json({ error: "Deze clip wordt al verwerkt. Beelden kunnen alleen bij het maken worden gekozen." }, { status: 409 });
      // Validate all tag membership before generating or persisting any render assets.
      makeClipImageManifest(images, segments, images.opening ? "validation-only" : undefined, excludedDrawings);
      const source = hasImages ? await clipImageSource(clip.video_id, user) : null;
      if (hasImages && !source?.allowed) return NextResponse.json({ error: "Introbeelden zijn niet toegestaan voor de ploeg van deze wedstrijd." }, { status: 403 });
      for (const image of Object.values(images.tags)) {
        if (creationImageKey(image.url, user.id, clip.video_id) !== image.key || !await readImageObject(image.key)) throw new Error("Een fragmentbeeld ontbreekt of hoort niet bij deze video.");
      }
      const openingKey = images.opening && source ? await renderOpeningCard(images.opening, source.matchCard, user.id, clip.video_id, clip.id) : undefined;
      const manifest = makeClipImageManifest(images, segments, openingKey, excludedDrawings);
      await writeImageObject(`clip-intros/renders/${clip.id}.json`, JSON.stringify(manifest), "application/json");
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Clipbeelden konden niet worden voorbereid." }, { status: 400 });
  }

  // The remote pipeline is segment-aware: it preserves local segments that the browser already
  // uploaded and renders only the remaining remote camera segments. This also supports clips that
  // deliberately mix 360SI cameras and the coach's own local footage.
  const mode = "remote";
  const response = await fetch(`${workerUrl}/process-clip`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerSecret}` },
    body: JSON.stringify({ clipId: clip.id, mode })
  });
  if (!response.ok) return NextResponse.json({ error: "Video worker rejected the clip" }, { status: 502 });
  return NextResponse.json({ triggered: true });
}
