import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { PublicMatchInfoEditor } from "@/components/matches/PublicMatchInfoEditor";
import { MatchDossierTabs } from "@/components/matches/MatchDossierTabs";
import { MatchPreparationEditor } from "@/components/matches/MatchPreparationEditor";
import { MatchTagLinkButton } from "@/components/matches/MatchTagLinkButton";
import { getClubContext } from "@/lib/auth/active-club";

type GuardianPlayer = { player_id: string; team_id: string | null };

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
  const canCreateTagLink = staffCanView && hasClubPermission(access, "games.tag_link.create");
  const canViewSelection = staffCanView && hasClubPermission(access, "games.selection.view");
  const canViewReport = staffCanView && hasClubPermission(access, "games.report.view");
  const canManageReport = staffCanView && hasClubPermission(access, "games.report.manage");
  const canManagePublicInfo = staffCanView && hasClubPermission(access, "games.communication.manage");
  const canViewScouting = staffCanView && hasClubPermission(access, "games.scouting.view");
  const canManageScouting = staffCanView && hasClubPermission(access, "games.scouting.manage");
  const canEditAnything = canManage || canPrepare || canManagePublicInfo || canManageReport || canManageScouting;
  const editing = canEditAnything && searchParams?.edit === "1";
  const [{ data: matchVideos }, { data: options }, { data: club }, { data: clubTeam }] = await Promise.all([
    canViewVideo
      ? admin.from("match_videos").select("video_id").eq("match_id", match.id)
      : Promise.resolve({ data: [] }),
    admin.from("club_match_options").select("id, label").eq("club_id", match.club_id).eq("active", true),
    canManagePublicInfo
      ? admin.from("clubs").select("clip_advertising_enabled, general_sponsor_url").eq("id", match.club_id).maybeSingle()
      : Promise.resolve({ data: null }),
    canManagePublicInfo && match.club_team_id
      ? admin.from("club_teams").select("sponsor_url, sponsor_enabled").eq("id", match.club_team_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);
  const videoIds = (matchVideos ?? []).map(item => item.video_id);
  const [{ data: selectedPlayers }, { data: teamPlayers }, { data: guestPlayers }, { data: dossier }, { data: clips }, { data: completedByProfile }] = staffCanView ? await Promise.all([
    (canViewSelection || canViewReport) && match.player_ids?.length
      ? admin.from("players").select("id, first_name, last_name, jersey_number").in("id", match.player_ids).order("jersey_number")
      : Promise.resolve({ data: [] }),
    canViewReport && match.team_a_id
      ? admin.from("players").select("id, first_name, last_name, jersey_number").eq("team_id", match.team_a_id).eq("role", "player").order("jersey_number")
      : Promise.resolve({ data: [] }),
    admin.from("match_guest_players").select("id, first_name, last_name, jersey_number").eq("match_id", match.id).order("created_at"),
    admin.from("match_dossiers").select("*").eq("match_id", match.id).maybeSingle(),
    videoIds.length
      ? admin.from("clips").select("id, name, render_status, created_at, share_links(token)").in("video_id", videoIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    match.completed_by
      ? admin.from("profiles").select("full_name, email").eq("id", match.completed_by).maybeSingle()
      : Promise.resolve({ data: null })
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: null }, { data: [] }, { data: null }];
  const videoCount = videoIds.length;
  const selectionPlayers = access.goalkeeperPlayerIds === null
    ? [...(selectedPlayers ?? []), ...(guestPlayers ?? [])]
    : (selectedPlayers ?? []).filter((player) => access.goalkeeperPlayerIds?.has(player.id));
  const reportPlayers = [...((selectedPlayers?.length ? selectedPlayers : teamPlayers) ?? []), ...(guestPlayers ?? [])];
  const dossierClips = (clips ?? []).map((clip: any) => ({
    id: clip.id,
    name: clip.name,
    render_status: clip.render_status,
    created_at: clip.created_at,
    shareToken: clip.share_links?.[0]?.token ?? null
  }));
  const optionNames = new Map((options ?? []).map((option) => [option.id, option.label]));
  const guardianPlayerIds = guardianPlayers.map(player => player.player_id);
  const { data: guardianSelections } = !staffCanView && guardianPlayerIds.length
    ? await admin.from("match_player_selections").select("player_id, selected").eq("match_id", match.id).in("player_id", guardianPlayerIds)
    : { data: [] };
  const scoreKnown = match.score_a !== null && match.score_b !== null;
  const nowInBrussels = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date());
  const [todayInBrussels, timeInBrussels] = nowInBrussels.split(" ");
  const played = match.status === "finished"
    || (!!match.match_date && (match.match_date < todayInBrussels
      || (match.match_date === todayInBrussels && !!match.start_time && match.start_time.slice(0, 5) <= timeInBrussels)));

  return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/dashboard" className="text-sm font-semibold text-accent hover:underline">← Terug naar dashboard</Link>
      <div className="flex flex-wrap gap-2">
        {canCreateTagLink && match.status !== "finished" && <MatchTagLinkButton matchId={match.id} />}
        {canEditAnything && <Link href={editing ? `/dashboard/games/${match.id}` : `/dashboard/games/${match.id}?edit=1`} className="rounded-xl border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary">{editing ? "Bewerken sluiten" : "Wedstrijd bewerken"}</Link>}
        {canViewVideo && !!videoCount && <Link href={`/dashboard/matches/${match.id}`} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-page">Open videoviewer</Link>}
      </div>
    </div>

    <header className="rounded-2xl border border-border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Wedstrijd</p>
        <span className="rounded-full bg-accentDim px-3 py-1 text-xs font-bold text-accent">{match.status === "finished" ? "Afgewerkt" : played ? "Niet afgewerkt" : "Gepland"}</span>
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <h1 className="text-xl font-black text-textBright sm:text-3xl">{match.team_a_name}</h1>
        <div className="min-w-20 rounded-xl border border-borderSubtle bg-cardDeep px-3 py-2 text-2xl font-black text-textBright">
          {scoreKnown ? `${match.score_a} – ${match.score_b}` : "–"}
        </div>
        <h2 className="text-xl font-black text-textBright sm:text-3xl">{match.team_b_name}</h2>
      </div>
      <p className="mt-5 text-center text-sm text-textMuted">{displayDate(match.match_date)}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}</p>
      {match.completed_at && <p className="mt-3 text-center text-xs font-semibold text-accent">
        Wedstrijd afgewerkt door {completedByProfile?.full_name?.trim() || completedByProfile?.email?.split("@")[0] || "onbekend"} · {new Date(match.completed_at).toLocaleString("nl-BE")}
      </p>}
    </header>

    <section className="grid gap-4">
      <PublicMatchInfoEditor
        match={match}
        sponsorFeatureEnabled={club?.clip_advertising_enabled !== false}
        hasClubSponsor={!!club?.general_sponsor_url}
        hasTeamSponsor={!!clubTeam?.sponsor_url}
        canEdit={editing && canManagePublicInfo}
        expanded={played}
      >
        {staffCanView && hasClubPermission(access, "games.planning.manage") && <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Afgesproken tijdstip" value={match.meeting_time_enabled ? match.meeting_time?.slice(0, 5) || "Nog niet bepaald" : "Niet ingesteld"} />
          {!match.is_home_match && <Info label="Vertrek" value={match.departure_time_enabled ? match.departure_time?.slice(0, 5) || "Nog niet bepaald" : "Niet ingesteld"} />}
          <Info label="Verzamelplaats" value={match.meeting_place_custom || optionNames.get(match.meeting_place_option_id) || "Niet ingesteld"} />
          {match.is_home_match && <Info label="Veld" value={optionNames.get(match.field_option_id) || "Niet ingesteld"} />}
          {match.is_home_match && <Info label="Kleedkamer" value={optionNames.get(match.locker_room_option_id) || "Niet ingesteld"} />}
          {match.is_home_match && <Info label="Kleedkamer bezoekers" value={optionNames.get(match.visitor_locker_room_option_id) || "Niet ingesteld"} />}
          <Info label="Scheidsrechter" value={optionNames.get(match.referee_option_id) || "Aangeduid door KBVB"} />
        </dl>}
        {match.show_public_location && match.public_location && <Info label="Locatie" value={match.public_location} />}
      </PublicMatchInfoEditor>
    </section>

    {editing && canPrepare && <MatchPreparationEditor match={match} />}

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
      scoreA={match.score_a}
      scoreB={match.score_b}
      ownTeamSide={match.is_home_match ? "home" : "away"}
      homeTeamName={match.team_a_name}
      awayTeamName={match.team_b_name}
      completed={match.status === "finished"}
      showSelection={canViewSelection}
    />}

    {!staffCanView && <p className="rounded-xl border border-borderSubtle bg-cardDeep p-4 text-sm text-textMuted">
      {guardianSelections?.length
        ? guardianSelections.map(selection => <span key={selection.player_id} className="block font-semibold text-textPrimary">Jouw speler is {selection.selected ? "geselecteerd" : "niet geselecteerd"}.</span>)
        : <span>De selectie voor jouw speler is nog niet bekend.</span>}
      <span className="mt-2 block">Je ziet alleen de selectiestatus van je eigen kind. De volledige selectie en interne informatie zijn afgeschermd.</span>
    </p>}
  </main>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-borderSubtle bg-cardDeep p-3"><dt className="text-xs text-textMuted">{label}</dt><dd className="mt-1 font-semibold text-textPrimary">{value}</dd></div>;
}
