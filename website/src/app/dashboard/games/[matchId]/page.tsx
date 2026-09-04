import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { PublicMatchInfoEditor } from "@/components/matches/PublicMatchInfoEditor";
import { MatchDossierTabs } from "@/components/matches/MatchDossierTabs";
import { MatchPreparationEditor } from "@/components/matches/MatchPreparationEditor";
import { getClubContext } from "@/lib/auth/active-club";
import { MatchHeaderScoreEditor } from "@/components/matches/MatchHeaderScoreEditor";
import { deleteObject } from "@/lib/r2/upload";
import { hasScheduledEventEnded } from "@/lib/schedule-status";

type GuardianPlayer = { player_id: string; team_id: string | null };
type PlayerFacingReview = { playerId?: unknown; playerReport?: unknown };
type ScoreGoal = { team?: "home" | "away"; scoreAfter?: string; minute?: number | null; scorerType?: string; scorerPlayerId?: string; scorerName?: string; assistType?: string; assistPlayerId?: string; assistName?: string };

function displayDate(value: string | null) {
  if (!value) return "Nog niet bepaald";
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

export default async function GameOverviewPage({ params, searchParams }: { params: { matchId: string }; searchParams?: { edit?: string } }) {
  const supabase = createClient();
  const { user } = await getClubContext();
  if (!user) notFound();

  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("*").eq("id", params.matchId).maybeSingle();
  if (!match?.club_id) notFound();

  const access = await getClubAccess(match.club_id, user);
  const staffCanView = hasClubPermission(access, "games.view") && canAccessTeam(access, match.club_team_id);
  const { data: guardianPlayersRaw } = staffCanView
    ? { data: [] }
    : await supabase.rpc("guardian_dashboard_players");
  const guardianPlayers = (guardianPlayersRaw as GuardianPlayer[] | null) ?? [];
  const guardianCanView = !!match.team_a_id && guardianPlayers.some((player) => player.team_id === match.team_a_id);
  if (!staffCanView && !guardianCanView) notFound();

  const canViewVideo = staffCanView && hasClubPermission(access, "video.view");
  const canManage = staffCanView && hasClubPermission(access, "games.create");
  const canPrepare = staffCanView && (hasClubPermission(access, "games.planning.manage") || hasClubPermission(access, "games.selection.manage")
    || hasClubPermission(access, "games.tag") || hasClubPermission(access, "games.tag_link.create"));
  const canViewSelection = staffCanView && hasClubPermission(access, "games.selection.view");
  const canViewReport = staffCanView && hasClubPermission(access, "games.report.view");
  const canManageReport = staffCanView && hasClubPermission(access, "games.report.manage");
  const canEditScore = canManage || canManageReport;
  const canManagePublicInfo = staffCanView && hasClubPermission(access, "games.communication.manage");
  const canViewScouting = staffCanView && hasClubPermission(access, "games.scouting.view");
  const canManageScouting = staffCanView && hasClubPermission(access, "games.scouting.manage");
  const canEditAnything = canManage || canPrepare || canManagePublicInfo || canManageReport || canManageScouting;
  const editing = canEditAnything && searchParams?.edit === "1";
  const [{ data: matchVideos }, { data: options }, { data: club }, { data: clubTeam }, { data: editableTeams }] = await Promise.all([
    canViewVideo
      ? admin.from("match_videos").select("video_id").eq("match_id", match.id)
      : Promise.resolve({ data: [] }),
    admin.from("club_match_options").select("id, label").eq("club_id", match.club_id).eq("active", true),
    canManagePublicInfo
      ? admin.from("clubs").select("clip_advertising_enabled, general_sponsor_url").eq("id", match.club_id).maybeSingle()
      : Promise.resolve({ data: null }),
    canManagePublicInfo && match.club_team_id
      ? admin.from("club_teams").select("sponsor_url, sponsor_enabled").eq("id", match.club_team_id).maybeSingle()
      : Promise.resolve({ data: null }),
    canManage
      ? admin.from("teams").select("id, name, club_teams!inner(club_id)").eq("club_teams.club_id", match.club_id).order("name")
      : Promise.resolve({ data: [] })
  ]);
  const videoIds = (matchVideos ?? []).map(item => item.video_id);
  const [{ data: selectedPlayers }, { data: matchSelections }, { data: teamPlayers }, { data: guestPlayers }, { data: dossier }, { data: clips }, { data: completedByProfile }] = staffCanView ? await Promise.all([
    (canViewSelection || canViewReport) && match.player_ids?.length
      ? admin.from("players").select("id, first_name, last_name, jersey_number, is_goalkeeper").in("id", match.player_ids).order("jersey_number")
      : Promise.resolve({ data: [] }),
    canViewReport
      ? admin.from("match_player_selections").select("player_id, jersey_number").eq("match_id", match.id).eq("selected", true)
      : Promise.resolve({ data: [] }),
    canViewReport && match.team_a_id
      ? admin.from("players").select("id, first_name, last_name, jersey_number, is_goalkeeper").eq("team_id", match.team_a_id).eq("role", "player").order("jersey_number")
      : Promise.resolve({ data: [] }),
    admin.from("match_guest_players").select("id, first_name, last_name, jersey_number").eq("match_id", match.id).order("created_at"),
    admin.from("match_dossiers").select("*").eq("match_id", match.id).maybeSingle(),
    videoIds.length
      ? admin.from("clips").select("id, name, render_status, created_at, rendered_segments, videos(video_url), clip_segments(id, sequence_order, video_id, videos(video_url), tags(id, name, color, start_time, end_time)), share_links(token, short_code)").in("video_id", videoIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    match.completed_by
      ? admin.from("profiles").select("full_name, email").eq("id", match.completed_by).maybeSingle()
      : Promise.resolve({ data: null })
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: null }, { data: [] }, { data: null }];
  const videoCount = videoIds.length;
  const selectionNumberByPlayer = new Map((matchSelections ?? []).map(selection => [selection.player_id, selection.jersey_number]));
  const selectedPlayersWithMatchNumbers = (selectedPlayers ?? []).map(player => ({
    ...player, jersey_number: selectionNumberByPlayer.get(player.id) ?? player.jersey_number
  }));
  const selectionPlayers = access.goalkeeperPlayerIds === null
    ? [...selectedPlayersWithMatchNumbers, ...(guestPlayers ?? [])]
    : selectedPlayersWithMatchNumbers.filter((player) => access.goalkeeperPlayerIds?.has(player.id));
  const reportPlayers = [
    ...((selectedPlayers?.length ? selectedPlayers : teamPlayers) ?? []).map(player => ({
      ...player,
      jersey_number: selectionNumberByPlayer.get(player.id) ?? player.jersey_number
    })),
    ...(guestPlayers ?? [])
  ];
  const failedClips = (clips ?? []).filter((clip: any) => clip.render_status === "failed");
  await Promise.all(failedClips.map(async (clip: any) => {
    const keys = ((clip.rendered_segments ?? []) as Array<{ key?: string }>).map(segment => segment.key).filter((key): key is string => !!key);
    const removals = await Promise.allSettled(keys.map(key => deleteObject(key)));
    for (const removal of removals) if (removal.status === "rejected") console.error("Could not remove failed clip object:", removal.reason);
    const { error: deleteError } = await admin.from("clips").delete().eq("id", clip.id);
    if (deleteError) console.error("Could not remove failed clip record:", deleteError);
  }));
  const dossierClips = (clips ?? []).filter((clip: any) => clip.render_status !== "failed").map((clip: any) => ({
    id: clip.id,
    name: clip.name,
    render_status: clip.render_status,
    created_at: clip.created_at,
    shareToken: clip.share_links?.[0]?.token ?? null,
    shareCode: clip.share_links?.[0]?.short_code ?? null,
    rendered_segments: clip.rendered_segments ?? [],
    videos: clip.videos ?? null,
    clip_segments: clip.clip_segments ?? []
  }));
  const optionNames = new Map((options ?? []).map((option) => [option.id, option.label]));
  const guardianPlayerIds = guardianPlayers.map(player => player.player_id);
  const [{ data: guardianSelections }, { data: guardianPlayerRows }, { data: guardianDossier }] = !staffCanView && guardianPlayerIds.length
    ? await Promise.all([
        admin.from("match_player_selections").select("player_id, selected").eq("match_id", match.id).in("player_id", guardianPlayerIds),
        admin.from("players").select("id, first_name, last_name").in("id", guardianPlayerIds),
        admin.from("match_dossiers").select("player_reviews").eq("match_id", match.id).maybeSingle()
      ])
    : [{ data: [] }, { data: [] }, { data: null }];
  const guardianPlayerNames = new Map((guardianPlayerRows ?? []).map(player => [player.id, `${player.first_name} ${player.last_name}`.trim()]));
  const guardianFeedback = ((guardianDossier?.player_reviews ?? []) as PlayerFacingReview[]).flatMap(review => {
    if (typeof review.playerId !== "string" || !guardianPlayerIds.includes(review.playerId) || typeof review.playerReport !== "string" || !review.playerReport.trim()) return [];
    return [{ playerId: review.playerId, report: review.playerReport.trim() }];
  });
  const scoreKnown = match.score_a !== null && match.score_b !== null;
  const played = match.status === "finished" || hasScheduledEventEnded(match.match_date, match.start_time);
  const homeTeamName = match.is_home_match ? match.team_a_name : match.team_b_name;
  const awayTeamName = match.is_home_match ? match.team_b_name : match.team_a_name;
  const homeScore = match.is_home_match ? match.score_a : match.score_b;
  const awayScore = match.is_home_match ? match.score_b : match.score_a;

  return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/dashboard" className="text-sm font-semibold text-accent hover:underline">← Terug naar dashboard</Link>
      <div className="flex flex-wrap gap-2">
        {canEditAnything && <Link href={editing ? `/dashboard/games/${match.id}` : `/dashboard/games/${match.id}?edit=1`} className="rounded-xl border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary">{editing ? "Bewerken sluiten" : played ? "Wedstrijdverslag opmaken" : "Wedstrijdvoorbereiding opmaken"}</Link>}
        {canViewVideo && !!videoCount && <Link href={`/dashboard/matches/${match.id}`} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-page">Open videoviewer</Link>}
      </div>
    </div>

    <header className="rounded-2xl border border-border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Wedstrijd</p>
        <span className="rounded-full bg-accentDim px-3 py-1 text-xs font-bold text-accent">{played ? "Afgewerkt" : "Gepland"}</span>
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <h1 className="text-xl font-black text-textBright sm:text-3xl">{homeTeamName}</h1>
        {editing && canEditScore && played
          ? <MatchHeaderScoreEditor matchId={match.id} homeTeamName={homeTeamName} awayTeamName={awayTeamName} homeScore={homeScore} awayScore={awayScore} />
          : <div className="min-w-20 rounded-xl border border-borderSubtle bg-cardDeep px-3 py-2 text-2xl font-black text-textBright">{scoreKnown ? `${homeScore} – ${awayScore}` : "–"}</div>}
        <h2 className="text-xl font-black text-textBright sm:text-3xl">{awayTeamName}</h2>
      </div>
      <p className="mt-5 text-center text-sm text-textMuted">{displayDate(match.match_date)}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}{match.official_series_name ? ` · ${match.official_series_name}` : ""}</p>
      {canViewReport && dossier?.goal_events?.length > 0 && <ScoreTimeline goals={dossier.goal_events as ScoreGoal[]} players={reportPlayers} ownTeamSide={match.is_home_match ? "home" : "away"} />}
      {match.completed_at && <p className="mt-3 text-center text-xs font-semibold text-accent">
        Wedstrijd afgewerkt door {completedByProfile?.full_name?.trim() || completedByProfile?.email?.split("@")[0] || "onbekend"} · {new Date(match.completed_at).toLocaleString("nl-BE")}
      </p>}
    </header>

    {!editing && <section className="grid gap-4">
      <PublicMatchInfoEditor
        match={match}
        sponsorFeatureEnabled={club?.clip_advertising_enabled !== false}
        hasClubSponsor={!!club?.general_sponsor_url}
        hasTeamSponsor={!!clubTeam?.sponsor_url}
        canEdit={editing && canManagePublicInfo}
        expanded={false}
      >
        {staffCanView && <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Start van de opname" value={match.recording_start_time?.slice(0, 5) || "Niet ingesteld"} />
          <Info label="Afgesproken tijdstip" value={match.meeting_time_enabled ? match.meeting_time?.slice(0, 5) || "Nog niet bepaald" : "Niet ingesteld"} />
          {!match.is_home_match && <Info label="Vertrek" value={match.departure_time_enabled ? match.departure_time?.slice(0, 5) || "Nog niet bepaald" : "Niet ingesteld"} />}
          <Info label="Verzamelplaats" value={match.meeting_place_custom || optionNames.get(match.meeting_place_option_id) || "Niet ingesteld"} />
          {match.is_home_match && <Info label="Veld" value={optionNames.get(match.field_option_id) || "Niet ingesteld"} />}
          {match.is_home_match && <Info label="Kleedkamer" value={optionNames.get(match.locker_room_option_id) || "Niet ingesteld"} />}
          {match.is_home_match && <Info label="Kleedkamer bezoekers" value={optionNames.get(match.visitor_locker_room_option_id) || "Niet ingesteld"} />}
          <Info label="Scheidsrechter" value={match.official_referee_name || optionNames.get(match.referee_option_id) || "Aangeduid door KBVB"} />
          {match.official_assistant_referee_1_name && <Info label="Assistent-scheidsrechter 1" value={match.official_assistant_referee_1_name} />}
          {match.official_assistant_referee_2_name && <Info label="Assistent-scheidsrechter 2" value={match.official_assistant_referee_2_name} />}
        </dl>}
        {match.show_public_location && match.public_location && <Info label="Locatie" value={match.public_location} />}
      </PublicMatchInfoEditor>
    </section>}

    {editing && canPrepare && <MatchPreparationEditor match={match} teams={(editableTeams ?? []).map(team => ({ id: team.id, name: team.name }))} canManage={canManage} />}

    {staffCanView && <MatchDossierTabs
      matchId={match.id}
      players={canViewSelection ? selectionPlayers : []}
      reportPlayers={canViewReport ? reportPlayers : []}
      clips={dossierClips}
      initialDossier={dossier ? {
        ...dossier,
        ...(!canViewReport ? { lineup_notes: "", lineup_positions: [], lineup_blocks: [], general_report: "", positives: "", improvements: "", highlights: "", goals: "", cards: "", chances: "", goal_events: [] } : {}),
        scouting: canViewScouting ? dossier.scouting : ""
      } : null}
      editable={editing && canManageReport}
      canComplete={editing && canManage}
      showReport={canViewReport}
      scoutingEditable={editing && canManageScouting}
      showScouting={canViewScouting}
      played={played}
      scoreA={homeScore}
      scoreB={awayScore}
      ownTeamSide={match.is_home_match ? "home" : "away"}
      homeTeamName={homeTeamName}
      awayTeamName={awayTeamName}
      completed={match.status === "finished"}
      matchPeriodCount={match.match_period_count}
      matchPeriodMinutes={match.match_period_minutes}
      showSelection={canViewSelection}
      showClips={canViewVideo}
    />}

    {!staffCanView && <section className="space-y-4 rounded-xl border border-borderSubtle bg-cardDeep p-4 text-sm text-textMuted">
      <div>
        {guardianSelections?.length
          ? guardianSelections.map(selection => <span key={selection.player_id} className="block font-semibold text-textPrimary">{guardianPlayerNames.get(selection.player_id) || "Jouw speler"} is {selection.selected ? "geselecteerd" : "niet geselecteerd"}.</span>)
          : <span>De selectie voor jouw speler is nog niet bekend.</span>}
        <span className="mt-2 block">Je ziet alleen informatie van je eigen gekoppelde speler. De volledige selectie, punten en interne beoordelingen blijven afgeschermd.</span>
      </div>
      {guardianFeedback.length > 0 && <div className="border-t border-borderSubtle pt-4">
        <h2 className="font-black text-textBright">Beoordeling van de wedstrijd</h2>
        <div className="mt-3 space-y-3">{guardianFeedback.map(feedback => <article key={feedback.playerId} className="rounded-lg border border-accent/30 bg-card p-3">
          <strong className="text-accent">{guardianPlayerNames.get(feedback.playerId) || "Jouw speler"}</strong>
          <p className="mt-2 whitespace-pre-wrap text-textPrimary">{feedback.report}</p>
        </article>)}</div>
      </div>}
    </section>}
  </main>;
}

function ScoreTimeline({ goals, players, ownTeamSide }: { goals: ScoreGoal[]; players: Array<{ id: string; first_name: string; last_name: string }>; ownTeamSide: "home" | "away" }) {
  const playerName = (id?: string) => { const player = players.find(item => item.id === id); return player ? `${player.first_name} ${player.last_name}`.trim() : ""; };
  const person = (type?: string, playerId?: string, name?: string, assist = false) => type === "player" ? playerName(playerId) : type === "own_goal" ? (assist ? "Via tegenstander" : "Owngoal") : type === "custom" ? name?.trim() ?? "" : "";
  let previous = { home: 0, away: 0 };
  const rows = goals.flatMap((goal, index) => {
    const score = goal.scoreAfter?.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (!score) return [];
    const current = { home: Number(score[1]), away: Number(score[2]) };
    const side = current.home === previous.home + 1 && current.away === previous.away ? "home" : current.away === previous.away + 1 && current.home === previous.home ? "away" : goal.team;
    previous = current;
    if (!side) return [];
    return [{ goal, index, side, score: `${current.home}–${current.away}`, scorer: person(goal.scorerType, goal.scorerPlayerId, goal.scorerName), assist: person(goal.assistType, goal.assistPlayerId, goal.assistName, true) }];
  });
  if (!rows.length) return null;
  const detail = (row: typeof rows[number]) => <span className="text-sm text-textPrimary"><strong>{row.goal.minute !== null && row.goal.minute !== undefined ? `${row.goal.minute}' · ` : ""}{row.scorer || "Doelpunt"}</strong>{row.assist && <span className="text-textMuted"> ({row.assist})</span>}</span>;
  const ball = (side: "home" | "away") => <FootballIcon className={side === ownTeamSide ? "text-green-600" : "text-red-600"} />;
  return <section className="mx-auto mt-6 max-w-3xl border-t border-borderSubtle pt-5" aria-label="Scoreverloop"><h3 className="mb-3 text-center text-xs font-black uppercase tracking-[0.14em] text-textMuted">Scoreverloop</h3><div className="space-y-2">{rows.map(row => <div key={`${row.score}-${row.index}`} className="grid grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] items-center gap-2"><div className="flex min-w-0 items-center justify-end gap-2 text-right">{row.side === "home" && <>{detail(row)}{ball(row.side)}</>}</div><strong className="rounded-lg bg-cardDeep px-2 py-1 text-center text-sm text-textBright">{row.score}</strong><div className="flex min-w-0 items-center gap-2 text-left">{row.side === "away" && <>{ball(row.side)}{detail(row)}</>}</div></div>)}</div></section>;
}

function FootballIcon({ className }: { className: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9.5" />
    <path d="m12 7 3.2 2.3-1.2 3.8h-4l-1.2-3.8L12 7Z" />
    <path d="m12 7-.8-4.4M15.2 9.3l4.3-1.5M14 13.1l2.7 3.7M10 13.1l-2.7 3.7M8.8 9.3 4.5 7.8M16.7 16.8l-.2 3.2M7.3 16.8l.2 3.2M4.5 7.8 2.7 11M19.5 7.8l1.8 3.2" />
  </svg>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-borderSubtle bg-cardDeep p-3"><dt className="text-xs text-textMuted">{label}</dt><dd className="mt-1 font-semibold text-textPrimary">{value}</dd></div>;
}
