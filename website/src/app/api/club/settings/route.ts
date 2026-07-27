import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubId !== "string" || typeof body.clipAdvertisingEnabled !== "boolean") {
    return NextResponse.json({ error: "Ongeldige instellingen." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("club_memberships")
    .select("role, status")
    .eq("club_id", body.clubId)
    .eq("profile_id", user.id)
    .maybeSingle();
  const allowed = isAdminEmail(user.email) || (membership?.role === "club_admin" && membership.status === "active");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: club, error } = await admin
    .from("clubs")
    .update({ clip_advertising_enabled: body.clipAdvertisingEnabled })
    .eq("id", body.clubId)
    .select("id, clip_advertising_enabled")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ club });
}
