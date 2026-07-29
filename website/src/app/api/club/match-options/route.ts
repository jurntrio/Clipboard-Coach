import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const optionTypes = new Set(["field", "locker_room", "meeting_place", "non_selection_reason"]);

async function authorize(clubId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = createAdminClient();
  if (!isAdminEmail(user.email)) {
    const { data } = await admin.from("club_memberships").select("id").eq("club_id", clubId)
      .eq("profile_id", user.id).eq("role", "club_admin").eq("status", "active").maybeSingle();
    if (!data) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin };
}

export async function GET(request: Request) {
  const clubId = new URL(request.url).searchParams.get("clubId") ?? "";
  const ctx = await authorize(clubId);
  if ("response" in ctx) return ctx.response;
  const { data, error } = await ctx.admin.from("club_match_options").select("*").eq("club_id", clubId).eq("active", true).order("label");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ options: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { clubId?: string; optionType?: string; label?: string } | null;
  const clubId = body?.clubId ?? "";
  const optionType = body?.optionType ?? "";
  const label = body?.label?.trim().replace(/\s+/g, " ").slice(0, 100) ?? "";
  const ctx = await authorize(clubId);
  if ("response" in ctx) return ctx.response;
  if (!optionTypes.has(optionType) || !label) return NextResponse.json({ error: "Invalid option." }, { status: 400 });
  const { data, error } = await ctx.admin.from("club_match_options").upsert({
    club_id: clubId, option_type: optionType, label, active: true
  }, { onConflict: "club_id,option_type,label" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ option: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null) as { clubId?: string; optionId?: string } | null;
  const ctx = await authorize(body?.clubId ?? "");
  if ("response" in ctx) return ctx.response;
  const { error } = await ctx.admin.from("club_match_options").update({ active: false })
    .eq("id", body?.optionId ?? "").eq("club_id", body?.clubId ?? "");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
