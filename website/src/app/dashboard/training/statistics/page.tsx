import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TrainingStatistics, type TrainingStatistic } from "@/components/training/TrainingStatistics";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ACTIVE_TEAM_COOKIE, readActiveTeamSelection } from "@/lib/auth/active-team";
import { resolveDefaultTeamId } from "@/lib/auth/default-team";
import { TeamContextHeader } from "@/components/teams/TeamContextHeader";

export default async function TrainingStatisticsPage() {
  const context = await getClubContext(); const admin = createAdminClient();
  const access = context.activeClubId && context.user ? await getClubAccess(context.activeClubId, context.user) : null;
  const { data: activeSeason } = context.activeClubId ? await admin.from("club_seasons").select("id").eq("club_id", context.activeClubId).eq("status", "ACTIVE").maybeSingle() : { data: null };
  const { data: clubTeams } = context.activeClubId && activeSeason ? await admin.from("club_teams").select("id, name, teams(id, players(id, first_name, last_name, role))").eq("club_id", context.activeClubId).eq("season_id", activeSeason.id).neq("status", "merged").order("display_order").order("name") : { data: [] };
  const teams = (clubTeams ?? []).filter(team => access?.teamIds === null || access?.teamIds.has(team.id));
  const validTeamIds = new Set(teams.map(team => team.id));
  const selection = readActiveTeamSelection(cookies().get(ACTIVE_TEAM_COOKIE)?.value, validTeamIds);
  const activeTeamId = selection.teamId ?? (selection.explicitAll || !context.activeClubId || !context.user ? null : await resolveDefaultTeamId(admin, context.activeClubId, context.user.id, teams.map(team => team.id)));
  const visibleTeams = activeTeamId ? teams.filter(team => team.id === activeTeamId) : teams;
  const teamIds = visibleTeams.map(team => team.id); const today = new Date().toISOString().slice(0, 10);
  const { data: sessions } = teamIds.length ? await admin.from("team_training_sessions").select("id, club_team_id").in("club_team_id", teamIds).lt("training_date", today).not("attendance_confirmed_at", "is", null) : { data: [] };
  const sessionIds = (sessions ?? []).map(session => session.id);
  const { data: attendance } = sessionIds.length ? await admin.from("team_training_attendance").select("training_session_id, player_id, attendance_status").in("training_session_id", sessionIds) : { data: [] };
  const rows: TrainingStatistic[] = visibleTeams.flatMap(team => {
    const teamSessions = (sessions ?? []).filter(session => session.club_team_id === team.id); const ids = new Set(teamSessions.map(session => session.id));
    const operational = team.teams as unknown as { id: string; players: { id: string; first_name: string; last_name: string; role: string }[] }[];
    return operational.flatMap(item => item.players).filter(player => player.role === "player").map(player => ({ playerId: player.id, playerName: `${player.first_name} ${player.last_name}`.trim(), teamId: team.id, teamName: team.name, confirmedTrainings: teamSessions.length, missedTrainings: (attendance ?? []).filter(row => ids.has(row.training_session_id) && row.player_id === player.id && row.attendance_status === "absent").length }));
  });
  return <main className="mx-auto max-w-6xl p-4 sm:p-8"><SectionHeader title="Trainingsstatistieken" artworkSrc="/branding/training.png" showHome={false} /><nav className="mb-5 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2"><Link href="/dashboard/training" className="rounded-lg px-4 py-2 text-sm font-bold text-textPrimary hover:bg-cardDeep">Overzicht</Link><Link href="/dashboard/training/new" className="rounded-lg px-4 py-2 text-sm font-bold text-textPrimary hover:bg-cardDeep">Losse training maken</Link><span className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">Statistieken</span><Link href="/dashboard/intradesk" className="rounded-lg px-4 py-2 text-sm font-bold text-textPrimary hover:bg-cardDeep">Open Intradesk</Link></nav><TeamContextHeader teams={teams.map(team => ({ id: team.id, name: team.name }))} activeTeamId={activeTeamId} /><TrainingStatistics rows={rows} /></main>;
}
