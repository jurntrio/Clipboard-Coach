import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendMonitoringAlert } from "@/lib/monitoring/email-alert";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => null) as { message?: unknown; digest?: unknown; route?: unknown } | null;
  if (!body || typeof body.message !== "string" || body.message.length > 1000) return NextResponse.json({ ok: false }, { status: 400 });
  await sendMonitoringAlert({ source: "browser", message: body.message, stack: typeof body.digest === "string" ? `Next.js digest: ${body.digest}` : undefined, route: typeof body.route === "string" ? body.route : undefined });
  return NextResponse.json({ ok: true });
}
