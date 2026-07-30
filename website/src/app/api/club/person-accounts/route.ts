import { NextResponse } from "next/server";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubId !== "string" || typeof body.personAccountId !== "string") {
    return NextResponse.json({ error: "Accountkoppeling ontbreekt." }, { status: 400 });
  }
  const access = await getClubAccess(body.clubId, user);
  if (!["club_admin", "platform_admin"].includes(access.role)) {
    return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data: link } = await admin.from("person_accounts").select("id, person_id")
    .eq("id", body.personAccountId).eq("status", "active").maybeSingle();
  if (!link) return NextResponse.json({ error: "Actieve koppeling niet gevonden." }, { status: 404 });
  const { data: clubPerson } = await admin.from("club_people").select("id")
    .eq("club_id", body.clubId).eq("person_id", link.person_id).maybeSingle();
  if (!clubPerson) return NextResponse.json({ error: "Persoon hoort niet bij deze club." }, { status: 403 });
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 240) : "";
  const { error } = await admin.rpc("revoke_person_account", {
    target_link_id: body.personAccountId,
    actor_profile_id: user.id,
    reason_value: reason || "club_admin_revoked"
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
