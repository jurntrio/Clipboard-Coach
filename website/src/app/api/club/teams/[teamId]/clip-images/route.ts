import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { clipImagesAllowed, writeImageObject } from "@/lib/clip-images-server";

async function context(teamId: string) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return null;
  const { data: team } = await createAdminClient().from("club_teams").select("id,club_id,season_id").eq("id", teamId).single();
  if (!team) return null;
  const access = await getClubAccess(team.club_id, user);
  if (access.readOnly || !hasClubPermission(access, "teams.manage") || !canAccessTeam(access, teamId)) return null;
  if (team.season_id) {
    const { data: season } = await createAdminClient().from("club_seasons").select("status").eq("id", team.season_id).single();
    if (!season || season.status === "ARCHIVED") return null;
  }
  return team;
}
export async function GET(_request: Request, { params }: { params: { teamId: string } }) {
  try {
    if (!await context(params.teamId)) return NextResponse.json({ error: "Geen recht om deze ploeginstelling te beheren." }, { status: 403 });
    return NextResponse.json({ allowed: await clipImagesAllowed(params.teamId) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "De ploeginstelling kon niet worden geladen." }, { status: 500 }); }
}
export async function PUT(request: Request, { params }: { params: { teamId: string } }) {
  try {
    if (!await context(params.teamId)) return NextResponse.json({ error: "Geen recht om deze ploeginstelling te beheren." }, { status: 403 });
    const { allowed } = await request.json();
    if (typeof allowed !== "boolean") return NextResponse.json({ error: "Ongeldige instelling." }, { status: 400 });
    await writeImageObject(`clip-intros/permissions/${params.teamId}.json`, JSON.stringify({ allowed }), "application/json");
    return NextResponse.json({ allowed });
  } catch { return NextResponse.json({ error: "De ploeginstelling kon niet worden bewaard." }, { status: 500 }); }
}
