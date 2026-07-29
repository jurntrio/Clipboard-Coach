import { createAdminClient } from "@/lib/supabase/admin";
import { removeFoot24Advertisements } from "@/lib/foot24-calendar";

type OfficialGame = {
  id: string;
  startTime: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  outcome?: { status?: string | null; homeTeamGoals?: number | null; awayTeamGoals?: number | null } | null;
  state?: string | null;
};

const query = `query GetTeamCalendar ($teamId: ID!, $language: Language!, $sortByDate: SortDirection) {
  teamCalendar(teamId: $teamId, language: $language, sortByDate: $sortByDate) {
    id startTime
    homeTeam { id name clubId }
    awayTeam { id name clubId }
    outcome { status homeTeamGoals awayTeamGoals }
    series { id name }
    officials { lastName firstName status personAssigned }
    state
  }
}`;

export function parseVoetbalVlaanderenUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Dit is geen geldige URL."); }
  const match = url.pathname.match(/^\/club\/(\d+)\/ploeg\/(\d+)\/(?:kalender|overzicht)\/?$/);
  if (url.protocol !== "https:" || !["voetbalvlaanderen.be", "www.voetbalvlaanderen.be"].includes(url.hostname.toLowerCase()) || !match) {
    throw new Error("Gebruik de kalenderlink van de ploeg op voetbalvlaanderen.be.");
  }
  return { url: `https://www.voetbalvlaanderen.be/club/${match[1]}/ploeg/${match[2]}/kalender`, clubId: match[1], teamId: match[2] };
}

async function fetchOfficialGames(teamId: string): Promise<OfficialGame[]> {
  const username = process.env.RBFA_API_USERNAME;
  const password = process.env.RBFA_API_PASSWORD;
  if (!username || !password) throw new Error("De Voetbal Vlaanderen-koppeling is nog niet geconfigureerd op de server.");
  const response = await fetch(process.env.RBFA_GRAPHQL_URL ?? "https://datalake-prod2018.rbfa.be/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
    },
    body: JSON.stringify({ query, variables: { teamId, language: "nl", sortByDate: "ASC" } }),
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Voetbal Vlaanderen antwoordde met status ${response.status}.`);
  const body = await response.json() as { data?: { teamCalendar?: OfficialGame[] }; errors?: Array<{ message?: string }> };
  if (body.errors?.length) throw new Error(body.errors[0]?.message || "Voetbal Vlaanderen gaf een fout terug.");
  return body.data?.teamCalendar ?? [];
}

function normalized(value: string) {
  return value.toLocaleLowerCase("nl").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export async function syncVoetbalVlaanderenFeed(teamId: string) {
  const admin = createAdminClient();
  await removeFoot24Advertisements(teamId);
  const [{ data: team }, { data: feed }] = await Promise.all([
    admin.from("club_teams").select("id, club_id, name").eq("id", teamId).maybeSingle(),
    admin.from("club_team_calendar_feeds").select("*").eq("club_team_id", teamId).maybeSingle()
  ]);
  if (!team || !feed) throw new Error("Geen kalenderlink voor deze ploeg ingesteld.");
  const official = parseVoetbalVlaanderenUrl(feed.feed_url);
  const games = await fetchOfficialGames(official.teamId);
  if (!games.length) throw new Error("Voetbal Vlaanderen gaf geen wedstrijden voor deze ploeg terug.");

  const [{ data: operationalTeam }, { data: owner }] = await Promise.all([
    admin.from("teams").select("id").eq("club_team_id", team.id).maybeSingle(),
    admin.from("club_memberships").select("profile_id").eq("club_id", team.club_id)
      .eq("role", "club_admin").eq("status", "active").limit(1).maybeSingle()
  ]);
  if (!operationalTeam || !owner?.profile_id) throw new Error("Ploeg of actieve clubadmin ontbreekt.");
  const { data: standardTags } = await admin.from("standard_tags").select("name").eq("coach_id", owner.profile_id).order("created_at");
  const defaultTags = (standardTags ?? []).map((tag) => tag.name).filter((name) => !["start", "end"].includes(name.trim().toLowerCase()));

  let imported = 0;
  let updated = 0;
  for (const game of games) {
    const startsAt = new Date(game.startTime);
    if (Number.isNaN(startsAt.getTime())) continue;
    const ownIsHome = String(game.homeTeam.id) === official.teamId;
    const opponent = ownIsHome ? game.awayTeam.name : game.homeTeam.name;
    const matchDate = startsAt.toLocaleDateString("sv-SE", { timeZone: "Europe/Brussels" });
    const externalMatchId = `${team.id}:${game.id}`;
    let { data: existing } = await admin.from("matches").select("id, team_b_name")
      .eq("external_source", "voetbal_vlaanderen").eq("external_match_id", externalMatchId).maybeSingle();
    if (!existing) {
      const { data: sameDay } = await admin.from("matches").select("id, team_b_name")
        .eq("club_team_id", team.id).eq("match_date", matchDate);
      existing = (sameDay ?? []).find((candidate) => normalized(candidate.team_b_name) === normalized(opponent)) ?? null;
    }
    const finished = ["finished", "played", "ended"].includes(`${game.state ?? game.outcome?.status ?? ""}`.toLowerCase());
    const payload = {
      coach_id: owner.profile_id,
      club_id: team.club_id,
      club_team_id: team.id,
      team_a_id: operationalTeam.id,
      team_a_name: team.name,
      team_b_name: opponent,
      is_home_match: ownIsHome,
      match_date: matchDate,
      start_time: startsAt.toLocaleTimeString("nl-BE", { timeZone: "Europe/Brussels", hour12: false, hour: "2-digit", minute: "2-digit" }),
      status: finished ? "finished" : "scheduled",
      score_a: ownIsHome ? game.outcome?.homeTeamGoals ?? null : game.outcome?.awayTeamGoals ?? null,
      score_b: ownIsHome ? game.outcome?.awayTeamGoals ?? null : game.outcome?.homeTeamGoals ?? null,
      external_source: "voetbal_vlaanderen",
      external_match_id: externalMatchId
    };
    const result = existing
      ? await admin.from("matches").update(payload).eq("id", existing.id)
      : await admin.from("matches").insert({ ...payload, live_tag_names: defaultTags });
    if (result.error) throw new Error(result.error.message);
    if (existing) updated += 1; else imported += 1;
  }
  await admin.from("club_team_calendar_feeds").update({
    last_synced_at: new Date().toISOString(),
    last_sync_status: "ok",
    last_sync_message: `${imported} nieuw, ${updated} bijgewerkt via Voetbal Vlaanderen.`,
    updated_at: new Date().toISOString()
  }).eq("id", feed.id);
  return { imported, updated, unchanged: imported === 0 && updated === 0 };
}
