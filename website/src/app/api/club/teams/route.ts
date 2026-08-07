import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { defaultsForAgeCategory, isMatchFormat } from "@/lib/match-defaults";

const teamRoles = new Set(["coach", "assistant_coach", "team_manager"]);
const teamStatuses = new Set(["active", "inactive", "pending", "rejected", "archived"]);

async function context(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const admin = createAdminClient();
  return { user, admin, platformAdmin: isAdminEmail(user.email) };
}

async function canManage(admin: ReturnType<typeof createAdminClient>, userId: string, clubId: string, platformAdmin: boolean) {
  if (platformAdmin) return true;
  const { data: profile } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
  const access = await getClubAccess(clubId, { id: userId, email: profile?.email });
  return hasClubPermission(access, "teams.manage_all");
}

async function canManageTeam(admin: ReturnType<typeof createAdminClient>, userId: string, clubId: string, teamId: string, platformAdmin: boolean) {
  if (platformAdmin) return true;
  const { data: profile } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
  const access = await getClubAccess(clubId, { id: userId, email: profile?.email });
  return hasClubPermission(access, "teams.manage") && canAccessTeam(access, teamId);
}

function text(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function integer(value: unknown, min: number, max: number) {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : null;
}

export async function POST(request: Request) {
  const ctx = await context(request);
  if ("response" in ctx) return ctx.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const clubId = text(body?.clubId, 36);
  const name = text(body?.name);
  if (!clubId || !name) return NextResponse.json({ error: "Club en teamnaam zijn verplicht." }, { status: 400 });
  if (!await canManage(ctx.admin, ctx.user.id, clubId, ctx.platformAdmin)) return NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 });
  const { data: activeSeason } = await ctx.admin.from("club_seasons").select("id").eq("club_id", clubId).eq("status", "ACTIVE").maybeSingle();
  const lastTeamQuery = ctx.admin.from("club_teams").select("display_order").eq("club_id", clubId);
  const { data: lastTeam } = await (activeSeason ? lastTeamQuery.eq("season_id", activeSeason.id) : lastTeamQuery.is("season_id", null))
    .order("display_order", { ascending: false }).limit(1).maybeSingle();
  const ageCategory = text(body?.ageCategory, 60);
  const defaults = defaultsForAgeCategory(ageCategory);
  const { data, error } = await ctx.admin.from("club_teams").insert({
    club_id: clubId, name, normalized_name: name,
    display_order: (lastTeam?.display_order ?? -1) + 1,
    season_id: activeSeason?.id ?? null,
    age_category: ageCategory || null,
    match_format: isMatchFormat(body?.matchFormat) ? body.matchFormat : defaults?.format ?? null,
    match_period_count: integer(body?.periodCount, 1, 12) ?? defaults?.periodCount ?? null,
    match_period_minutes: integer(body?.periodMinutes, 1, 120) ?? defaults?.periodMinutes ?? null,
    match_minimum_players: integer(body?.minimumPlayers, 1, 30) ?? defaults?.minimumPlayers ?? null,
    level_or_competition: text(body?.levelOrCompetition, 100) || null,
    status: "active", created_by: ctx.user.id, approved_by: ctx.user.id, approved_at: new Date().toISOString()
  }).select("*").single();
  if (error?.code === "23505") return NextResponse.json({ error: "Dit team bestaat al binnen de club." }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: rosterError } = await ctx.admin.from("teams").insert({
    coach_id: null,
    club_team_id: data.id,
    club_name: null,
    name: data.name
  });
  if (rosterError) {
    await ctx.admin.from("club_teams").delete().eq("id", data.id);
    return NextResponse.json({ error: rosterError.message }, { status: 500 });
  }
  return NextResponse.json({ team: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ctx = await context(request);
  if ("response" in ctx) return ctx.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (Array.isArray(body?.teamIds)) {
    const clubId = text(body?.clubId, 36);
    const teamIds = body.teamIds.filter((id): id is string => typeof id === "string" && id.length > 0);
    if (!clubId || teamIds.length !== body.teamIds.length) return NextResponse.json({ error: "Ongeldige ploegvolgorde." }, { status: 400 });
    const { data: profile } = await ctx.admin.from("profiles").select("email").eq("id", ctx.user.id).maybeSingle();
    const access = await getClubAccess(clubId, { id: ctx.user.id, email: profile?.email });
    if (!ctx.platformAdmin && access.role !== "club_admin") return NextResponse.json({ error: "Alleen een clubadmin kan de ploegvolgorde aanpassen." }, { status: 403 });
    const { error } = await ctx.admin.rpc("reorder_club_teams", { target_club_id: clubId, ordered_team_ids: teamIds });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  const teamId = text(body?.teamId, 36);
  const { data: team } = await ctx.admin.from("club_teams").select("id, club_id, status").eq("id", teamId).maybeSingle();
  if (!team) return NextResponse.json({ error: "Team niet gevonden." }, { status: 404 });
  if (!await canManageTeam(ctx.admin, ctx.user.id, team.club_id, team.id, ctx.platformAdmin)) return NextResponse.json({ error: "Geen toegang tot deze ploeg." }, { status: 403 });

  const status = text(body?.status, 20);
  if (status && !teamStatuses.has(status)) return NextResponse.json({ error: "Ongeldige status." }, { status: 400 });
  const update: Record<string, unknown> = {};
  const name = text(body?.name);
  if (name) update.name = name;
  if ("ageCategory" in (body ?? {})) update.age_category = text(body?.ageCategory, 60) || null;
  if ("levelOrCompetition" in (body ?? {})) update.level_or_competition = text(body?.levelOrCompetition, 100) || null;
  if ("trainersCanEditRoster" in (body ?? {})) update.trainers_can_edit_roster = body?.trainersCanEditRoster === true;
  if ("trainersCanManageMatches" in (body ?? {})) update.trainers_can_manage_matches = body?.trainersCanManageMatches === true;
  if ("matchFormat" in (body ?? {})) update.match_format = isMatchFormat(body?.matchFormat) ? body.matchFormat : null;
  if ("periodCount" in (body ?? {})) update.match_period_count = integer(body?.periodCount, 1, 12);
  if ("periodMinutes" in (body ?? {})) update.match_period_minutes = integer(body?.periodMinutes, 1, 120);
  if ("minimumPlayers" in (body ?? {})) update.match_minimum_players = integer(body?.minimumPlayers, 1, 30);
  if (status) update.status = status;
  if (status === "active" && team.status === "pending") Object.assign(update, { approved_by: ctx.user.id, approved_at: new Date().toISOString() });
  const { data, error } = await ctx.admin.from("club_teams").update(update).eq("id", teamId).select("*").single();
  if (error?.code === "23505") return NextResponse.json({ error: "Dit team bestaat al binnen de club." }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data.status === "active") {
    const { data: existingOperationalTeam } = await ctx.admin.from("teams")
      .select("id").eq("club_team_id", teamId).maybeSingle();
    let operationalTeamId = existingOperationalTeam?.id;
    if (!operationalTeamId) {
      const { data: createdOperationalTeam, error: operationalTeamError } = await ctx.admin.from("teams").insert({
        coach_id: null,
        club_team_id: teamId,
        club_name: null,
        name: data.name
      }).select("id").single();
      if (operationalTeamError) return NextResponse.json({
        error: `De ploeg werd opgeslagen, maar de interne wedstrijdkoppeling kon niet worden aangemaakt: ${operationalTeamError.message}`
      }, { status: 500 });
      operationalTeamId = createdOperationalTeam.id;
    } else if (name) {
      await ctx.admin.from("teams").update({ name: data.name }).eq("id", operationalTeamId);
    }

    const { data: activeAssignments } = await ctx.admin.from("club_trainer_teams")
      .select("club_trainers(profile_id)").eq("club_team_id", teamId).eq("status", "active");
    const staffRows = (activeAssignments ?? []).flatMap((assignment) => {
      const trainer = assignment.club_trainers as unknown as { profile_id: string | null } | null;
      return trainer?.profile_id
        ? [{ team_id: operationalTeamId!, user_id: trainer.profile_id, added_by: ctx.user.id }]
        : [];
    });
    if (staffRows.length) {
      await ctx.admin.from("team_staff_members").upsert(staffRows, {
        onConflict: "team_id,user_id",
        ignoreDuplicates: true
      });
    }
  }
  if (status === "rejected") {
    await ctx.admin.from("club_trainer_teams").update({ status: "rejected" }).eq("club_team_id", teamId);
  } else if (status === "active") {
    await ctx.admin.from("club_trainer_teams").update({ status: "active" }).eq("club_team_id", teamId).eq("status", "pending");
  }
  return NextResponse.json({ team: data });
}

export async function PUT(request: Request) {
  const ctx = await context(request);
  if ("response" in ctx) return ctx.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const teamId = text(body?.teamId, 36);
  const profileId = text(body?.profileId, 36);
  const role = text(body?.role, 30);
  const remove = body?.remove === true;
  if (!teamId || !profileId || (!remove && !teamRoles.has(role))) return NextResponse.json({ error: "Ongeldige gebruikerstoewijzing." }, { status: 400 });
  const { data: team } = await ctx.admin.from("club_teams").select("club_id").eq("id", teamId).maybeSingle();
  if (!team || !await canManageTeam(ctx.admin, ctx.user.id, team.club_id, teamId, ctx.platformAdmin)) return NextResponse.json({ error: "Geen toegang tot deze ploeg." }, { status: 403 });
  const { data: trainer } = await ctx.admin.from("club_trainers").select("id").eq("club_id", team.club_id).eq("profile_id", profileId).maybeSingle();
  if (!trainer) return NextResponse.json({ error: "Gebruiker is geen lid van deze club." }, { status: 400 });
  const { data: operationalTeam } = await ctx.admin.from("teams").select("id").eq("club_team_id", teamId).maybeSingle();
  if (remove) {
    const { error } = await ctx.admin.from("club_trainer_teams").delete().eq("trainer_id", trainer.id).eq("club_team_id", teamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (operationalTeam) await ctx.admin.from("team_staff_members").delete().eq("team_id", operationalTeam.id).eq("user_id", profileId);
  } else {
    const { error } = await ctx.admin.from("club_trainer_teams").upsert({ trainer_id: trainer.id, club_team_id: teamId, role, status: "active" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (operationalTeam) await ctx.admin.from("team_staff_members").upsert({ team_id: operationalTeam.id, user_id: profileId, added_by: ctx.user.id }, { onConflict: "team_id,user_id", ignoreDuplicates: true });
  }
  return NextResponse.json({ ok: true });
}
