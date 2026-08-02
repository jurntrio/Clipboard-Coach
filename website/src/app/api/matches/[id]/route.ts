import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteObject } from "@/lib/r2/upload";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const platformAdmin = isAdminEmail(user.email);
  const database = createAdminClient();
  const { data: match } = await database.from("matches").select("id, coach_id, club_id, club_team_id").eq("id", params.id).maybeSingle();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.club_id) {
    const access = await getClubAccess(match.club_id, user);
    if (!hasClubPermission(access, "games.create") || !canAccessTeam(access, match.club_team_id)) {
      return NextResponse.json({ error: "Geen recht om deze wedstrijd te verwijderen." }, { status: 403 });
    }
    if (access.teamIds !== null && match.club_team_id) {
      const { data: clubTeam } = await database.from("club_teams").select("trainers_can_manage_matches").eq("id", match.club_team_id).maybeSingle();
      if (!clubTeam?.trainers_can_manage_matches) {
        return NextResponse.json({ error: "De clubadmin staat niet toe dat trainers wedstrijden voor deze ploeg beheren." }, { status: 403 });
      }
    }
  } else if (!platformAdmin && match.coach_id !== user.id) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const { data: cleanup, error: deleteError } = await database.rpc("delete_match_transaction", { target_match_id: match.id });
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  const keys = [...((cleanup as { clipKeys?: string[] } | null)?.clipKeys ?? []),
    ...((cleanup as { videoKeys?: string[] } | null)?.videoKeys ?? [])];
  const cleanupResults = await Promise.allSettled(keys.map((key) => deleteObject(key)));
  const cleanupFailed = cleanupResults.some((result) => result.status === "rejected");

  return NextResponse.json({ deleted: true, cleanupPending: cleanupFailed });
}
