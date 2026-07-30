import { NextResponse } from "next/server";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function authorized(clubId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const access = await getClubAccess(clubId, user);
  if (!["club_admin", "platform_admin"].includes(access.role)) {
    return { error: NextResponse.json({ error: "Geen toegang." }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request) {
  const clubId = new URL(request.url).searchParams.get("clubId");
  if (!clubId) return NextResponse.json({ error: "Club ontbreekt." }, { status: 400 });
  const auth = await authorized(clubId);
  if (auth.error) return auth.error;
  const { data, error } = await createAdminClient().from("person_claim_reviews")
    .select(`
      id, requested_profile_id, candidate_person_id, reason, evidence, status, created_at,
      profiles!person_claim_reviews_requested_profile_id_fkey(email, full_name),
      people(first_name, last_name, date_of_birth)
    `)
    .eq("club_id", clubId).eq("status", "pending").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ claims: data ?? [] });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubId !== "string" || typeof body.reviewId !== "string"
    || !["approved", "rejected"].includes(body.decision)) {
    return NextResponse.json({ error: "Ongeldige beoordeling." }, { status: 400 });
  }
  const auth = await authorized(body.clubId);
  if (auth.error || !auth.user) return auth.error;
  const admin = createAdminClient();
  const { data: review } = await admin.from("person_claim_reviews").select("id")
    .eq("id", body.reviewId).eq("club_id", body.clubId).eq("status", "pending").maybeSingle();
  if (!review) return NextResponse.json({ error: "Review niet gevonden." }, { status: 404 });
  const { data, error } = await admin.rpc("review_person_claim", {
    target_review_id: body.reviewId,
    decision: body.decision,
    actor_profile_id: auth.user.id
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ personAccountId: data });
}
