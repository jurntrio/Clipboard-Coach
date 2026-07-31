import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";
import { ProfileOverview, type ProfileActivity, type ProfileContext } from "@/components/profile/ProfileOverview";

type GuardianRow = {
  child_key: string;
  first_name: string;
  last_name: string;
  player_id: string;
  team_id: string | null;
  team_name: string | null;
};

export default async function DashboardHomePage() {
  const clubContext = await getClubContext();
  const user = clubContext.user!;
  const clubId = clubContext.activeClubId;
  const admin = createAdminClient();
  const supabase = createClient();
  const [{ data: profile }, access] = await Promise.all([
    admin.from("profiles").select("full_name, account_role").eq("id", user.id).maybeSingle(),
    clubId ? getClubAccess(clubId, user) : Promise.resolve(null)
  ]);

  const [{ data: trainer }, { data: guardianRowsRaw }] = await Promise.all([
    clubId
      ? admin.from("club_trainers")
          .select("id, display_name, club_trainer_teams(club_team_id, status, club_teams(name))")
          .eq("club_id", clubId).eq("profile_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("guardian_dashboard_players")
  ]);

  const guardianRows = (guardianRowsRaw as GuardianRow[] | null) ?? [];
  const guardianTeamIds = guardianRows.map(row => row.team_id).filter((id): id is string => !!id);
  const { data: guardianTeams } = guardianTeamIds.length
    ? await admin.from("teams").select("id, club_team_id, club_teams(club_id)").in("id", guardianTeamIds)
    : { data: [] };
  const validGuardianTeamIds = new Set((guardianTeams ?? []).filter(team =>
    !clubId || (team.club_teams as unknown as { club_id: string } | null)?.club_id === clubId
  ).map(team => team.id));
  const teamToClubTeam = new Map((guardianTeams ?? []).map(team => [team.id, team.club_team_id as string | null]));

  const contexts: ProfileContext[] = [];
  for (const assignment of trainer?.club_trainer_teams ?? []) {
    if (assignment.status !== "active") continue;
    const team = assignment.club_teams as unknown as { name: string } | null;
    contexts.push({
      id: `trainer:${assignment.club_team_id}`,
      label: team?.name ? `Trainer · ${team.name}` : "Trainer",
      subject: trainer?.display_name || profile?.full_name || "Trainer",
      role: "Trainer",
      teamName: team?.name || "Ploeg",
      clubTeamIds: [assignment.club_team_id],
      teamIds: []
    });
  }
  const groupedChildren = new Map<string, ProfileContext>();
  for (const row of guardianRows.filter(item => !item.team_id || validGuardianTeamIds.has(item.team_id))) {
    const existing = groupedChildren.get(row.child_key);
    const fullName = `${row.first_name} ${row.last_name}`.trim();
    if (existing) {
      if (row.team_id && !existing.teamIds.includes(row.team_id)) existing.teamIds.push(row.team_id);
      const clubTeamId = row.team_id ? teamToClubTeam.get(row.team_id) : null;
      if (clubTeamId && !existing.clubTeamIds.includes(clubTeamId)) existing.clubTeamIds.push(clubTeamId);
      if (row.team_name && !existing.teamName.includes(row.team_name)) existing.teamName += `, ${row.team_name}`;
    } else {
      const clubTeamId = row.team_id ? teamToClubTeam.get(row.team_id) : null;
      groupedChildren.set(row.child_key, {
        id: `child:${row.child_key}`,
        label: `${fullName}${row.team_name ? ` · ${row.team_name}` : ""}`,
        subject: fullName,
        role: "Ouder",
        teamName: row.team_name || "Geen ploeg gekoppeld",
        teamIds: row.team_id ? [row.team_id] : [],
        clubTeamIds: clubTeamId ? [clubTeamId] : []
      });
    }
  }
  contexts.push(...groupedChildren.values());

  // The profile overview only needs recent results and upcoming planning.
  // Keeping this window bounded prevents the dashboard from loading a club's
  // complete match and training history on every visit.
  const today = new Date();
  const activityFrom = dateOnly(addDays(today, -30));
  const activityUntil = dateOnly(addDays(today, 120));
  const [{ data: matches }, { data: trainingSessions }, { data: trainingPlans }] = await Promise.all([
    clubId
      ? admin.from("matches").select("id, club_team_id, team_a_id, team_b_id, team_a_name, team_b_name, match_date, start_time, status, score_a, score_b, completed_at")
          .eq("club_id", clubId)
          .gte("match_date", activityFrom)
          .lte("match_date", activityUntil)
          .order("match_date", { ascending: true, nullsFirst: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
    clubId
      ? admin.from("team_training_sessions").select("id, club_team_id, training_date, start_time, club_teams(name)")
          .eq("club_id", clubId)
          .gte("training_date", activityFrom)
          .lte("training_date", activityUntil)
          .order("training_date", { ascending: true })
          .limit(100)
      : Promise.resolve({ data: [] }),
    clubId
      ? admin.from("trainer_trainings").select("id, title, age_category, created_at, publication_state")
          .eq("club_id", clubId).eq("owner_id", user.id).order("created_at", { ascending: false }).limit(6)
      : Promise.resolve({ data: [] })
  ]);

  const canSeeAllMatches = clubContext.isPlatformAdmin || access?.teamIds === null;
  const activities: ProfileActivity[] = (matches ?? []).flatMap(match => {
    const contextIds = contexts.filter(item =>
      (!!match.club_team_id && item.clubTeamIds.includes(match.club_team_id))
      || (!!match.team_a_id && item.teamIds.includes(match.team_a_id))
      || (!!match.team_b_id && item.teamIds.includes(match.team_b_id))
    ).map(item => item.id);
    if (!canSeeAllMatches && !contextIds.length) return [];
    return [{
      id: `match:${match.id}`,
      kind: "match" as const,
      title: `${match.team_a_name} – ${match.team_b_name}`,
      date: match.match_date,
      time: match.start_time?.slice(0, 5) || null,
      sortAt: match.completed_at ?? `${match.match_date ?? ""}T${match.start_time?.slice(0, 5) ?? "00:00"}`,
      status: match.status,
      score: match.score_a !== null && match.score_b !== null ? `${match.score_a}–${match.score_b}` : null,
      contextIds,
      href: `/dashboard/games/${match.id}`
    }];
  });
  activities.push(...(trainingSessions ?? []).flatMap(session => {
    const contextIds = contexts.filter(item => item.clubTeamIds.includes(session.club_team_id)).map(item => item.id);
    if (!canSeeAllMatches && !contextIds.length) return [];
    const team = session.club_teams as unknown as { name: string } | null;
    return [{
      id: `training-session:${session.id}`,
      kind: "training" as const,
      title: `Training ${team?.name ?? ""}`.trim(),
      date: session.training_date,
      time: session.start_time?.slice(0, 5) || null,
      sortAt: `${session.training_date}T${session.start_time?.slice(0, 5) ?? "00:00"}`,
      status: session.training_date >= new Date().toISOString().slice(0, 10) ? "scheduled" : "completed",
      score: null,
      contextIds,
      href: `/dashboard/training/${session.id}`
    }];
  }));
  activities.push(...(trainingPlans ?? []).map(plan => ({
    id: `training:${plan.id}`,
    kind: "training" as const,
    title: plan.title,
    date: plan.created_at.slice(0, 10),
    time: null,
    sortAt: plan.created_at,
    status: "completed",
    score: null,
    contextIds: contexts.filter(item => item.role === "Trainer").map(item => item.id),
    href: `/dashboard/training/new?personal=${plan.id}`
  })));

  return <ProfileOverview
    name={profile?.full_name?.trim() || user.email?.split("@")[0] || "Gebruiker"}
    email={user.email || ""}
    clubName={clubContext.clubs.find(club => club.id === clubId)?.name ?? null}
    contexts={contexts}
    activities={activities}
    quickLinks={[]}
  />;
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}
