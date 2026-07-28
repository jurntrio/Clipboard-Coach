import { NextResponse } from "next/server";
import { getClubAccess } from "@/lib/auth/club-access";
import { CLUB_FUNCTION_ROLES, CLUB_PERMISSION_OPTIONS, type TeamScope } from "@/lib/club-access-options";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const scopes = new Set<TeamScope>(["none", "assigned", "selected", "all"]);

export async function PUT(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubId !== "string" || typeof body.profileId !== "string") {
    return NextResponse.json({ error: "Ongeldige toegangsinstellingen." }, { status: 400 });
  }
  const actor = await getClubAccess(body.clubId, user);
  if (actor.role !== "club_admin" && actor.role !== "platform_admin") {
    return NextResponse.json({ error: "Alleen een Club Admin kan clubrechten beheren." }, { status: 403 });
  }
  const functionRoles = new Set(CLUB_FUNCTION_ROLES.map(([key]) => key));
  const permissionKeys = new Set(CLUB_PERMISSION_OPTIONS.map(([key]) => key));
  if (!functionRoles.has(body.functionRole) || !scopes.has(body.teamScope)) {
    return NextResponse.json({ error: "Ongeldige rol of teamscope." }, { status: 400 });
  }
  const customRoleName = body.functionRole === "custom" && typeof body.customRoleName === "string"
    ? body.customRoleName.trim().slice(0, 80) : null;
  if (body.functionRole === "custom" && !customRoleName) {
    return NextResponse.json({ error: "Geef een naam voor de aangepaste rol." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: membership } = await admin.from("club_memberships").select("role")
    .eq("club_id", body.clubId).eq("profile_id", body.profileId).eq("status", "active").maybeSingle();
  if (!membership) return NextResponse.json({ error: "Clublid niet gevonden." }, { status: 404 });
  if (["club_admin", "club_admin_viewer"].includes(membership.role) && body.functionRole !== membership.role) {
    return NextResponse.json({ error: "Wijzig deze beheerdersrol via het platformbeheer." }, { status: 409 });
  }
  const teamIds = Array.isArray(body.teamIds) ? body.teamIds.filter((id: unknown): id is string => typeof id === "string") : [];
  if (teamIds.length) {
    const { count } = await admin.from("club_teams").select("id", { count: "exact", head: true })
      .eq("club_id", body.clubId).in("id", teamIds);
    if (count !== new Set(teamIds).size) return NextResponse.json({ error: "Een geselecteerd team hoort niet bij deze club." }, { status: 400 });
  }
  const permissions = Array.isArray(body.permissions)
    ? body.permissions.filter((key: unknown): key is string => typeof key === "string" && permissionKeys.has(key as never))
    : [];
  const { error: membershipError } = await admin.from("club_memberships").update({
    function_role: body.functionRole, custom_role_name: customRoleName, team_scope: body.teamScope
  }).eq("club_id", body.clubId).eq("profile_id", body.profileId);
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 400 });
  await admin.from("club_member_team_access").delete().eq("club_id", body.clubId).eq("profile_id", body.profileId);
  if (body.teamScope === "selected" && teamIds.length) {
    const { error } = await admin.from("club_member_team_access").insert(teamIds.map((clubTeamId: string) => ({
      club_id: body.clubId, profile_id: body.profileId, club_team_id: clubTeamId
    })));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await admin.from("club_member_permissions").delete().eq("club_id", body.clubId).eq("profile_id", body.profileId);
  {
    const { error } = await admin.from("club_member_permissions").insert(CLUB_PERMISSION_OPTIONS.map(([permissionKey]) => ({
      club_id: body.clubId, profile_id: body.profileId, permission_key: permissionKey,
      enabled: permissions.includes(permissionKey), updated_by: user.id, updated_at: new Date().toISOString()
    })));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
