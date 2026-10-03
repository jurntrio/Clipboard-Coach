import { pageTitle } from "@/lib/page-metadata";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getClubContext } from "@/lib/auth/active-club";
import { ACTIVE_TEAM_COOKIE, readActiveTeamSelection } from "@/lib/auth/active-team";
import { canAccessTeam, getClubAccess } from "@/lib/auth/club-access";
import { resolveDefaultTeamId } from "@/lib/auth/default-team";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamSelectionGate } from "@/components/teams/TeamSelectionGate";

const LARGE_TEAM_LIST = 6;

export default async function TeamsPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const context = await getClubContext();
  if (!context.user) redirect("/login");
  if (!context.activeClubId) redirect("/dashboard");

  const admin = createAdminClient();
  const [access, { data: activeSeason }] = await Promise.all([
    getClubAccess(context.activeClubId, context.user),
    admin.from("club_seasons").select("id").eq("club_id", context.activeClubId).eq("status", "ACTIVE").maybeSingle()
  ]);
  const { data: clubTeams } = activeSeason
    ? await admin.from("club_teams").select("id, name").eq("club_id", context.activeClubId).eq("season_id", activeSeason.id).neq("status", "merged").order("display_order").order("name")
    : { data: [] };
  const accessibleIds = (clubTeams ?? []).filter(team => canAccessTeam(access, team.id)).map(team => team.id);
  if (!accessibleIds.length) redirect("/dashboard");

  const selection = readActiveTeamSelection(cookies().get(ACTIVE_TEAM_COOKIE)?.value, new Set(accessibleIds));
  if (accessibleIds.length >= LARGE_TEAM_LIST && !selection.teamId) {
    const names = new Map((clubTeams ?? []).map(team => [team.id, team.name]));
    return <TeamSelectionGate teams={accessibleIds.map(id => ({ id, name: names.get(id) ?? "Ploeg" }))} destination="/dashboard/teams" />;
  }
  const selectedClubTeamId = selection.teamId
    ?? await resolveDefaultTeamId(admin, context.activeClubId, context.user.id, accessibleIds)
    ?? accessibleIds[0];
  const { data: team } = await admin.from("teams").select("id").eq("club_team_id", selectedClubTeamId).maybeSingle();
  const tab = ["matches", "training", "statistics", "staff", "evaluations"].includes(searchParams?.tab ?? "") ? `?tab=${searchParams!.tab}` : "";
  if (team?.id) redirect(`/dashboard/teams/${team.id}${tab}`);

  const { data: fallback } = await admin.from("teams").select("id").in("club_team_id", accessibleIds).limit(1).maybeSingle();
  redirect(fallback?.id ? `/dashboard/teams/${fallback.id}${tab}` : "/dashboard");
}

export const generateMetadata = pageTitle("page.teams");
