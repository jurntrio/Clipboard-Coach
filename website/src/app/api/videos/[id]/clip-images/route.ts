import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clipImageSource, uploadCreationImage } from "@/lib/clip-images-server";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return NextResponse.json({ error: "Je sessie is verlopen." }, { status: 401 });
    const source = await clipImageSource(params.id, user);
    if (!source) return NextResponse.json({ error: "Geen toegang tot deze video." }, { status: 403 });
    return NextResponse.json(source, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "De clipbeeldinstelling kon niet worden geladen." }, { status: 500 }); }
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return NextResponse.json({ error: "Je sessie is verlopen." }, { status: 401 });
    const source = await clipImageSource(params.id, user);
    if (!source?.allowed) return NextResponse.json({ error: "Introbeelden zijn niet toegestaan voor deze ploeg." }, { status: 403 });
    if (Number(request.headers.get("content-length")) > 5 * 1024 * 1024 + 16384) return NextResponse.json({ error: "Maximaal 5 MB per afbeelding." }, { status: 413 });
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "Kies een afbeelding." }, { status: 400 });
    try { return NextResponse.json(await uploadCreationImage(file, user.id, params.id)); }
    catch { return NextResponse.json({ error: "Upload mislukt. Kies een geldige PNG, JPEG of WebP van maximaal 5 MB." }, { status: 400 }); }
  } catch { return NextResponse.json({ error: "Afbeelding kon niet worden opgeslagen. Probeer opnieuw." }, { status: 500 }); }
}
