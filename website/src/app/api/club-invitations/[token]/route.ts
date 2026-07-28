import { NextResponse } from "next/server";
import { CLUB_FUNCTION_ROLES } from "@/lib/club-access-options";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: invite } = await admin.from("club_registration_invites")
    .select("expected_name, function_role, expires_at, used_at, clubs(name)").eq("token", params.token).maybeSingle();
  if (!invite) return NextResponse.json({ error: "Deze uitnodiging bestaat niet." }, { status: 404 });
  if (invite.used_at) return NextResponse.json({ error: "Deze uitnodiging is al gebruikt." }, { status: 410 });
  if (new Date(invite.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Deze uitnodiging is verlopen." }, { status: 410 });
  const club = invite.clubs as unknown as { name: string } | null;
  return NextResponse.json({
    clubName: club?.name || "Club", expectedName: invite.expected_name,
    roleLabel: CLUB_FUNCTION_ROLES.find(([key]) => key === invite.function_role)?.[1] || invite.function_role
  });
}
