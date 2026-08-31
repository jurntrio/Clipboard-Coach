import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, canManagePlayer, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { addPlayerContacts } from "@/lib/teams/player-contacts";

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  const context = await getClubContext();
  const user = context.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: team } = await admin.from("teams")
    .select("*, players(*), club_teams(id, club_id, season_id, trainers_can_edit_roster)")
    .eq("id", params.teamId).maybeSingle();
  if (!team) return NextResponse.json({ error: "Team niet gevonden." }, { status: 404 });

  const clubTeam = team.club_teams as unknown as { id: string; club_id: string; season_id: string | null; trainers_can_edit_roster: boolean } | null;
  let allowed = team.coach_id === user.id;
  let access: Awaited<ReturnType<typeof getClubAccess>> | null = null;
  let canEditRoster = allowed;
  if (context.activeClubId && clubTeam?.club_id === context.activeClubId) {
    access = await getClubAccess(context.activeClubId, user);
    allowed = hasClubPermission(access, "teams.view") && canAccessTeam(access, clubTeam.id);
    const privilegedRosterRole = ["youth_coordinator", "head_youth_development"].includes(access.functionRole ?? "");
    canEditRoster = allowed && hasClubPermission(access, "teams.manage")
      && (["platform_admin", "club_admin"].includes(access.role) || privilegedRosterRole || clubTeam.trainers_can_edit_roster === true);
  } else if (!allowed) {
    const { data: membership } = await admin.from("team_staff_members").select("id")
      .eq("team_id", team.id).eq("user_id", user.id).maybeSingle();
    allowed = !!membership;
  }
  if (!allowed) return NextResponse.json({ error: "Geen toegang tot dit team." }, { status: 403 });

  const section = new URL(request.url).searchParams.get("section");
  if (section === "matches") {
    const clubMatchesQuery = clubTeam
      ? admin.from("matches").select("id, team_a_id, team_b_id, team_a_name, team_b_name, match_date, start_time, status, score_a, score_b, club_team_id, is_home_match, player_ids, completed_at, match_type, updated_at")
          .eq("club_id", clubTeam.club_id).or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id},club_team_id.eq.${clubTeam.id}`)
      : null;
    const { data: matches } = clubTeam
      ? await (clubTeam.season_id ? clubMatchesQuery!.eq("season_id", clubTeam.season_id) : clubMatchesQuery!).order("match_date", { ascending: false })
      : await admin.from("matches").select("id, team_a_id, team_b_id, team_a_name, team_b_name, match_date, start_time, status, score_a, score_b, club_team_id, is_home_match, player_ids, completed_at, match_type, updated_at")
          .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`).order("match_date", { ascending: false });
    const normalized = (value: string | null) => (value ?? "").toLocaleLowerCase("nl-BE")
      .replace(/\([^)]*\)/g, "").replace(/\bu\d{1,2}\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const uniqueMatches = new Map<string, (typeof matches extends Array<infer T> | null ? T : never)>();
    for (const match of matches ?? []) {
      const opponent = match.team_a_id === team.id || normalized(match.team_a_name) === normalized(team.name)
        ? match.team_b_name : match.team_a_name;
      const key = `${match.match_date ?? ""}|${normalized(opponent)}`;
      const existing = uniqueMatches.get(key);
      if (!existing || (!existing.completed_at && !!match.completed_at) || `${match.updated_at}` > `${existing.updated_at}`) uniqueMatches.set(key, match);
    }
    return NextResponse.json({ matches: [...uniqueMatches.values()] });
  }

  if (section === "training") {
    if (!clubTeam) return NextResponse.json({ trainings: [], training_options: [] });
    const [{ data: sessions }, { data: options }] = await Promise.all([
      admin.from("team_training_sessions").select("id, club_team_id, training_date, start_time, field_option_id, locker_room_option_id, personal_training_id, club_training_id, attendance_confirmed_at")
        .eq("club_team_id", clubTeam.id).order("training_date").order("start_time"),
      admin.from("club_match_options").select("id, label").eq("club_id", clubTeam.club_id).eq("active", true)
    ]);
    const sessionIds = (sessions ?? []).map(session => session.id);
    const workloadsByTraining = new Map<string, Array<{ category: string; modality: string; color: string; details: string[] }>>();
    const workloadNotesByTraining = new Map<string, string>();
    if (access && sessionIds.length) {
      const { data: assignments } = await admin.from("team_training_session_workloads")
        .select("training_session_id, scheme_session_id").in("training_session_id", sessionIds).not("scheme_session_id", "is", null);
      const schemeSessionIds = [...new Set((assignments ?? []).flatMap(item => item.scheme_session_id ? [item.scheme_session_id] : []))];
      const [{ data: blocks }, { data: schemeSessions }] = schemeSessionIds.length
        ? await Promise.all([admin.from("club_workload_scheme_session_blocks")
            .select("scheme_session_id, display_order, progression_step, match_format, duration_value, duration_unit, repetitions, sets, rest_between_repetitions_seconds, rest_between_sets_seconds, parameters, note, club_workload_categories(name,color), club_workload_modalities(name,color)")
            .in("scheme_session_id", schemeSessionIds).order("display_order"), admin.from("club_workload_scheme_sessions").select("id,note").in("id", schemeSessionIds)])
        : [{ data: [] }, { data: [] }];
      const blocksBySchemeSession = new Map<string, Array<{ category: string; modality: string; color: string; details: string[] }>>();
      const notesBySchemeSession = new Map<string, string>();
      for (const block of blocks ?? []) {
        const category = block.club_workload_categories as unknown as { name: string; color: string } | null;
        const modality = block.club_workload_modalities as unknown as { name: string; color: string } | null;
        const values = blocksBySchemeSession.get(block.scheme_session_id) ?? [];
        const categoryName = category?.name ?? "Workload";
        values.push({ category: categoryName, modality: modality?.name ?? block.note?.trim() ?? "–", color: modality?.color ?? category?.color ?? "#22c55e", details: workloadDetails(block, categoryName) });
        values.sort((a, b) => workloadCategoryOrder(a.category) - workloadCategoryOrder(b.category));
        blocksBySchemeSession.set(block.scheme_session_id, values);
        if (categoryName.toLocaleLowerCase("nl-BE") === "explosiviteit" && block.note?.trim()) notesBySchemeSession.set(block.scheme_session_id, block.note.trim());
      }
      for (const session of schemeSessions ?? []) {
        const note = session.note?.trim() ?? "";
        const values = blocksBySchemeSession.get(session.id) ?? [];
        notesBySchemeSession.delete(session.id);
        for (const item of values) {
          const step = note.match(new RegExp(`\\b${escapeRegExp(item.modality)}\\s+stap\\s+(\\d+)`, "i"));
          if (step) item.modality = `${item.modality} · Stap ${step[1]}`;
        }
        values.sort((a, b) => workloadCategoryOrder(a.category) - workloadCategoryOrder(b.category));
        blocksBySchemeSession.set(session.id, values);
        const trainingNumber = note.match(/\bTr\s*\d+\b/i)?.[0];
        if (trainingNumber) notesBySchemeSession.set(session.id, trainingNumber.replace(/\s+/g, " "));
      }
      for (const assignment of assignments ?? []) if (assignment.scheme_session_id) {
        workloadsByTraining.set(assignment.training_session_id, blocksBySchemeSession.get(assignment.scheme_session_id) ?? []);
        const note = notesBySchemeSession.get(assignment.scheme_session_id);
        if (note) workloadNotesByTraining.set(assignment.training_session_id, note);
      }
    }
    return NextResponse.json({ trainings: (sessions ?? []).map(session => ({ ...session, workload_modalities: workloadsByTraining.get(session.id) ?? [], workload_note: workloadNotesByTraining.get(session.id) ?? "" })), training_options: options ?? [] });
  }

  if (section === "statistics") {
    if (!clubTeam) return NextResponse.json({ statistics: [] });
    const today = new Date().toISOString().slice(0, 10);
    const { data: sessions } = await admin.from("team_training_sessions").select("id")
      .eq("club_team_id", clubTeam.id).lt("training_date", today).not("attendance_confirmed_at", "is", null);
    const confirmedSessions = sessions ?? [];
    const sessionIds = confirmedSessions.map(session => session.id);
    const { data: attendance } = sessionIds.length
      ? await admin.from("team_training_attendance").select("training_session_id, player_id, attendance_status").in("training_session_id", sessionIds)
      : { data: [] };
    const roster = ((team.players ?? []) as Array<{ id: string; first_name: string; last_name: string; role: string }>).filter(player => player.role === "player");
    const statistics = roster
      .map(player => ({
        playerId: player.id,
        playerName: `${player.first_name} ${player.last_name}`.trim(),
        teamId: clubTeam.id,
        teamName: team.name,
        confirmedTrainings: confirmedSessions.length,
        presentTrainings: confirmedSessions.filter(session => !(attendance ?? []).some(row => row.training_session_id === session.id && row.player_id === player.id && ["absent", "injured"].includes(row.attendance_status))).length,
        missedTrainings: (attendance ?? []).filter(row => row.player_id === player.id && row.attendance_status === "absent").length,
        injuredTrainings: (attendance ?? []).filter(row => row.player_id === player.id && row.attendance_status === "injured").length
      }));
    const playerIds = roster.map(player => player.id);
    const [{ data: teamMatches }, { data: events }] = await Promise.all([
      admin.from("matches").select("id, player_ids, match_type, match_dossiers(goal_events)").eq("club_team_id", clubTeam.id),
      playerIds.length ? admin.from("player_stat_events").select("match_id, player_id, stat_type").in("player_id", playerIds) : Promise.resolve({ data: [] })
    ]);
    type DossierGoal = { scorerType?: string; scorerPlayerId?: string; assistType?: string; assistPlayerId?: string };
    const dossierGoalsByMatch = new Map<string, DossierGoal[]>();
    for (const match of teamMatches ?? []) {
      const rawDossier = Array.isArray(match.match_dossiers) ? match.match_dossiers[0] : match.match_dossiers;
      const goals = rawDossier && Array.isArray(rawDossier.goal_events) ? rawDossier.goal_events as DossierGoal[] : [];
      dossierGoalsByMatch.set(match.id, goals);
    }
    const dossierOwnsStat = (matchId: string, statType: "goal" | "assist") => (dossierGoalsByMatch.get(matchId) ?? []).some(goal =>
      statType === "goal" ? goal.scorerType === "player" && !!goal.scorerPlayerId : goal.assistType === "player" && !!goal.assistPlayerId);
    const buildMatchStatistics = (matchType?: "friendly" | "competition" | "cup") => {
      const selectedMatches = (teamMatches ?? []).filter(match => !matchType || match.match_type === matchType);
      const selectedIds = new Set(selectedMatches.map(match => match.id));
      const selectedGoals = selectedMatches.flatMap(match => dossierGoalsByMatch.get(match.id) ?? []);
      return roster.map(player => ({
        playerId: player.id,
        playerName: `${player.first_name} ${player.last_name}`.trim(),
        appearances: selectedMatches.filter(match => (match.player_ids ?? []).includes(player.id)).length,
        goals: selectedGoals.filter(goal => goal.scorerType === "player" && goal.scorerPlayerId === player.id).length
          + (events ?? []).filter(event => selectedIds.has(event.match_id) && event.player_id === player.id && event.stat_type === "goal" && !dossierOwnsStat(event.match_id, "goal")).length,
        assists: selectedGoals.filter(goal => goal.assistType === "player" && goal.assistPlayerId === player.id).length
          + (events ?? []).filter(event => selectedIds.has(event.match_id) && event.player_id === player.id && event.stat_type === "assist" && !dossierOwnsStat(event.match_id, "assist")).length
      }));
    };
    const hasCupMatches = (teamMatches ?? []).some(match => match.match_type === "cup");
    return NextResponse.json({
      statistics,
      match_statistics: buildMatchStatistics(),
      match_statistics_by_type: {
        friendly: buildMatchStatistics("friendly"),
        competition: buildMatchStatistics("competition"),
        cup: buildMatchStatistics("cup")
      },
      has_cup_matches: hasCupMatches
    });
  }

  const allPlayers = (team.players ?? []) as Array<Record<string, unknown> & { id: string }>;
  const privatePlayers = access?.goalkeeperPlayerIds === null || !access
    ? allPlayers
    : allPlayers.filter((player) => canManagePlayer(access!, player.id));
  const privatePlayerIds = new Set(privatePlayers.map(player => player.id));
  const fastPlayers = allPlayers.map(player => privatePlayerIds.has(player.id) ? { ...player, contacts: [], can_manage: canEditRoster } : {
    id: player.id,
    team_id: player.team_id,
    first_name: player.first_name,
    last_name: player.last_name,
    initials: player.initials,
    position: player.position,
    jersey_number: player.jersey_number,
    role: player.role,
    is_goalkeeper: player.is_goalkeeper,
    email: null,
    date_of_birth: null,
    phone_numbers: [],
    membership_id: null,
    created_at: player.created_at,
    contacts: [],
    can_manage: false
  });
  if (section !== "details") {
    return NextResponse.json({ team: { ...team, players: fastPlayers, linked_staff: [], details_loaded: false } });
  }
  const [enrichedPrivate] = await addPlayerContacts(admin, [{ ...team, players: privatePlayers }]);
  const privateById = new Map(((enrichedPrivate.players ?? []) as Array<Record<string, unknown> & { id: string }>).map((player) => [player.id, player]));
  const visiblePlayers = allPlayers.map((player) => {
    const privatePlayer = privateById.get(player.id);
    if (privatePlayer) return { ...privatePlayer, can_manage: canEditRoster };
    return {
      id: player.id,
      team_id: player.team_id,
      first_name: player.first_name,
      last_name: player.last_name,
      initials: player.initials,
      position: player.position,
      jersey_number: player.jersey_number,
      role: player.role,
      is_goalkeeper: player.is_goalkeeper,
      email: null,
      date_of_birth: null,
      phone_numbers: [],
      membership_id: null,
      created_at: player.created_at,
      contacts: [],
      can_manage: false
    };
  });
  const enriched = { ...enrichedPrivate, players: visiblePlayers };

  let linkedStaff: Array<{ id: string; user_id: string; full_name: string; role: string; removable: boolean }> = [];
  if (clubTeam) {
    const { data: assignments } = await admin.from("club_trainer_teams")
      .select("club_team_id, trainer_id, role, club_trainers(profile_id, display_name)")
      .eq("club_team_id", clubTeam.id).eq("status", "active");
    linkedStaff = (assignments ?? []).flatMap((assignment) => {
      const trainer = assignment.club_trainers as unknown as { profile_id: string | null; display_name: string | null } | null;
      return trainer ? [{
        id: `${clubTeam.id}:${assignment.trainer_id}`,
        user_id: trainer.profile_id ?? assignment.trainer_id,
        full_name: trainer.display_name?.trim() || "Trainer",
        role: assignment.role,
        removable: false
      }] : [];
    });
    const { data: leaders } = await admin.from("club_memberships")
      .select("profile_id, function_role, custom_role_name, profiles(full_name)")
      .eq("club_id", clubTeam.club_id).eq("status", "active").eq("team_scope", "all")
      .in("function_role", ["youth_coordinator", "head_youth_development", "technical_director"]);
    const existingUserIds = new Set(linkedStaff.map((member) => member.user_id));
    for (const leader of leaders ?? []) {
      if (existingUserIds.has(leader.profile_id)) continue;
      const profile = leader.profiles as unknown as { full_name: string | null } | null;
      linkedStaff.push({
        id: `club-role:${leader.profile_id}:${leader.function_role}`,
        user_id: leader.profile_id,
        full_name: profile?.full_name?.trim() || "Club staff",
        role: leader.function_role === "custom" ? leader.custom_role_name || "staff" : leader.function_role,
        removable: false
      });
    }
  } else {
    const { data: memberships } = await admin.from("team_staff_members")
      .select("id, user_id").eq("team_id", team.id);
    const profileIds = (memberships ?? []).map((membership) => membership.user_id);
    const { data: profiles } = profileIds.length
      ? await admin.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] };
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
    linkedStaff = (memberships ?? []).map((membership) => ({
      id: membership.id,
      user_id: membership.user_id,
      full_name: names.get(membership.user_id)?.trim() || "Registered staff",
      role: "staff",
      removable: team.coach_id === user.id && membership.user_id !== team.coach_id
    }));
  }

  return NextResponse.json({
    team: { ...enriched, linked_staff: linkedStaff, details_loaded: true }
  });
}

