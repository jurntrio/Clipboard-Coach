import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  const { data } = await admin.from("club_memberships").select("id").eq("club_id", clubId)
    .eq("profile_id", userId).eq("role", "club_admin").eq("status", "active").maybeSingle();
  return !!data;
}

function text(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export async function POST(request: Request) {
  const ctx = await context(request);
  if ("response" in ctx) return ctx.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const clubId = text(body?.clubId, 36);
  const name = text(body?.name);
  if (!clubId || !name) return NextResponse.json({ error: "Club en teamnaam zijn verplicht." }, { status: 400 });
  if (!await canManage(ctx.admin, ctx.user.id, clubId, ctx.platformAdmin)) return NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 });
  const { data, error } = await ctx.admin.from("club_teams").insert({
    club_id: clubId, name, normalized_name: name,
    age_category: text(body?.ageCategory, 60) || null,
    level_or_competition: text(body?.levelOrCompetition, 100) || null,
    status: "active", created_by: ctx.user.id, approved_by: ctx.user.id, approved_at: new Date().toISOString()
  }).select("*").single();
  if (error?.code === "23505") return NextResponse.json({ error: "Dit team bestaat al binnen de club." }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ctx = await context(request);
  if ("response" in ctx) return ctx.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const teamId = text(body?.teamId, 36);
  const { data: team } = await ctx.admin.from("club_teams").select("id, club_id, status").eq("id", teamId).maybeSingle();
  if (!team) return NextResponse.json({ error: "Team niet gevonden." }, { status: 404 });
  if (!await canManage(ctx.admin, ctx.user.id, team.club_id, ctx.platformAdmin)) return NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 });

  const action = text(body?.action, 20);
  if (action === "merge") {
    const targetTeamId = text(body?.targetTeamId, 36);
    if (!targetTeamId || targetTeamId === teamId) return NextResponse.json({ error: "Kies een ander doelteam." }, { status: 400 });
    const { data: target } = await ctx.admin.from("club_teams").select("id, club_id, status").eq("id", targetTeamId).maybeSingle();
    if (!target || target.club_id !== team.club_id || !["active", "pending"].includes(target.status)) {
      return NextResponse.json({ error: "Doelteam hoort niet bij dezelfde club." }, { status: 400 });
    }
    const { error } = await ctx.admin.rpc("merge_club_teams", { source_team_id: teamId, target_team_id: targetTeamId, actor_id: ctx.user.id, platform_override: ctx.platformAdmin });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ merged: true });
  }

  const status = text(body?.status, 20);
  if (status && !teamStatuses.has(status)) return NextResponse.json({ error: "Ongeldige status." }, { status: 400 });
  const update: Record<string, unknown> = {};
  const name = text(body?.name);
  if (name) update.name = name;
  if ("ageCategory" in (body ?? {})) update.age_category = text(body?.ageCategory, 60) || null;
  if ("levelOrCompetition" in (body ?? {})) update.level_or_competition = text(body?.levelOrCompetition, 100) || null;
  if (status) update.status = status;
  if (status === "active" && team.status === "pending") Object.assign(update, { approved_by: ctx.user.id, approved_at: new Date().toISOString() });
  const { data, error } = await ctx.admin.from("club_teams").update(update).eq("id", teamId).select("*").single();
  if (error?.code === "23505") return NextResponse.json({ error: "Dit team bestaat al binnen de club." }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
  if (!team || !await canManage(ctx.admin, ctx.user.id, team.club_id, ctx.platformAdmin)) return NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 });
  const { data: trainer } = await ctx.admin.from("club_trainers").select("id").eq("club_id", team.club_id).eq("profile_id", profileId).maybeSingle();
  if (!trainer) return NextResponse.json({ error: "Gebruiker is geen lid van deze club." }, { status: 400 });
  if (remove) {
    const { error } = await ctx.admin.from("club_trainer_teams").delete().eq("trainer_id", trainer.id).eq("club_team_id", teamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await ctx.admin.from("club_trainer_teams").upsert({ trainer_id: trainer.id, club_team_id: teamId, role, status: "active" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
