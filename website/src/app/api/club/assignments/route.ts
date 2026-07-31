import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { matchId?: string; trainerId?: string; visible?: boolean } | null;
  if (!body?.matchId || !body.trainerId || typeof body.visible !== "boolean") {
    return NextResponse.json({ error: "Invalid assignment" }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: match }, { data: trainer }] = await Promise.all([
    admin.from("matches").select("id, club_id").eq("id", body.matchId).maybeSingle(),
    admin.from("club_trainers").select("id, club_id").eq("id", body.trainerId).maybeSingle()
  ]);
  if (!match?.club_id || !trainer || trainer.club_id !== match.club_id) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  const { data: membership } = await admin
    .from("club_memberships")
    .select("role")
    .eq("club_id", match.club_id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!isAdminEmail(user.email) && membership?.role !== "club_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin.from("club_match_assignments").upsert({
    match_id: match.id,
    trainer_id: trainer.id,
    visible: body.visible,
    assignment_source: "manual",
    updated_at: new Date().toISOString()
  }, { onConflict: "match_id,trainer_id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { matchId?: string; clubTeamId?: string } | null;
  if (!body?.matchId || !body.clubTeamId) {
    return NextResponse.json({ error: "Wedstrijd en ploeg zijn verplicht." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: match }, { data: targetTeam }] = await Promise.all([
    admin.from("matches").select("id, club_id").eq("id", body.matchId).maybeSingle(),
    admin.from("club_teams").select("id, club_id, name, status, teams(id)")
      .eq("id", body.clubTeamId).maybeSingle()
  ]);
  if (!match?.club_id || !targetTeam || targetTeam.club_id !== match.club_id || targetTeam.status !== "active") {
    return NextResponse.json({ error: "Wedstrijd of actieve ploeg niet gevonden." }, { status: 404 });
  }
  const { data: membership } = await admin.from("club_memberships").select("role")
    .eq("club_id", match.club_id).eq("profile_id", user.id).maybeSingle();
  if (!isAdminEmail(user.email) && membership?.role !== "club_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const operationalTeam = (targetTeam.teams as unknown as Array<{ id: string }> | null)?.[0];
  if (!operationalTeam) {
    return NextResponse.json({
      error: "De gekozen ploeg is intern nog niet klaar voor wedstrijden. Sla de ploeg eerst opnieuw op."
    }, { status: 400 });
  }

  // Oude automatische zichtbaarheid hoort bij de vorige ploeg. Handmatige
  // overrides blijven bestaan; de match-trigger vult de nieuwe ploeg aan.
  const { error: clearError } = await admin.from("club_match_assignments").delete()
    .eq("match_id", match.id).eq("assignment_source", "automatic");
  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });
  const { data, error } = await admin.from("matches").update({
    club_team_id: targetTeam.id,
    team_a_id: operationalTeam.id
  }).eq("id", match.id).select("id, club_team_id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ match: data, teamName: targetTeam.name });
}