function workloadDetails(block: { progression_step: number | null; match_format: string; duration_value: number | null; duration_unit: string | null; repetitions: number | null; sets: number | null; rest_between_repetitions_seconds: number | null; rest_between_sets_seconds: number | null; parameters: unknown; note: string }, category: string) {
  const normalizedCategory = category.toLocaleLowerCase("nl-BE");
  if (["opwarming", "kracht"].includes(normalizedCategory)) return [];
  const details: string[] = [];
  if (block.match_format?.trim()) details.push(`${normalizedCategory === "uithouding" ? "WV" : "Wedstrijdvorm"}: ${block.match_format.trim()}`);
  if (normalizedCategory === "uithouding") {
    const parameters = block.parameters && typeof block.parameters === "object" && !Array.isArray(block.parameters) ? block.parameters as Record<string, unknown> : {};
    if (parameters.targetTime !== "" && parameters.targetTime !== null && parameters.targetTime !== undefined) details.push(`A(min): ${formatMinuteValue(parameters.targetTime)}`);
    if (block.repetitions !== null) details.push(`Herhalingen: ${block.repetitions}`);
    if (block.sets !== null) details.push(`Serie(s): ${block.sets}`);
    if (block.rest_between_repetitions_seconds !== null) details.push(`RTH (min): ${formatMinuteValue(block.rest_between_repetitions_seconds / 60)}`);
    if (block.rest_between_sets_seconds !== null) details.push(`RTS (min): ${formatMinuteValue(block.rest_between_sets_seconds / 60)}`);
    if (block.duration_value !== null) details.push(`Duur (min): ${formatNumber(block.duration_value)}`);
    if (block.note?.trim()) details.push(`Notitie: ${block.note.trim()}`);
    return details;
  }
  if (block.duration_value !== null) details.push(`Duur: ${block.duration_value} ${block.duration_unit === "seconds" ? "sec" : block.duration_unit === "minutes" ? "min" : block.duration_unit === "meters" ? "m" : block.duration_unit ?? ""}`.trim());
  if (block.repetitions !== null) details.push(`Herhalingen: ${block.repetitions}`);
  if (block.sets !== null) details.push(`${normalizedCategory === "uithouding" ? "Sets" : "Sets/sessies"}: ${block.sets}`);
  if (block.rest_between_repetitions_seconds !== null) details.push(`Rust herhalingen: ${formatSeconds(block.rest_between_repetitions_seconds)}`);
  if (block.rest_between_sets_seconds !== null) details.push(`Rust sets: ${formatSeconds(block.rest_between_sets_seconds)}`);
  if (block.progression_step !== null) details.push(`Stap: ${block.progression_step}`);
  if (block.parameters && typeof block.parameters === "object" && !Array.isArray(block.parameters)) for (const [key, value] of Object.entries(block.parameters)) {
    if (value === "" || value === false || value === null || value === undefined) continue;
    const label = key === "targetTime" ? "Doeltijd" : key === "speedKmh" ? "Snelheid" : key === "yoyoTest" ? "Yo-Yo-test" : key.replace(/([a-z])([A-Z])/g, "$1 $2");
    details.push(`${label}: ${value === true ? "Ja" : value}${key === "speedKmh" ? " km/u" : ""}`);
  }
  if (normalizedCategory !== "explosiviteit" && block.note?.trim()) details.push(`Notitie: ${block.note.trim()}`);
  return details;
}

function formatSeconds(seconds: number) { const minutes = Math.floor(seconds / 60); const remainder = seconds % 60; return minutes && remainder ? `${minutes} min ${remainder} sec` : minutes ? `${minutes} min` : `${remainder} sec`; }
function formatMinuteValue(value: unknown) {
  if (typeof value === "string" && /^\d+:\d{2}$/.test(value.trim())) { const [minutes, seconds] = value.trim().split(":").map(Number); return `${formatNumber(minutes + seconds / 60)} min`; }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? `${formatNumber(numeric)} min` : `${String(value)} min`;
}
function formatNumber(value: number) { return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))).replace(".", ","); }
function workloadCategoryOrder(category: string) { const order = ["opwarming", "kracht", "uithouding", "explosiviteit"]; const index = order.indexOf(category.toLocaleLowerCase("nl-BE")); return index < 0 ? order.length : index; }
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
