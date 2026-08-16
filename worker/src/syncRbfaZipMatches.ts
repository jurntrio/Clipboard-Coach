import { strFromU8, unzipSync } from "fflate";
import { supabase } from "./supabase";

const RESULTS_URL = "https://static.rbfa.be/project/publiek/download/vvlresdownP.zip";
const DESIGNATIONS_URL = "https://static.rbfa.be/project/publiek/download/vvldesdownP.zip";

type CsvRow = Record<string, string>;
type ZipFixture = {
  date: string;
  time: string;
  home: string;
  away: string;
  registrationHome: string;
  registrationAway: string;
  scoreHome: number | null;
  scoreAway: number | null;
  referee: string | null;
  assistant1: string | null;
  assistant2: string | null;
  hasDesignation: boolean;
};

function splitLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ";" && !quoted) {
      values.push(value.trim()); value = "";
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

export function parseRbfaCsv(source: string): CsvRow[] {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  const headers = splitLine(lines.shift() ?? "").map(header => header.toUpperCase());
  return lines.map(line => {
    const values = splitLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function normalized(value: string) {
  return value.toLocaleLowerCase("nl").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function dateToIso(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function score(value: string) {
  return value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
}

function identity(row: CsvRow) {
  return `${dateToIso(row.DATE)}|${row.HOUR.slice(0, 5)}|${normalized(row.HOME)}|${normalized(row.AWAY)}`;
}

async function downloadRows(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`RBFA ZIP response ${response.status}`);
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const csv = Object.entries(files).find(([name]) => name.toLowerCase().endsWith(".csv"));
  if (!csv) throw new Error("RBFA ZIP contains no CSV file");
  return parseRbfaCsv(strFromU8(csv[1]));
}

async function downloadFixtures() {
  const [results, designations] = await Promise.all([downloadRows(RESULTS_URL), downloadRows(DESIGNATIONS_URL)]);
  const designationByIdentity = new Map(designations.map(row => [identity(row), row]));
  const fixtures: ZipFixture[] = results.map(row => {
    const designation = designationByIdentity.get(identity(row));
    if (designation) designationByIdentity.delete(identity(row));
    return {
      date: dateToIso(row.DATE), time: row.HOUR.slice(0, 5), home: row.HOME, away: row.AWAY,
      registrationHome: row.REGNUMBERHOME, registrationAway: row.REGNUMBERAWAY,
      scoreHome: score(row.RH), scoreAway: score(row.RA),
      referee: designation?.REFEREE || null,
      assistant1: designation?.["ASSISTANT-REFEREE1"] || null,
      assistant2: designation?.["ASSISTANT-REFEREE2"] || null,
      hasDesignation: Boolean(designation)
    };
  }).filter(fixture => fixture.date && fixture.home && fixture.away);
  for (const row of designationByIdentity.values()) {
    const date = dateToIso(row.DATE);
    if (!date || !row.HOME || !row.AWAY) continue;
    fixtures.push({
      date, time: row.HOUR.slice(0, 5), home: row.HOME, away: row.AWAY,
      registrationHome: "", registrationAway: "", scoreHome: null, scoreAway: null,
      referee: row.REFEREE || null,
      assistant1: row["ASSISTANT-REFEREE1"] || null,
      assistant2: row["ASSISTANT-REFEREE2"] || null,
      hasDesignation: true
    });
  }
  return fixtures;
}

function registration(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").padStart(5, "0");
}

export async function syncRbfaZipMatches() {
  const fixtures = await downloadFixtures();
  const { data: clubs, error: clubError } = await supabase.from("clubs")
    .select("id, name, rbfa_registration_number").not("rbfa_registration_number", "is", null);
  if (clubError) throw clubError;
  let clubsChecked = 0;
  let matchesUpdated = 0;
  for (const club of clubs ?? []) {
    const reg = registration(club.rbfa_registration_number);
    const clubName = normalized(club.name);
    const clubFixtures = fixtures.filter(fixture =>
      registration(fixture.registrationHome) === reg || registration(fixture.registrationAway) === reg ||
      normalized(fixture.home).startsWith(clubName) || normalized(fixture.away).startsWith(clubName)
    );
    if (!clubFixtures.length) continue;
    clubsChecked += 1;
    const { data: matches, error: matchError } = await supabase.from("matches")
      .select("id, match_date, start_time, team_b_name, is_home_match").eq("club_id", club.id);
    if (matchError) throw matchError;
    for (const match of matches ?? []) {
      const opponent = normalized(match.team_b_name);
      const fixture = clubFixtures.find(item => item.date === match.match_date && item.time === match.start_time?.slice(0, 5) &&
        normalized(match.is_home_match ? item.away : item.home) === opponent);
      if (!fixture) continue;
      const ownScore = match.is_home_match ? fixture.scoreHome : fixture.scoreAway;
      const opponentScore = match.is_home_match ? fixture.scoreAway : fixture.scoreHome;
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (ownScore !== null && opponentScore !== null) Object.assign(payload, {
        score_a: ownScore, score_b: opponentScore, status: "finished"
      });
      if (fixture.hasDesignation) Object.assign(payload, {
        official_referee_name: fixture.referee,
        official_assistant_referee_1_name: fixture.assistant1,
        official_assistant_referee_2_name: fixture.assistant2,
        official_officials_synced_at: new Date().toISOString()
      });
      const { error } = await supabase.from("matches").update(payload).eq("id", match.id);
      if (error) throw error;
      matchesUpdated += 1;
    }
  }
  return { clubsChecked, matchesUpdated, fixtures: fixtures.length };
}
