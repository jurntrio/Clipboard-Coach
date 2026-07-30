import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, club_id, club_team_id").eq("id", params.id).maybeSingle();
  if (!match?.club_id) return Response.json({ error: "Wedstrijd niet gevonden." }, { status: 404 });
  const access = await getClubAccess(match.club_id, user);
  if (!hasClubPermission(access, "games.communication.manage") || !canAccessTeam(access, match.club_team_id)) {
    return Response.json({ error: "Geen recht om publieke wedstrijdinformatie te beheren." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const sponsorSource = ["none", "club", "team"].includes(body?.sponsorSource) ? body.sponsorSource : "none";
  const { data: club } = await admin.from("clubs").select("clip_advertising_enabled").eq("id", match.club_id).maybeSingle();
  const resolvedSponsorSource = club?.clip_advertising_enabled ? sponsorSource : "none";
  const scoreA = body?.scoreA === null || body?.scoreA === "" ? null : Number(body?.scoreA);
  const scoreB = body?.scoreB === null || body?.scoreB === "" ? null : Number(body?.scoreB);
  if ((scoreA !== null && (!Number.isInteger(scoreA) || scoreA < 0)) || (scoreB !== null && (!Number.isInteger(scoreB) || scoreB < 0))) {
    return Response.json({ error: "Ongeldige uitslag." }, { status: 400 });
  }
  const payload = {
    score_a: scoreA,
    score_b: scoreB,
    public_location: typeof body?.location === "string" ? body.location.trim().slice(0, 180) || null : null,
    show_public_location: body?.showLocation === true,
    sponsor_source: resolvedSponsorSource,
    sponsor_caption: typeof body?.sponsorCaption === "string" ? body.sponsorCaption.trim().slice(0, 240) || null : null
  };
  const { data, error } = await admin.from("matches").update(payload).eq("id", match.id).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ match: data });
}
