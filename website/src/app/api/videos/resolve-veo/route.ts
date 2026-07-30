import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveVeoRecording } from "@/lib/veo-recording";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { url?: unknown } | null;
  if (typeof body?.url !== "string") {
    return NextResponse.json({ error: "Veo-link ontbreekt." }, { status: 400 });
  }
  try {
    return NextResponse.json(await resolveVeoRecording(body.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Veo-link kon niet worden geopend.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
