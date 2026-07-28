import { NextResponse } from "next/server";
import { CLUB_FUNCTION_ROLES } from "@/lib/club-access-options";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubId !== "string" || typeof body.functionRole !== "string") {
    return NextResponse.json({ error: "Kies een club en rol." }, { status: 400 });
  }
  const access = await getClubAccess(body.clubId, user);
  if (!["club_admin", "platform_admin"].includes(access.role)) {
    return NextResponse.json({ error: "Alleen een Club Admin kan uitnodigingen maken." }, { status: 403 });
  }
  if (!CLUB_FUNCTION_ROLES.some(([key]) => key === body.functionRole)) {
    return NextResponse.json({ error: "Ongeldige clubrol." }, { status: 400 });
  }
  const technicalRole = body.functionRole === "club_admin" ? "club_admin"
    : body.functionRole === "club_admin_viewer" ? "club_admin_viewer" : "trainer";
  const expectedName = typeof body.expectedName === "string" ? body.expectedName.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  const admin = createAdminClient();
  const { data, error } = await admin.from("club_registration_invites").insert({
    club_id: body.clubId, technical_role: technicalRole, function_role: body.functionRole,
    expected_name: expectedName || null, created_by: user.id
  }).select("token, expires_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
