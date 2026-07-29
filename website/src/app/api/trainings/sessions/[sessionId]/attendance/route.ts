import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function PUT(request: Request, { params }: { params: { sessionId: string } }) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: session } = await admin.from("team_training_sessions")
    .select("id, club_id, club_team_id, attendance_confirmed_at").eq("id", params.sessionId).eq("club_id", context.activeClubId).maybeSingle();
  if (!session) return NextResponse.json({ error: "Training niet gevonden." }, { status: 404 });
  const access = await getClubAccess(context.activeClubId, context.user);
  const { data: ownTrainer } = await admin.from("club_trainers").select("id")
    .eq("club_id", context.activeClubId).eq("profile_id", context.user.id).maybeSingle();
  const { data: sessionStaff } = await admin.from("team_training_sessions").select("staff_ids").eq("id", session.id).single();
  const assignedStaff = sessionStaff?.staff_ids?.includes(ownTrainer?.id ?? "") === true;
  if ((!canAccessTeam(access, session.club_team_id) && !assignedStaff) || access.readOnly || !hasClubPermission(access, "training.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as {
    action?: "confirm" | "trainer_info"; trainerInfo?: string;
    playerId?: string; status?: "unknown" | "present" | "absent"; reasonId?: string | null; note?: string | null;
  } | null;
  if (body?.action === "trainer_info") {
    const trainerInfo = body.trainerInfo?.trim().slice(0, 1000) || null;
    const { error } = await admin.from("team_training_sessions").update({ trainer_info: trainerInfo }).eq("id", session.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ trainerInfo });
  }
  if (body?.action === "confirm") {
    const confirmedAt = new Date().toISOString();
    const { error } = await admin.from("team_training_sessions").update({
      attendance_confirmed_at: confirmedAt, attendance_confirmed_by: context.user.id
    }).eq("id", session.id).is("attendance_confirmed_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ confirmedAt });
  }
  if (session.attendance_confirmed_at) return NextResponse.json({ error: "De aanwezigheden zijn al bevestigd." }, { status: 409 });
  if (!body?.playerId || !["unknown", "present", "absent"].includes(body.status ?? "")) {
    return NextResponse.json({ error: "Ongeldige aanwezigheidsstatus." }, { status: 400 });
  }
  const { data: player } = await admin.from("players").select("id, teams!inner(club_team_id)")
    .eq("id", body.playerId).eq("teams.club_team_id", session.club_team_id).maybeSingle();
  if (!player) return NextResponse.json({ error: "Speler behoort niet tot dit team." }, { status: 400 });
  if (body.status === "absent" && body.reasonId) {
    const { data: reason } = await admin.from("club_match_options").select("id").eq("id", body.reasonId)
      .eq("club_id", session.club_id).eq("option_type", "non_selection_reason").eq("active", true).maybeSingle();
    if (!reason) return NextResponse.json({ error: "Ongeldige afwezigheidsreden." }, { status: 400 });
  }
  const row = {
    training_session_id: session.id,
    player_id: body.playerId,
    attendance_status: body.status,
    absence_reason_id: body.status === "absent" ? body.reasonId || null : null,
    note: body.note?.trim().slice(0, 500) || null,
    updated_by: context.user.id,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await admin.from("team_training_attendance").upsert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ attendance: data });
}
