import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: match } = await admin.from("matches")
    .select("*, match_videos(id, sequence_order, label, is_primary, videos(*))")
    .eq("id", params.id)
    .maybeSingle();
  if (!match?.club_id) return NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 });

  const access = await getClubAccess(match.club_id, user);
  if (!hasClubPermission(access, "games.view") || !hasClubPermission(access, "video.view") || !canAccessTeam(access, match.club_team_id)) {
    return NextResponse.json({ error: "Geen toegang tot de wedstrijdbeelden." }, { status: 403 });
  }

  return NextResponse.json({ match });
}
