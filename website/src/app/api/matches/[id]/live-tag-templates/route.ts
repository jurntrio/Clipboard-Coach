import { NextResponse } from "next/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("club_id, club_team_id").eq("id", params.id).maybeSingle();
  if (!match?.club_id) return NextResponse.json({ tags: [] });
  const access = await getClubAccess(match.club_id, user);
  if (!hasClubPermission(access, "games.view") || !canAccessTeam(access, match.club_team_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await admin.from("club_live_tag_templates")
    .select("name, live_start_offset_seconds, live_end_offset_seconds")
    .eq("club_id", match.club_id).order("display_order").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tags: data ?? [] });
}
