import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

const approvableFunctionRoles = new Set(["trainer", "assistant_trainer", "team_manager", "doctor", "physiotherapist", "video_analyst", "youth_coordinator", "scout", "custom"]);

async function authorized() {
  const context = await getClubContext();
  if (!context.user) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  if (!context.activeClubId) return { response: NextResponse.json({ error: "Geen actieve club." }, { status: 400 }) };
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!["club_admin", "platform_admin"].includes(access.role) && !hasClubPermission(access, "teams.manage_all")) {
    return { response: NextResponse.json({ error: "Je hebt geen toegang om aanvragen te beoordelen." }, { status: 403 }) };
  }
  return { clubId: context.activeClubId, userId: context.user.id, admin: createAdminClient() };
}

export async function GET() {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  const [memberships, teams, claims, registrations, players, activeTeams] = await Promise.all([
    auth.admin.from("club_memberships")
      .select("profile_id, role, function_role, created_at, profiles(email, full_name)")
      .eq("club_id", auth.clubId).eq("status", "pending").order("created_at"),
    auth.admin.from("club_teams")
      .select("id, name, age_category, level_or_competition, created_at, created_by, profiles!club_teams_created_by_fkey(email, full_name)")
      .eq("club_id", auth.clubId).eq("status", "pending").order("created_at"),
    auth.admin.from("person_claim_reviews")
      .select("id, requested_profile_id, reason, created_at, profiles!person_claim_reviews_requested_profile_id_fkey(email, full_name), people(first_name, last_name)")
      .eq("club_id", auth.clubId).eq("status", "pending").order("created_at"),
    auth.admin.from("club_registration_requests")
      .select("id, profile_id, request_kind, requested_function_role, requested_custom_role, requested_team_id, player_first_name, player_last_name, player_date_of_birth, created_at, profiles(email, full_name)")
      .eq("club_id", auth.clubId).eq("status", "pending").order("created_at"),
    auth.admin.from("club_players").select("id, first_name, last_name, date_of_birth")
      .eq("club_id", auth.clubId).order("last_name").order("first_name"),
    auth.admin.from("club_teams").select("id, name, club_seasons!inner(status)").eq("club_id", auth.clubId).eq("status", "active")
      .eq("club_seasons.status", "ACTIVE").order("display_order").order("name")
  ]);
  const error = memberships.error || teams.error || claims.error || registrations.error || players.error || activeTeams.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memberships: memberships.data ?? [], teams: teams.data ?? [], claims: claims.data ?? [], registrations: registrations.data ?? [], players: players.data ?? [], activeTeams: activeTeams.data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null) as { type?: string; id?: string; decision?: string; functionRole?: string; customRoleName?: string; teamIds?: string[]; clubPlayerId?: string } | null;
  if (!body?.id || !["approved", "rejected"].includes(body.decision ?? "")) {
    return NextResponse.json({ error: "Ongeldige beoordeling." }, { status: 400 });
  }
  const status = body.decision === "approved" ? "active" : "rejected";
  if (body.type === "registration") {
    const { data: registration } = await auth.admin.from("club_registration_requests").select("*")
      .eq("id", body.id).eq("club_id", auth.clubId).eq("status", "pending").maybeSingle();
    if (!registration) return NextResponse.json({ error: "Registratieaanvraag niet gevonden." }, { status: 404 });
    if (body.decision === "rejected") {
      await auth.admin.from("club_registration_requests").update({ status: "rejected", reviewed_by: auth.userId, reviewed_at: new Date().toISOString() }).eq("id", body.id);
      return NextResponse.json({ updated: true });
    }
    if (registration.request_kind === "contact") {
      if (!body.clubPlayerId) return NextResponse.json({ error: "Kies eerst de juiste speler." }, { status: 400 });
      const { data: player } = await auth.admin.from("club_players").select("id").eq("id", body.clubPlayerId).eq("club_id", auth.clubId).maybeSingle();
      if (!player) return NextResponse.json({ error: "Speler niet gevonden binnen deze club." }, { status: 404 });
      const { error: linkError } = await auth.admin.from("player_guardians").upsert({ club_player_id: player.id, player_id: null, profile_id: registration.profile_id, access_scope: "from_acceptance", valid_from: new Date().toISOString(), valid_until: null, revoked_at: null }, { onConflict: "club_player_id,profile_id" });
      if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 });
      await auth.admin.from("profiles").update({ account_role: "player_parent" }).eq("id", registration.profile_id);
    } else {
      const functionRole = body.functionRole?.trim();
      if (!functionRole || !approvableFunctionRoles.has(functionRole) || functionRole === "custom" && !body.customRoleName?.trim()) return NextResponse.json({ error: "Kies een geldige definitieve functie." }, { status: 400 });
      const technicalRole = functionRole === "video_analyst" ? "analyst" : functionRole === "team_manager" ? "team_manager" : functionRole === "assistant_trainer" ? "assistant_coach" : "trainer";
      const teamIds = [...new Set((body.teamIds ?? []).filter(Boolean))];
      if (teamIds.length) {
        const { count } = await auth.admin.from("club_teams").select("id, club_seasons!inner(status)", { count: "exact", head: true }).eq("club_id", auth.clubId).eq("club_seasons.status", "ACTIVE").in("id", teamIds);
        if (count !== teamIds.length) return NextResponse.json({ error: "Een gekozen team behoort niet tot deze club." }, { status: 400 });
      }
      const { error: memberError } = await auth.admin.from("club_memberships").upsert({ club_id: auth.clubId, profile_id: registration.profile_id, role: technicalRole, status: "active", function_role: functionRole, custom_role_name: functionRole === "custom" ? body.customRoleName?.trim() : null, team_scope: teamIds.length ? "assigned" : "none" }, { onConflict: "club_id,profile_id" });
      if (memberError) return NextResponse.json({ error: memberError.message }, { status: 400 });
      await auth.admin.from("club_member_team_access").delete().eq("club_id", auth.clubId).eq("profile_id", registration.profile_id);
      if (teamIds.length) await auth.admin.from("club_member_team_access").insert(teamIds.map(clubTeamId => ({ club_id: auth.clubId, profile_id: registration.profile_id, club_team_id: clubTeamId })));
      await auth.admin.from("profiles").update({ account_role: technicalRole === "analyst" ? "analyst" : technicalRole === "team_manager" ? "team_manager" : technicalRole === "assistant_coach" ? "assistant_coach" : "coach" }).eq("id", registration.profile_id);
    }
    await auth.admin.from("club_registration_requests").update({ status: "approved", reviewed_by: auth.userId, reviewed_at: new Date().toISOString() }).eq("id", body.id);
    return NextResponse.json({ updated: true });
  }
  if (body.type === "membership") {
    const { data, error } = await auth.admin.from("club_memberships").update({ status })
      .eq("club_id", auth.clubId).eq("profile_id", body.id).eq("status", "pending").select("profile_id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Aanvraag niet gevonden." }, { status: 404 });
    const { data: trainer } = await auth.admin.from("club_trainers").select("id").eq("club_id", auth.clubId).eq("profile_id", body.id).maybeSingle();
    if (trainer) await auth.admin.from("club_trainer_teams").update({ status }).eq("trainer_id", trainer.id).eq("status", "pending");
    return NextResponse.json({ updated: true });
  }
  if (body.type === "claim") {
    const { data: review } = await auth.admin.from("person_claim_reviews").select("id")
      .eq("id", body.id).eq("club_id", auth.clubId).eq("status", "pending").maybeSingle();
    if (!review) return NextResponse.json({ error: "Persoonsaanvraag niet gevonden." }, { status: 404 });
    const { error } = await auth.admin.rpc("review_person_claim", {
      target_review_id: body.id, decision: body.decision, actor_profile_id: auth.userId
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ updated: true });
  }
  return NextResponse.json({ error: "Onbekend aanvraagtype." }, { status: 400 });
}
