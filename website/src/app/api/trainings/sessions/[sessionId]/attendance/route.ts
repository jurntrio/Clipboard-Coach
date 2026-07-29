import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function PUT(request: Request, { params }: { params: { sessionId: string } }) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: session } = await admin.from("team_training_sessions")
    .select("id, club_id, club_team_id").eq("id", params.sessionId).eq("club_id", context.activeClubId).maybeSingle();
  if (!session) return NextResponse.json({ error: "Training niet gevonden." }, { status: 404 });
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!canAccessTeam(access, session.club_team_id) || access.readOnly || !hasClubPermission(access, "teams.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as {
    playerId?: string; status?: "unknown" | "present" | "absent"; reasonId?: string | null; note?: string | null;
  } | null;
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
