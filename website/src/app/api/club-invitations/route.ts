import { NextResponse } from "next/server";
import { CLUB_FUNCTION_ROLES } from "@/lib/club-access-options";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createInviteToken, hashInviteToken } from "@/lib/invite-tokens";
import { sendInvitationEmail } from "@/lib/email/resend";

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
  const isClubWideAdmin = technicalRole === "club_admin" || technicalRole === "club_admin_viewer";
  const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
  if (!isClubWideAdmin && !teamId) {
    return NextResponse.json({ error: "Kies een ploeg voor deze rol." }, { status: 400 });
  }
  const expectedName = typeof body.expectedName === "string" ? body.expectedName.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim().toLowerCase().slice(0, 254) : "";
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
  const admin = createAdminClient();
  const { data: club } = await admin.from("clubs").select("id, name").eq("id", body.clubId).maybeSingle();
  if (!club) return NextResponse.json({ error: "Club niet gevonden." }, { status: 404 });
  const { data: team } = teamId
    ? await admin.from("club_teams").select("id, name").eq("id", teamId).eq("club_id", body.clubId).maybeSingle()
    : { data: null };
  if (teamId && !team) return NextResponse.json({ error: "De gekozen ploeg hoort niet bij deze club." }, { status: 400 });
  const token = createInviteToken();
  const { data, error } = await admin.from("club_registration_invites").insert({
    club_id: body.clubId, club_team_id: isClubWideAdmin ? null : team?.id, technical_role: technicalRole, function_role: body.functionRole,
    expected_name: expectedName || null, contact_email: contactEmail || null, created_by: user.id, token_hash: hashInviteToken(token)
  }).select("id, expires_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  let delivery: { sent: boolean; error?: string } = { sent: false };
  if (contactEmail) {
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const roleLabel = CLUB_FUNCTION_ROLES.find(([key]) => key === body.functionRole)?.[1] || body.functionRole;
    const scopeDescription = isClubWideAdmin ? "met toegang tot alle ploegen" : `voor ploeg ${team?.name}`;
    delivery = await sendInvitationEmail({ to: contactEmail, recipientName: expectedName, title: `Uitnodiging voor ${roleLabel} bij ${club.name}`, intro: `Je bent uitgenodigd als ${roleLabel} bij ${club.name}, ${scopeDescription}.`, actionLabel: "Uitnodiging aanvaarden", actionUrl: `${origin}/club-invite/${token}`, expiresAt: data.expires_at });
    await admin.from("club_registration_invites").update({ sent_at: delivery.sent ? new Date().toISOString() : null, delivery_error: delivery.error ?? null }).eq("id", data.id);
  }
  return NextResponse.json({ token, expires_at: data.expires_at, emailSent: delivery.sent, deliveryError: delivery.error }, { status: 201 });
}
