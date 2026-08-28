import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getClubContext } from "@/lib/auth/active-club";
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
  const { data: profile } = await admin.from("profiles").select("full_name, account_role").eq("id", user.id).maybeSingle();
  const { data: registrationRequest } = await admin.from("club_registration_requests")
    .select("request_kind, requested_function_role, requested_custom_role, player_first_name, player_last_name, status, clubs(name)")
    .eq("profile_id", user.id).in("status", ["pending", "rejected"]).order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (registrationRequest?.status === "pending") {
    const club = registrationRequest.clubs as unknown as { name: string } | null;
    const requestDescription = registrationRequest.request_kind === "contact"
      ? `contactpersoon van ${`${registrationRequest.player_first_name ?? ""} ${registrationRequest.player_last_name ?? ""}`.trim()}`
      : registrationRequest.requested_custom_role || registrationRequest.requested_function_role || "staflid";
    return <section className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 text-center sm:p-10">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-500/15 text-2xl text-amber-300">✓</div>
      <h1 className="mt-4 text-2xl font-bold text-textBright">Je account is bevestigd</h1>
      <p className="mt-3 text-textSecondary">Je aanvraag als <strong className="text-textPrimary">{requestDescription}</strong>{club?.name ? <> bij <strong className="text-textPrimary">{club.name}</strong></> : null} is goed ontvangen.</p>
      <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        De clubbeheerder moet je functie, eventuele teams of spelerkoppeling nog goedkeuren. Je krijgt toegang zodra dat gebeurd is.
      </div>
      <p className="mt-4 text-xs text-textMuted">Je kunt deze pagina later opnieuw openen om de status te controleren.</p>
    </section>;
  }

  if (registrationRequest?.status === "rejected") {
    return <section className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 text-center sm:p-10"><h1 className="text-2xl font-bold text-textBright">Aanvraag niet goedgekeurd</h1><p className="mt-3 text-textSecondary">Neem contact op met de clubbeheerder als je denkt dat dit niet klopt.</p></section>;
  }

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
      role: "Contactpersoon",
        teamName: row.team_name || "Geen ploeg gekoppeld",
        teamIds: row.team_id ? [row.team_id] : [],
        clubTeamIds: clubTeamId ? [clubTeamId] : []
      });
    }
  }
  contexts.push(...groupedChildren.values());

  const allowedClubTeamIds = [...new Set(contexts.flatMap(context => context.clubTeamIds))];
  const allowedTeamIds = [...new Set(contexts.flatMap(context => context.teamIds))];
  const matchScope = [
    allowedClubTeamIds.length ? `club_team_id.in.(${allowedClubTeamIds.join(",")})` : null,
    allowedTeamIds.length ? `team_a_id.in.(${allowedTeamIds.join(",")})` : null,
    allowedTeamIds.length ? `team_b_id.in.(${allowedTeamIds.join(",")})` : null
  ].filter((filter): filter is string => !!filter).join(",");

  // The profile overview only needs recent results and upcoming planning.
  // Keeping this window bounded prevents the dashboard from loading a club's
  // complete match and training history on every visit.
  const today = new Date();
  const activityFrom = dateOnly(addDays(today, -30));
  const activityUntil = dateOnly(addDays(today, 120));
  const [{ data: matches }, { data: trainingSessions }, { data: trainingPlans }] = await Promise.all([
    clubId && matchScope
      ? admin.from("matches").select("id, club_team_id, team_a_id, team_b_id, team_a_name, team_b_name, match_date, start_time, status, score_a, score_b, is_home_match, completed_at")
          .eq("club_id", clubId)
          .or(matchScope)
          .gte("match_date", activityFrom)
          .lte("match_date", activityUntil)
          .order("match_date", { ascending: true, nullsFirst: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
    clubId && allowedClubTeamIds.length
      ? admin.from("team_training_sessions").select("id, club_team_id, training_date, start_time, club_teams(name)")
          .eq("club_id", clubId)
          .in("club_team_id", allowedClubTeamIds)
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

  const activities: ProfileActivity[] = (matches ?? []).flatMap(match => {
    const contextIds = contexts.filter(item =>
      (!!match.club_team_id && item.clubTeamIds.includes(match.club_team_id))
      || (!!match.team_a_id && item.teamIds.includes(match.team_a_id))
      || (!!match.team_b_id && item.teamIds.includes(match.team_b_id))
    ).map(item => item.id);
    if (!contextIds.length) return [];
    const homeTeamName = match.is_home_match ? match.team_a_name : match.team_b_name;
    const awayTeamName = match.is_home_match ? match.team_b_name : match.team_a_name;
    const homeScore = match.is_home_match ? match.score_a : match.score_b;
    const awayScore = match.is_home_match ? match.score_b : match.score_a;
    return [{
      id: `match:${match.id}`,
      kind: "match" as const,
      title: `${homeTeamName} – ${awayTeamName}`,
      date: match.match_date,
      time: match.start_time?.slice(0, 5) || null,
      sortAt: match.completed_at ?? `${match.match_date ?? ""}T${match.start_time?.slice(0, 5) ?? "00:00"}`,
      status: match.status,
      score: homeScore !== null && awayScore !== null ? `${homeScore}–${awayScore}` : null,
      contextIds,
      href: `/dashboard/games/${match.id}`
    }];
  });
  activities.push(...(trainingSessions ?? []).flatMap(session => {
    const contextIds = contexts.filter(item => item.clubTeamIds.includes(session.club_team_id)).map(item => item.id);
    if (!contextIds.length) return [];
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
    contextIds: [],
    href: `/dashboard/training/new?personal=${plan.id}`
  })));

  return <ProfileOverview
    name={profile?.full_name?.trim() || user.email?.split("@")[0] || "Gebruiker"}
    email={user.email || ""}
    clubName={clubContext.clubs.find(club => club.id === clubId)?.name ?? null}
    contexts={contexts}
    activities={activities}
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
