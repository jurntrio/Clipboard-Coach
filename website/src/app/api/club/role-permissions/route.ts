import { NextResponse } from "next/server";
import { CLUB_FUNCTION_ROLES, CLUB_PERMISSION_OPTIONS } from "@/lib/club-access-options";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubId !== "string" || typeof body.functionRole !== "string") {
    return NextResponse.json({ error: "Ongeldig rechtenprofiel." }, { status: 400 });
  }
  const access = await getClubAccess(body.clubId, user);
  if (!["club_admin", "platform_admin"].includes(access.role)) {
    return NextResponse.json({ error: "Alleen een Club Admin kan rechtenprofielen beheren." }, { status: 403 });
  }
  if (!CLUB_FUNCTION_ROLES.some(([key]) => key === body.functionRole)) {
    return NextResponse.json({ error: "Ongeldige clubrol." }, { status: 400 });
  }
  const validKeys = new Set(CLUB_PERMISSION_OPTIONS.map(([key]) => key));
  const enabled = new Set(Array.isArray(body.permissions)
    ? body.permissions.filter((key: unknown): key is string => typeof key === "string" && validKeys.has(key as never))
    : []);
  if (enabled.has("teams.manage_all")) {
    enabled.add("teams.view_all");
    enabled.add("teams.view");
    enabled.add("teams.manage");
  } else if (enabled.has("teams.view_all")) {
    enabled.add("teams.view");
  }
  if (!enabled.has("teams.manage")) enabled.delete("teams.import");
  const admin = createAdminClient();
  const { error: deleteError } = await admin.from("club_role_permission_defaults").delete()
    .eq("club_id", body.clubId).eq("function_role", body.functionRole);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
  const { error } = await admin.from("club_role_permission_defaults").insert(CLUB_PERMISSION_OPTIONS.map(([permissionKey]) => ({
    club_id: body.clubId,
    function_role: body.functionRole,
    permission_key: permissionKey,
    enabled: enabled.has(permissionKey),
    updated_by: user.id,
    updated_at: new Date().toISOString()
  })));
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
