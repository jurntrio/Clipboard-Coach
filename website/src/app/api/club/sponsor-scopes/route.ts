import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

async function authorize(manage = false) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return null;
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!hasClubPermission(access, manage ? "sponsors.scopes.manage" : "sponsors.scopes.view")) return null;
  return { clubId: context.activeClubId, userId: context.user.id, access };
}

export async function GET() {
  const context = await authorize();
  if (!context) return NextResponse.json({ error: "Geen toegang tot Sponsorbereiken." }, { status: 403 });
  const admin = createAdminClient();
  const [{ data: scopes, error }, { data: seasons }, { data: teams }] = await Promise.all([
    admin.from("sponsor_scopes").select("id, name, is_clubwide, active, display_order, sponsor_scope_teams(season_id, club_team_id, show_home_matches_commercially)").eq("club_id", context.clubId).order("display_order").order("name"),
    admin.from("club_seasons").select("id, name, status").eq("club_id", context.clubId).order("starts_on", { ascending: false }),
    admin.from("club_teams").select("id, name, season_id, status, display_order").eq("club_id", context.clubId).neq("status", "merged").order("display_order")
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ scopes: scopes ?? [], seasons: seasons ?? [], teams: teams ?? [], canManage: hasClubPermission(context.access, "sponsors.scopes.manage") });
}

export async function POST(request: Request) {
  const context = await authorize(true);
  if (!context) return NextResponse.json({ error: "Geen recht om Sponsorbereiken te beheren." }, { status: 403 });
  const body = await request.json();
  const admin = createAdminClient();
  if (body.action === "create") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Naam is verplicht." }, { status: 400 });
    const { data, error } = await admin.from("sponsor_scopes").insert({ club_id: context.clubId, name,
      is_clubwide: body.isClubwide === true, created_by: context.userId }).select("id").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Dit Sponsorbereik bestaat al." : error.message }, { status: 400 });
    return NextResponse.json({ scopeId: data.id }, { status: 201 });
  }
  if (body.action === "setTeams") {
    const scopeId = String(body.scopeId || ""); const seasonId = String(body.seasonId || "");
    const teamIds = Array.isArray(body.teamIds) ? [...new Set(body.teamIds.filter((id: unknown): id is string => typeof id === "string"))] : [];
    const [{ data: scope }, { data: season }, { data: validTeams }] = await Promise.all([
      admin.from("sponsor_scopes").select("id, is_clubwide").eq("id", scopeId).eq("club_id", context.clubId).maybeSingle(),
      admin.from("club_seasons").select("id, status").eq("id", seasonId).eq("club_id", context.clubId).maybeSingle(),
      teamIds.length ? admin.from("club_teams").select("id").in("id", teamIds).eq("club_id", context.clubId).eq("season_id", seasonId) : Promise.resolve({ data: [] })
    ]);
    if (!scope || scope.is_clubwide) return NextResponse.json({ error: "Ongeldig Sponsorbereik." }, { status: 400 });
    if (!season || season.status === "ARCHIVED") return NextResponse.json({ error: "Een gearchiveerd seizoen is alleen-lezen." }, { status: 409 });
    if ((validTeams ?? []).length !== teamIds.length) return NextResponse.json({ error: "Een of meer teams horen niet bij dit seizoen." }, { status: 400 });
    const { error: clearError } = await admin.from("sponsor_scope_teams").delete().eq("scope_id", scopeId).eq("season_id", seasonId);
    if (clearError) return NextResponse.json({ error: clearError.message }, { status: 400 });
    if (teamIds.length) {
      const autoIds = new Set(Array.isArray(body.autoCommercialTeamIds) ? body.autoCommercialTeamIds : []);
      const { error } = await admin.from("sponsor_scope_teams").insert(teamIds.map(clubTeamId => ({ scope_id: scopeId, club_id: context.clubId,
        season_id: seasonId, club_team_id: clubTeamId, show_home_matches_commercially: autoIds.has(clubTeamId), created_by: context.userId })));
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }
  if (body.action === "linkAssignment") {
    if (!hasClubPermission(context.access, "sponsors.assignments.manage")) return NextResponse.json({ error: "Geen recht om sponsortoewijzingen te beheren." }, { status: 403 });
    const assignmentId = String(body.assignmentId || "");
    const scopeIds = Array.isArray(body.scopeIds) ? [...new Set(body.scopeIds.filter((id: unknown): id is string => typeof id === "string"))] : [];
    const { data: assignment } = await admin.from("sponsor_assignments").select("id").eq("id", assignmentId).eq("club_id", context.clubId).maybeSingle();
    if (!assignment) return NextResponse.json({ error: "Sponsortoewijzing niet gevonden." }, { status: 404 });
    const { error: clearError } = await admin.from("sponsor_assignment_scopes").delete().eq("assignment_id", assignmentId);
    if (clearError) return NextResponse.json({ error: clearError.message }, { status: 400 });
    if (scopeIds.length) {
      const { data: validScopes } = await admin.from("sponsor_scopes").select("id").in("id", scopeIds).eq("club_id", context.clubId).eq("active", true);
      if ((validScopes ?? []).length !== scopeIds.length) return NextResponse.json({ error: "Een of meer Sponsorbereiken zijn ongeldig." }, { status: 400 });
      const { error } = await admin.from("sponsor_assignment_scopes").insert(scopeIds.map(scopeId => ({ assignment_id: assignmentId, scope_id: scopeId })));
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
}
