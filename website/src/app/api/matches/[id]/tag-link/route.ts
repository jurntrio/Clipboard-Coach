import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, coach_id, club_id, club_team_id").eq("id", params.id).maybeSingle();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.club_id) {
    const access = await getClubAccess(match.club_id, user);
    if (!hasClubPermission(access, "games.tag_link.create") || !canAccessTeam(access, match.club_team_id)) {
      return NextResponse.json({ error: "Geen recht om voor deze wedstrijd een taglink te maken." }, { status: 403 });
    }
  } else if (match.coach_id !== user.id) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const { data: existing } = await admin
    .from("match_tag_links")
    .select("id, token")
    .eq("match_id", match.id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json(existing);

  const { data, error } = await admin.from("match_tag_links").insert({ match_id: match.id }).select("id, token").single();
  if (error || !data) return NextResponse.json({ error: error?.message || "Could not create tag link" }, { status: 500 });
  return NextResponse.json(data);
}
