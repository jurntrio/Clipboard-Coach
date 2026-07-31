import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

const fields = [
  "lineup_notes", "general_report", "positives", "improvements",
  "highlights", "goals", "cards", "chances"
] as const;

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, club_id, club_team_id").eq("id", params.id).maybeSingle();
  if (!match?.club_id) return NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 });
  const access = await getClubAccess(match.club_id, user);
  const canEditDossier = hasClubPermission(access, "games.report.manage");
  const canEditScouting = hasClubPermission(access, "games.scouting.manage");
  if ((!canEditDossier && !canEditScouting) || !canAccessTeam(access, match.club_team_id)) {
    return NextResponse.json({ error: "Je mag dit wedstrijddossier niet aanpassen." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Ongeldige gegevens." }, { status: 400 });
  const payload = canEditDossier ? Object.fromEntries(fields.map(field => [
    field, typeof body[field] === "string" ? body[field].trim().slice(0, 10000) : ""
  ])) : {};
  const scouting = canEditScouting && typeof body.scouting === "string"
    ? { scouting: body.scouting.trim().slice(0, 10000) } : {};
  const goalEvents = canEditDossier && Array.isArray(body.goal_events) ? body.goal_events.slice(0, 30).map((event: any) => ({
    id: typeof event?.id === "string" ? event.id.slice(0, 100) : "",
    team: event?.team === "away" ? "away" : "home",
    scoreAfter: typeof event?.scoreAfter === "string" && /^\d{1,2}-\d{1,2}$/.test(event.scoreAfter) ? event.scoreAfter : "",
    minute: Number.isInteger(event?.minute) && event.minute >= 0 && event.minute <= 120 ? event.minute : null,
    scorerType: ["", "player", "own_goal", "custom"].includes(event?.scorerType) ? event.scorerType : "",
    scorerPlayerId: typeof event?.scorerPlayerId === "string" ? event.scorerPlayerId.slice(0, 100) : "",
    scorerName: typeof event?.scorerName === "string" ? event.scorerName.trim().slice(0, 150) : "",
    assistType: ["player", "own_goal", "custom", "none"].includes(event?.assistType) ? event.assistType : "none",
    assistPlayerId: typeof event?.assistPlayerId === "string" ? event.assistPlayerId.slice(0, 100) : "",
    assistName: typeof event?.assistName === "string" ? event.assistName.trim().slice(0, 150) : "",
    description: typeof event?.description === "string" ? event.description.trim().slice(0, 1000) : ""
  })) : [];
  const { error } = await admin.from("match_dossiers").upsert({
    match_id: match.id, ...payload, ...scouting,
    ...(canEditDossier ? { goal_events: goalEvents } : {}),
    updated_by: user.id, updated_at: new Date().toISOString()
  }, { onConflict: "match_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, club_id, club_team_id").eq("id", params.id).maybeSingle();
  if (!match?.club_id) return NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 });
  const access = await getClubAccess(match.club_id, user);
  if (!hasClubPermission(access, "games.create") || !canAccessTeam(access, match.club_team_id)) {
    return NextResponse.json({ error: "Je mag deze wedstrijd niet afwerken." }, { status: 403 });
  }
  const { error } = await admin.from("matches").update({
    status: "finished", completed_by: user.id, completed_at: new Date().toISOString()
  }).eq("id", match.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from("match_tag_links").update({ active: false }).eq("match_id", match.id);
  return NextResponse.json({ ok: true });
}
