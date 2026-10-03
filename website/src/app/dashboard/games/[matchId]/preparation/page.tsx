import { pageTitle } from "@/lib/page-metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { MatchPreparationPage } from "@/components/matches/MatchPreparationPage";

export default async function PreparationPage({ params }: { params: { matchId: string } }) {
  const { user } = await getClubContext();
  if (!user) notFound();
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("*").eq("id", params.matchId).maybeSingle();
  if (!match?.club_id) notFound();
  const access = await getClubAccess(match.club_id, user);
  if (!canAccessTeam(access, match.club_team_id)
    || (!hasClubPermission(access, "games.planning.manage")
      && !hasClubPermission(access, "games.selection.manage")
      && !hasClubPermission(access, "games.tag")
      && !hasClubPermission(access, "games.tag_link.create"))) notFound();
  return <main className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-7">
    <Link href={`/dashboard/games/${match.id}`} className="text-sm font-semibold text-accent hover:underline">← Terug naar wedstrijdinfo</Link>
    <MatchPreparationPage match={match} />
  </main>;
}

export const generateMetadata = pageTitle("page.matchPreparation");
