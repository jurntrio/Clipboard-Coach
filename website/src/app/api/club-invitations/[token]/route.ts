import { NextResponse } from "next/server";
import { CLUB_FUNCTION_ROLES } from "@/lib/club-access-options";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: invite } = await admin.from("club_registration_invites")
    .select("expected_name, function_role, target_account_role, contact_email, contact_phone, expires_at, used_at, clubs(name), club_teams(name)").eq("token", params.token).maybeSingle();
  if (!invite) return NextResponse.json({ error: "Deze uitnodiging bestaat niet." }, { status: 404 });
  if (invite.used_at) return NextResponse.json({ error: "Deze uitnodiging is al gebruikt." }, { status: 410 });
  if (new Date(invite.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Deze uitnodiging is verlopen." }, { status: 410 });
  const club = invite.clubs as unknown as { name: string } | null;
  const team = invite.club_teams as unknown as { name: string } | null;
  const platformLabel = invite.target_account_role === "platform_admin" ? "Admin"
    : invite.target_account_role === "admin_viewer" ? "Admin (viewer)" : null;
  return NextResponse.json({
    clubName: club?.name || null, teamName: team?.name || null,
    expectedName: invite.expected_name, contactEmail: invite.contact_email, contactPhone: invite.contact_phone,
    roleLabel: platformLabel || CLUB_FUNCTION_ROLES.find(([key]) => key === invite.function_role)?.[1] || invite.function_role
  });
}
