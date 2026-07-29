import { NextResponse } from "next/server";
import { CLUB_FUNCTION_ROLES } from "@/lib/club-access-options";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Alleen een Platform Admin kan deze uitnodiging maken." }, { status: 403 });
  }
  const { data: actorProfile } = await supabase.from("profiles").select("account_role").eq("id", user.id).maybeSingle();
  if (!isAdminEmail(user.email) && actorProfile?.account_role !== "platform_admin") {
    return NextResponse.json({ error: "Alleen een Platform Admin kan deze uitnodiging maken." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.accountRole !== "string") {
    return NextResponse.json({ error: "Kies een geldige rol." }, { status: 400 });
  }
  const platformRole = body.accountRole === "platform_admin" || body.accountRole === "admin_viewer";
  if (!platformRole && (body.accountRole !== "club_member" || !CLUB_FUNCTION_ROLES.some(([key]) => key === body.functionRole))) {
    return NextResponse.json({ error: "Kies een geldige clubfunctie." }, { status: 400 });
  }
  const expectedName = clean(body.expectedName, 120);
  const contactEmail = clean(body.contactEmail, 254).toLowerCase();
  const contactPhone = clean(body.contactPhone, 40);
  const customRoleName = clean(body.customRoleName, 80);
  if (!expectedName) return NextResponse.json({ error: "Vul de volledige naam in." }, { status: 400 });
  if (!platformRole && body.functionRole === "custom" && !customRoleName) {
    return NextResponse.json({ error: "Vul de naam van de aangepaste clubfunctie in." }, { status: 400 });
  }

  const admin = createAdminClient();
  let technicalRole = body.accountRole;
  if (!platformRole) {
    if (typeof body.clubId !== "string" || typeof body.teamId !== "string") {
      return NextResponse.json({ error: "Kies een club en ploeg." }, { status: 400 });
    }
    const { data: team } = await admin.from("club_teams").select("id").eq("id", body.teamId).eq("club_id", body.clubId).maybeSingle();
    if (!team) return NextResponse.json({ error: "De gekozen ploeg hoort niet bij deze club." }, { status: 400 });
    technicalRole = body.functionRole === "club_admin" ? "club_admin"
      : body.functionRole === "club_admin_viewer" ? "club_admin_viewer"
      : "trainer";
  }
  const { data, error } = await admin.from("club_registration_invites").insert({
    club_id: platformRole ? null : body.clubId,
    club_team_id: platformRole ? null : body.teamId,
    technical_role: technicalRole,
    function_role: platformRole ? body.accountRole : body.functionRole,
    custom_role_name: !platformRole && body.functionRole === "custom" ? customRoleName : null,
    target_account_role: body.accountRole,
    expected_name: expectedName,
    contact_email: contactEmail || null,
    contact_phone: contactPhone || null,
    created_by: user.id
  }).select("token, expires_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}
