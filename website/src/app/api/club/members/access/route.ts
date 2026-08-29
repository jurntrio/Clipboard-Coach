import { NextResponse } from "next/server";
import { getClubAccess } from "@/lib/auth/club-access";
import { CLUB_FUNCTION_ROLES, CLUB_PERMISSION_OPTIONS, type TeamScope } from "@/lib/club-access-options";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const scopes = new Set<TeamScope>(["none", "assigned", "all"]);

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
  const assignedTeamIds = Array.isArray(body.assignedTeamIds) ? body.assignedTeamIds.filter((id: unknown): id is string => typeof id === "string") : [];
  const allTeamIds = [...new Set([...teamIds, ...assignedTeamIds])];
  if (allTeamIds.length) {
    const { count } = await admin.from("club_teams").select("id", { count: "exact", head: true })
      .eq("club_id", body.clubId).in("id", allTeamIds);
    if (count !== allTeamIds.length) return NextResponse.json({ error: "Een geselecteerd team hoort niet bij deze club." }, { status: 400 });
  }
  const permissions = Array.isArray(body.permissions)
    ? body.permissions.filter((key: unknown): key is string => typeof key === "string" && permissionKeys.has(key as never))
    : [];
  if (permissions.includes("teams.manage_all")) {
    for (const required of ["teams.view_all", "teams.view", "teams.manage"]) {
      if (!permissions.includes(required)) permissions.push(required);
    }
  } else if (permissions.includes("teams.view_all") && !permissions.includes("teams.view")) {
    permissions.push("teams.view");
  }
  if (!permissions.includes("teams.manage")) {
    const importIndex = permissions.indexOf("teams.import");
    if (importIndex >= 0) permissions.splice(importIndex, 1);
  }
  const extraTeamIds = permissions.includes("teams.view") ? teamIds : [];
  const { error: membershipError } = await admin.from("club_memberships").update({
    function_role: body.functionRole, custom_role_name: customRoleName, team_scope: body.teamScope
  }).eq("club_id", body.clubId).eq("profile_id", body.profileId);
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 400 });
  await admin.from("club_member_team_access").delete().eq("club_id", body.clubId).eq("profile_id", body.profileId);
  if (body.teamScope === "assigned" && extraTeamIds.length) {
    const { error } = await admin.from("club_member_team_access").insert(extraTeamIds.map((clubTeamId: string) => ({
      club_id: body.clubId, profile_id: body.profileId, club_team_id: clubTeamId
    })));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const { data: trainer } = await admin.from("club_trainers").select("id")
    .eq("club_id", body.clubId).eq("profile_id", body.profileId).maybeSingle();
  if (trainer) {
    const { error: clearError } = await admin.from("club_trainer_teams").delete().eq("trainer_id", trainer.id);
    if (clearError) return NextResponse.json({ error: clearError.message }, { status: 400 });
    if (assignedTeamIds.length) {
      const { error: assignmentError } = await admin.from("club_trainer_teams").insert(assignedTeamIds.map((clubTeamId: string) => ({
        trainer_id: trainer.id, club_team_id: clubTeamId, role: "coach", status: "active"
      })));
      if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 400 });
    }
  }
  await admin.from("club_member_permissions").delete().eq("club_id", body.clubId).eq("profile_id", body.profileId);
  {
    const { error } = await admin.from("club_member_permissions").insert(CLUB_PERMISSION_OPTIONS.map(([permissionKey]) => ({
      club_id: body.clubId, profile_id: body.profileId, permission_key: permissionKey,
      enabled: permissions.includes(permissionKey), updated_by: user.id, updated_at: new Date().toISOString()
    })));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Canonical authorization write. The legacy rows above remain operational projections
  // until their remaining non-auth consumers have been migrated.
  const { data: personAccount, error: accountError } = await admin.from("person_accounts")
    .select("person_id").eq("profile_id", body.profileId).eq("status", "active")
    .is("revoked_at", null).maybeSingle();
  if (accountError || !personAccount) {
    return NextResponse.json({ error: accountError?.message ?? "Persoon-accountkoppeling ontbreekt." }, { status: 409 });
  }
  const { data: clubPerson, error: personError } = await admin.from("club_people")
    .select("id").eq("club_id", body.clubId).eq("person_id", personAccount.person_id)
    .eq("status", "active").maybeSingle();
  if (personError || !clubPerson) {
    return NextResponse.json({ error: personError?.message ?? "Persoon ontbreekt in deze club." }, { status: 409 });
  }
  const canonicalRole = body.functionRole === "coach" ? "trainer"
    : body.functionRole === "assistant_coach" ? "assistant_trainer" : body.functionRole;
  const today = new Date().toISOString().slice(0, 10);
  const { error: endError } = await admin.from("club_role_assignments").update({
    status: "ended", valid_until: today, ended_at: new Date().toISOString(),
    ended_by: user.id, end_reason: "access_settings_replaced"
  }).eq("club_person_id", clubPerson.id).eq("status", "active").is("club_team_id", null);
  if (endError) return NextResponse.json({ error: endError.message }, { status: 400 });
  const { data: baseRole, error: baseRoleError } = await admin.from("club_role_assignments").insert({
    club_person_id: clubPerson.id, role_type: canonicalRole,
    club_team_id: null, team_scope: body.teamScope, custom_role_name: customRoleName,
    valid_from: today, status: "active", created_by: user.id
  }).select("id").single();
  if (baseRoleError || !baseRole) return NextResponse.json({ error: baseRoleError?.message ?? "Rol kon niet worden bewaard." }, { status: 400 });
  const canonicalTeamIds = body.teamScope === "assigned" ? allTeamIds : [];
  const { data: currentTeamRoles } = await admin.from("club_role_assignments").select("id, club_team_id")
    .eq("club_person_id", clubPerson.id).eq("status", "active").not("club_team_id", "is", null);
  const retainedTeamRoleIds = (currentTeamRoles ?? [])
    .filter((item) => item.club_team_id && canonicalTeamIds.includes(item.club_team_id))
    .map((item) => item.id);
  if (retainedTeamRoleIds.length) {
    const { error } = await admin.from("club_role_assignments").update({ role_type: canonicalRole })
      .in("id", retainedTeamRoleIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const obsoleteTeamRoleIds = (currentTeamRoles ?? [])
    .filter((item) => !item.club_team_id || !canonicalTeamIds.includes(item.club_team_id))
    .map((item) => item.id);
  if (obsoleteTeamRoleIds.length) {
    const { error } = await admin.from("club_role_assignments").update({
      status: "ended", valid_until: today, ended_at: new Date().toISOString(),
      ended_by: user.id, end_reason: "team_access_replaced"
    }).in("id", obsoleteTeamRoleIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const { data: existingTeamRoles } = canonicalTeamIds.length
    ? await admin.from("club_role_assignments").select("club_team_id")
      .eq("club_person_id", clubPerson.id).eq("status", "active").in("club_team_id", canonicalTeamIds)
    : { data: [] };
  const existingIds = new Set((existingTeamRoles ?? []).map((item) => item.club_team_id));
  const missingTeamIds = canonicalTeamIds.filter((id) => !existingIds.has(id));
  if (missingTeamIds.length) {
    const { error } = await admin.from("club_role_assignments").insert(missingTeamIds.map((clubTeamId) => ({
      club_person_id: clubPerson.id, role_type: canonicalRole, club_team_id: clubTeamId,
      team_scope: "assigned", valid_from: today, status: "active", created_by: user.id
    })));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const { error: overrideError } = await admin.from("club_role_permission_overrides").insert(
    CLUB_PERMISSION_OPTIONS.map(([permissionKey]) => ({
      club_role_assignment_id: baseRole.id, permission_key: permissionKey,
      enabled: permissions.includes(permissionKey), updated_by: user.id,
      updated_at: new Date().toISOString()
    }))
  );
  if (overrideError) return NextResponse.json({ error: overrideError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
