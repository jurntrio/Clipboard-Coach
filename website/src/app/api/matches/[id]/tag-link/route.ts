import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasScheduledEventEnded } from "@/lib/schedule-status";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, coach_id, club_id, club_team_id, match_date, start_time, status, live_tag_names").eq("id", params.id).maybeSingle();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.club_id) {
    const access = await getClubAccess(match.club_id, user);
    if (!hasClubPermission(access, "games.tag_link.create") || !canAccessTeam(access, match.club_team_id)) {
      return NextResponse.json({ error: "Geen recht om voor deze wedstrijd een taglink te maken." }, { status: 403 });
    }
  } else if (match.coach_id !== user.id) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  if (match.status === "finished" || hasScheduledEventEnded(match.match_date, match.start_time)) {
    return NextResponse.json({ error: "Voor een afgelopen wedstrijd kan geen taglink meer worden gemaakt." }, { status: 409 });
  }

  if (match.club_id && !(match.live_tag_names?.length)) {
    const { data: defaults } = await admin.from("club_live_tag_templates").select("name").eq("club_id", match.club_id).order("display_order").order("created_at");
    if (defaults?.length) await admin.from("matches").update({ live_tag_names: defaults.map(tag => tag.name) }).eq("id", match.id);
  }

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
  if (error?.code === "23505") {
    const { data: concurrentLink } = await admin.from("match_tag_links").select("id, token")
      .eq("match_id", match.id).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (concurrentLink) return NextResponse.json(concurrentLink);
  }
  if (error || !data) return NextResponse.json({ error: error?.message || "Could not create tag link" }, { status: 500 });
  return NextResponse.json(data);
}
