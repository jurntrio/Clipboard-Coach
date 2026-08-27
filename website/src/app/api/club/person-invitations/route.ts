import { NextResponse } from "next/server";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubPersonId !== "string" || typeof body.clubId !== "string") {
    return NextResponse.json({ error: "Kies een persoon uit de club." }, { status: 400 });
  }
  const access = await getClubAccess(body.clubId, user);
  if (!["club_admin", "platform_admin"].includes(access.role)) {
    return NextResponse.json({ error: "Alleen een Club Admin kan uitnodigingen maken." }, { status: 403 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const admin = createAdminClient();
  const { data: clubPerson } = await admin.from("club_people").select("id")
    .eq("id", body.clubPersonId).eq("club_id", body.clubId).eq("status", "active").maybeSingle();
  if (!clubPerson) return NextResponse.json({ error: "Persoon niet gevonden in deze club." }, { status: 404 });
  const { data, error } = await admin.rpc("create_person_account_invitation", {
    target_club_person_id: body.clubPersonId,
    intended_email_value: email || null,
    actor_profile_id: user.id
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const invite = Array.isArray(data) ? data[0] : data;
  return NextResponse.json(invite, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubId !== "string" || typeof body.clubPersonId !== "string" || typeof body.invitationId !== "string") {
    return NextResponse.json({ error: "Ongeldige uitnodiging." }, { status: 400 });
  }
  const access = await getClubAccess(body.clubId, user);
  if (!["club_admin", "platform_admin"].includes(access.role)) {
    return NextResponse.json({ error: "Alleen een Club Admin kan uitnodigingen intrekken." }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data: invitation } = await admin.from("person_account_invitations")
    .select("id, status, expires_at, club_person_id, club_people!inner(club_id)")
    .eq("id", body.invitationId)
    .eq("club_person_id", body.clubPersonId)
    .eq("club_people.club_id", body.clubId)
    .maybeSingle();
  if (!invitation) return NextResponse.json({ error: "Uitnodiging niet gevonden." }, { status: 404 });
  if (invitation.status !== "pending") {
    return NextResponse.json({ error: "Alleen een openstaande uitnodiging kan worden ingetrokken." }, { status: 409 });
  }
  const now = new Date();
  const expired = new Date(invitation.expires_at).getTime() <= now.getTime();
  const { data: revoked, error } = await admin.from("person_account_invitations").update({
    status: expired ? "expired" : "revoked",
    revoked_at: expired ? null : now.toISOString(),
    revoked_by: expired ? null : user.id
  }).eq("id", invitation.id).eq("status", "pending").select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!revoked) return NextResponse.json({ error: "De uitnodiging is intussen al gewijzigd." }, { status: 409 });
  return new NextResponse(null, { status: 204 });
}
