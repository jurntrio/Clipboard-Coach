import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

async function context(manage = false) {
  const club = await getClubContext(); if (!club.user || !club.activeClubId) return null;
  const access = await getClubAccess(club.activeClubId, club.user);
  if (!hasClubPermission(access, manage ? "sponsors.teams.manage" : "sponsors.view")) return null;
  return { clubId: club.activeClubId, userId: club.user.id };
}
export async function GET() {
  const ctx = await context(); if (!ctx) return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
  const admin = createAdminClient();
  const [{ data: relations, error }, { data: legacy }] = await Promise.all([
    admin.from("sponsor_team_relations").select("id, season_id, sponsor_id, assignment_id, club_team_id, relation_type, accent_level, priority_weight, active").eq("club_id", ctx.clubId).eq("active", true),
    admin.from("sponsor_legacy_sources").select("id, source_id, source_url, status, mapped_sponsor_id").eq("club_id", ctx.clubId).eq("source_type", "team")
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ relations: relations ?? [], legacySources: legacy ?? [], canManage: !!(await context(true)) });
}
export async function POST(request: Request) {
  const ctx = await context(true); if (!ctx) return NextResponse.json({ error: "Geen recht om Teamsponsors of Teamaccenten te beheren." }, { status: 403 });
  const body = await request.json(); const admin = createAdminClient();
  if (body.action === "mapLegacy") {
    const { data, error } = await admin.rpc("map_legacy_team_sponsor", { target_legacy_source_id: body.legacySourceId, target_sponsor_id: body.sponsorId, actor_id: ctx.userId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ relationId: data });
  }
  if (body.action === "deactivate") {
    const { error } = await admin.from("sponsor_team_relations").update({ active: false }).eq("id", body.relationId).eq("club_id", ctx.clubId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ ok: true });
  }
  const relationType = body.relationType === "team_accent" ? "team_accent" : "specific_sponsor";
  const [{ data: sponsor }, { data: team }, { data: season }] = await Promise.all([
    admin.from("sponsors").select("id").eq("id", body.sponsorId).eq("club_id", ctx.clubId).eq("active", true).maybeSingle(),
    admin.from("club_teams").select("id, season_id").eq("id", body.teamId).eq("club_id", ctx.clubId).maybeSingle(),
    admin.from("club_seasons").select("id, status").eq("id", body.seasonId).eq("club_id", ctx.clubId).maybeSingle()
  ]);
  if (!sponsor || !team || !season || team.season_id !== season.id) return NextResponse.json({ error: "Sponsor, team of seizoen is ongeldig." }, { status: 400 });
  if (season.status === "ARCHIVED") return NextResponse.json({ error: "Een gearchiveerd seizoen is alleen-lezen." }, { status: 409 });
  const { data, error } = await admin.from("sponsor_team_relations").insert({ club_id: ctx.clubId, season_id: season.id, sponsor_id: sponsor.id,
    assignment_id: body.assignmentId || null, club_team_id: team.id, relation_type: relationType,
    accent_level: relationType === "team_accent" && body.accentLevel === "prominent" ? "prominent" : relationType === "team_accent" ? "extra" : null,
    priority_weight: relationType === "team_accent" && body.accentLevel === "prominent" ? 3 : relationType === "team_accent" ? 2 : 1, created_by: ctx.userId
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Deze teamkoppeling bestaat al." : error.message }, { status: 400 });
  return NextResponse.json({ relationId: data.id }, { status: 201 });
}
