import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { PublicMatchInfoEditor } from "@/components/matches/PublicMatchInfoEditor";
import { MatchDossierTabs } from "@/components/matches/MatchDossierTabs";
import { MatchPreparationButton } from "@/components/matches/MatchPreparationButton";

type GuardianPlayer = { player_id: string; team_id: string | null };

function displayDate(value: string | null) {
  if (!value) return "Nog niet bepaald";
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

export default async function GameOverviewPage({ params }: { params: { matchId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const canManagePublicInfo = staffCanView && hasClubPermission(access, "games.communication.manage");
  const [{ data: matchVideos }, { data: options }, { data: club }, { data: clubTeam }] = await Promise.all([
    canViewVideo
      ? admin.from("match_videos").select("video_id").eq("match_id", match.id)
      : Promise.resolve({ data: [] }),
    staffCanView
      ? admin.from("club_match_options").select("id, label").eq("club_id", match.club_id)
      : Promise.resolve({ data: [] }),
    canManagePublicInfo
      ? admin.from("clubs").select("clip_advertising_enabled, general_sponsor_url").eq("id", match.club_id).maybeSingle()
      : Promise.resolve({ data: null }),
    canManagePublicInfo && match.club_team_id
      ? admin.from("club_teams").select("sponsor_url, sponsor_enabled").eq("id", match.club_team_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);
  const videoIds = (matchVideos ?? []).map(item => item.video_id);
  const [{ data: selectedPlayers }, { data: guestPlayers }, { data: dossier }, { data: clips }, { data: completedByProfile }] = staffCanView ? await Promise.all([
    match.player_ids?.length
      ? admin.from("players").select("id, first_name, last_name, jersey_number").in("id", match.player_ids).order("jersey_number")
      : Promise.resolve({ data: [] }),
    admin.from("match_guest_players").select("id, first_name, last_name, jersey_number").eq("match_id", match.id).order("created_at"),
    admin.from("match_dossiers").select("*").eq("match_id", match.id).maybeSingle(),
    videoIds.length
      ? admin.from("clips").select("id, name, render_status, created_at, share_links(token)").in("video_id", videoIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    match.completed_by
      ? admin.from("profiles").select("full_name, email").eq("id", match.completed_by).maybeSingle()
      : Promise.resolve({ data: null })
  ]) : [{ data: [] }, { data: [] }, { data: null }, { data: [] }, { data: null }];
  const videoCount = videoIds.length;
  const dossierClips = (clips ?? []).map((clip: any) => ({
    id: clip.id,
    name: clip.name,
    render_status: clip.render_status,
    created_at: clip.created_at,
    shareToken: clip.share_links?.[0]?.token ?? null
  }));
  const optionNames = new Map((options ?? []).map((option) => [option.id, option.label]));
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
        {canManage && <Link href="/dashboard/clips" className="rounded-xl border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary">Wedstrijd beheren</Link>}
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
      {staffCanView && <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-textBright">Voorbereiding</h2>
          {canManage && <MatchPreparationButton match={match} />}
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-textMuted">Afgesproken tijdstip</dt><dd className="font-semibold text-textPrimary">{match.meeting_time_enabled ? match.meeting_time?.slice(0, 5) || "Nog niet bepaald" : "Niet ingesteld"}</dd></div>
          {!match.is_home_match && <div className="flex justify-between gap-4"><dt className="text-textMuted">Vertrek</dt><dd className="font-semibold text-textPrimary">{match.departure_time_enabled ? match.departure_time?.slice(0, 5) || "Nog niet bepaald" : "Niet ingesteld"}</dd></div>}
          <div className="flex justify-between gap-4"><dt className="text-textMuted">Verzamelplaats</dt><dd className="text-right font-semibold text-textPrimary">{match.meeting_place_custom || optionNames.get(match.meeting_place_option_id) || "Niet ingesteld"}</dd></div>
          {match.is_home_match && <div className="flex justify-between gap-4"><dt className="text-textMuted">Veld</dt><dd className="font-semibold text-textPrimary">{optionNames.get(match.field_option_id) || "Niet ingesteld"}</dd></div>}
          {match.is_home_match && <div className="flex justify-between gap-4"><dt className="text-textMuted">Kleedkamer</dt><dd className="font-semibold text-textPrimary">{optionNames.get(match.locker_room_option_id) || "Niet ingesteld"}</dd></div>}
        </dl>
      </div>}
      {canManagePublicInfo && <PublicMatchInfoEditor
        match={match}
        sponsorFeatureEnabled={club?.clip_advertising_enabled !== false}
        hasClubSponsor={!!club?.general_sponsor_url}
        hasTeamSponsor={clubTeam?.sponsor_enabled === true && !!clubTeam?.sponsor_url}
      />}
    </section>

    {staffCanView && <MatchDossierTabs
      matchId={match.id}
      players={[...(selectedPlayers ?? []), ...(guestPlayers ?? [])]}
      clips={dossierClips}
      initialDossier={dossier}
      editable={canManage}
      played={played}
      scoreA={match.score_a}
      scoreB={match.score_b}
      ownTeamSide={match.is_home_match ? "home" : "away"}
      homeTeamName={match.team_a_name}
      awayTeamName={match.team_b_name}
      completed={match.status === "finished"}
    />}

    {!staffCanView && <p className="rounded-xl border border-borderSubtle bg-cardDeep p-4 text-sm text-textMuted">
      Je ziet hier de algemene wedstrijdinformatie voor de ploeg van je kind. Extra voorbereiding, tagging en video zijn alleen beschikbaar voor bevoegde staf.
    </p>}
  </main>;
}
