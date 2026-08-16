import { env } from "./env";
import { supabase } from "./supabase";
import { normalizedTeamName, officialTeamId } from "./voetbalVlaanderen";

type OfficialGame = {
  id: string;
  startTime: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  series?: { id: string; name: string } | null;
  outcome?: { status?: string | null; homeTeamGoals?: number | null; awayTeamGoals?: number | null } | null;
  state?: string | null;
};

const query = `query GetTeamCalendar ($teamId: ID!, $language: Language!, $sortByDate: SortDirection) {
  teamCalendar(teamId: $teamId, language: $language, sortByDate: $sortByDate) {
    id startTime homeTeam { id name clubId } awayTeam { id name clubId }
    outcome { status homeTeamGoals awayTeamGoals }
    series { id name } officials { lastName firstName status personAssigned } state
  }
}`;

async function fetchGames(teamId: string) {
  if (!env.rbfaApiUsername || !env.rbfaApiPassword) throw new Error("RBFA API credentials are not configured");
  const response = await fetch(env.rbfaGraphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${Buffer.from(`${env.rbfaApiUsername}:${env.rbfaApiPassword}`).toString("base64")}`
    },
    body: JSON.stringify({ query, variables: { teamId, language: "nl", sortByDate: "ASC" } }),
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`RBFA response ${response.status}`);
  const body = await response.json() as { data?: { teamCalendar?: OfficialGame[] }; errors?: Array<{ message?: string }> };
  if (body.errors?.length) throw new Error(body.errors[0]?.message ?? "RBFA GraphQL error");
  return body.data?.teamCalendar ?? [];
}

async function syncFeed(feed: Record<string, any>) {
  const externalTeamId = officialTeamId(feed.feed_url);
  if (!externalTeamId) return false;
  const [{ data: team }, { data: operationalTeam }, { data: owner }] = await Promise.all([
    supabase.from("club_teams").select("id, club_id, name").eq("id", feed.club_team_id).maybeSingle(),
    supabase.from("teams").select("id").eq("club_team_id", feed.club_team_id).maybeSingle(),
    supabase.from("club_teams").select("club_id").eq("id", feed.club_team_id).maybeSingle()
      .then(async ({ data }) => data
        ? supabase.from("club_memberships").select("profile_id").eq("club_id", data.club_id)
            .eq("role", "club_admin").eq("status", "active").limit(1).maybeSingle()
        : { data: null })
  ]);
  if (!team || !operationalTeam || !owner?.profile_id) throw new Error("Team or club admin missing");
  const games = await fetchGames(externalTeamId);
  if (!games.length) throw new Error("No official games returned");
  const { data: standardTags } = await supabase.from("standard_tags").select("name").eq("coach_id", owner.profile_id).order("created_at");
  const defaultTags = (standardTags ?? []).map((tag) => tag.name).filter((name) => !["start", "end"].includes(name.trim().toLowerCase()));
  let imported = 0;
  let updated = 0;
  for (const game of games) {
    const startsAt = new Date(game.startTime);
    if (Number.isNaN(startsAt.getTime())) continue;
    const ownIsHome = String(game.homeTeam.id) === externalTeamId;
    const opponent = ownIsHome ? game.awayTeam.name : game.homeTeam.name;
    const matchDate = startsAt.toLocaleDateString("sv-SE", { timeZone: "Europe/Brussels" });
    const externalMatchId = `${team.id}:${game.id}`;
    let { data: existing } = await supabase.from("matches").select("id, team_b_name")
      .eq("external_source", "voetbal_vlaanderen").eq("external_match_id", externalMatchId).maybeSingle();
    if (!existing) {
      const { data: sameDay } = await supabase.from("matches").select("id, team_b_name")
        .eq("club_team_id", team.id).eq("match_date", matchDate);
      existing = (sameDay ?? []).find((candidate) => normalizedTeamName(candidate.team_b_name) === normalizedTeamName(opponent)) ?? null;
    }
    const finished = ["finished", "played", "ended"].includes(`${game.state ?? game.outcome?.status ?? ""}`.toLowerCase());
    const payload = {
      coach_id: owner.profile_id, club_id: team.club_id, club_team_id: team.id, team_a_id: operationalTeam.id,
      team_a_name: team.name, team_b_name: opponent, is_home_match: ownIsHome, match_date: matchDate,
      start_time: startsAt.toLocaleTimeString("nl-BE", { timeZone: "Europe/Brussels", hour12: false, hour: "2-digit", minute: "2-digit" }),
      status: finished ? "finished" : "scheduled",
      score_a: ownIsHome ? game.outcome?.homeTeamGoals ?? null : game.outcome?.awayTeamGoals ?? null,
      score_b: ownIsHome ? game.outcome?.awayTeamGoals ?? null : game.outcome?.homeTeamGoals ?? null,
      official_series_id: game.series?.id ?? null,
      official_series_name: game.series?.name?.trim() || null,
      external_source: "voetbal_vlaanderen", external_match_id: externalMatchId
    };
    const result = existing
      ? await supabase.from("matches").update(payload).eq("id", existing.id)
      : await supabase.from("matches").insert({ ...payload, live_tag_names: defaultTags });
    if (result.error) throw result.error;
    if (existing) updated += 1; else imported += 1;
  }
  await supabase.from("club_team_calendar_feeds").update({
    last_synced_at: new Date().toISOString(), last_sync_status: "ok",
    last_sync_message: `${imported} nieuw, ${updated} bijgewerkt via Voetbal Vlaanderen.`,
    updated_at: new Date().toISOString()
  }).eq("id", feed.id);
  return true;
}

export async function syncVoetbalVlaanderenCalendars() {
  if (!env.rbfaApiUsername || !env.rbfaApiPassword) return { checked: 0, configured: false };
  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data: feeds, error } = await supabase.from("club_team_calendar_feeds").select("*").eq("enabled", true)
    .like("feed_url", "%voetbalvlaanderen.be/%").or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`).limit(50);
  if (error) throw error;
  let checked = 0;
  for (const feed of feeds ?? []) {
    try { if (await syncFeed(feed)) checked += 1; }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase.from("club_team_calendar_feeds").update({
        last_synced_at: new Date().toISOString(), last_sync_status: "error", last_sync_message: message.slice(0, 500)
      }).eq("id", feed.id);
    }
  }
  return { checked, configured: true };
}
