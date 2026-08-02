import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

async function authorized() {
  const context = await getClubContext();
  if (!context.user) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  if (!context.activeClubId) return { response: NextResponse.json({ error: "Geen actieve club." }, { status: 400 }) };
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!["club_admin", "platform_admin"].includes(access.role)) {
    return { response: NextResponse.json({ error: "Alleen een Club Admin kan aanvragen beoordelen." }, { status: 403 }) };
  }
  return { clubId: context.activeClubId, userId: context.user.id, admin: createAdminClient() };
}

export async function GET() {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  const [memberships, teams, claims] = await Promise.all([
    auth.admin.from("club_memberships")
      .select("profile_id, role, function_role, created_at, profiles(email, full_name)")
      .eq("club_id", auth.clubId).eq("status", "pending").order("created_at"),
    auth.admin.from("club_teams")
      .select("id, name, age_category, level_or_competition, created_at, created_by, profiles!club_teams_created_by_fkey(email, full_name)")
      .eq("club_id", auth.clubId).eq("status", "pending").order("created_at"),
    auth.admin.from("person_claim_reviews")
      .select("id, requested_profile_id, reason, created_at, profiles!person_claim_reviews_requested_profile_id_fkey(email, full_name), people(first_name, last_name)")
      .eq("club_id", auth.clubId).eq("status", "pending").order("created_at")
  ]);
  const error = memberships.error || teams.error || claims.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memberships: memberships.data ?? [], teams: teams.data ?? [], claims: claims.data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null) as { type?: string; id?: string; decision?: string } | null;
  if (!body?.id || !["approved", "rejected"].includes(body.decision ?? "")) {
    return NextResponse.json({ error: "Ongeldige beoordeling." }, { status: 400 });
  }
  const status = body.decision === "approved" ? "active" : "rejected";
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
