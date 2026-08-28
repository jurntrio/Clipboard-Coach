import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";

const DOWNLOADS = [
  "https://static.rbfa.be/project/publiek/download/vvlresdownP.zip",
  "https://static.rbfa.be/project/publiek/download/vvldesdownP.zip"
] as const;

export type RbfaClubFixture = {
  key: string;
  division: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  ownIsHome: boolean;
  scoreHome: number | null;
  scoreAway: number | null;
  status: "scheduled" | "finished";
  sourceFile: "results" | "designations";
  referee: string | null;
  assistantReferee1: string | null;
  assistantReferee2: string | null;
};

function splitSemicolonLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ";" && !quoted) {
      values.push(value.trim()); value = "";
    } else value += char;
  }
  values.push(value.trim());
  return values;
}

export function normalizeRbfaFixtureName(value: string) {
  return value.toLocaleLowerCase("nl").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function isClubTeamName(value: string, clubName: string) {
  const name = normalizeRbfaFixtureName(value);
  const club = normalizeRbfaFixtureName(clubName);
  return name === club || name.startsWith(`${club} `);
}

function dateToIso(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function numberOrNull(value: string | undefined) {
  return value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
}

async function downloadCsv(url: string) {
  const response = await fetch(url, { next: { revalidate: 21_600 }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Voetbal Vlaanderen-download mislukt (${response.status}).`);
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const csv = Object.entries(files).find(([name]) => name.toLowerCase().endsWith(".csv"));
  if (!csv) throw new Error("Het Voetbal Vlaanderen-archief bevat geen CSV-bestand.");
  return strFromU8(csv[1]).replace(/^\uFEFF/, "");
}

function parseRows(source: string) {
  const lines = source.split(/\r?\n/).filter(line => line.trim());
  const headers = splitSemicolonLine(lines[0] ?? "").map(header => header.toUpperCase());
  return lines.slice(1).map(line => {
    const values = splitSemicolonLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export async function downloadRbfaClubFixtures(clubName: string, registrationNumber: string | number) {
  const [resultsCsv, designationsCsv] = await Promise.all(DOWNLOADS.map(downloadCsv));
  const registration = String(registrationNumber).padStart(5, "0");
  const fixtures: Omit<RbfaClubFixture, "key">[] = [];
  const resultFixturesByMatch = new Map<string, Omit<RbfaClubFixture, "key">>();

  for (const row of parseRows(resultsCsv)) {
    const home = row.REGNUMBERHOME === registration;
    const away = row.REGNUMBERAWAY === registration;
    if (!home && !away) continue;
    const date = dateToIso(row.DATE);
    if (!date || !row.HOME || !row.AWAY) continue;
    const matchIdentity = `${date}|${normalizeRbfaFixtureName(row.HOME)}|${normalizeRbfaFixtureName(row.AWAY)}`;
    const scoreHome = numberOrNull(row.RH);
    const scoreAway = numberOrNull(row.RA);
    const fixture: Omit<RbfaClubFixture, "key"> = {
      division: row.DIV, date, time: row.HOUR, homeTeam: row.HOME, awayTeam: row.AWAY,
      ownIsHome: home, scoreHome, scoreAway,
      status: scoreHome !== null && scoreAway !== null ? "finished" : "scheduled",
      sourceFile: "results", referee: null, assistantReferee1: null, assistantReferee2: null
    };
    fixtures.push(fixture);
    resultFixturesByMatch.set(matchIdentity, fixture);
  }

  for (const row of parseRows(designationsCsv)) {
    const home = isClubTeamName(row.HOME, clubName);
    const away = isClubTeamName(row.AWAY, clubName);
    if (home === away) continue;
    const date = dateToIso(row.DATE);
    if (!date || !row.HOME || !row.AWAY) continue;
    const matchIdentity = `${date}|${normalizeRbfaFixtureName(row.HOME)}|${normalizeRbfaFixtureName(row.AWAY)}`;
    const resultFixture = resultFixturesByMatch.get(matchIdentity);
    if (resultFixture) {
      // The designation feed carries schedule corrections. Keep the result and
      // update its kickoff instead of importing the corrected row as a new game.
      resultFixture.time = row.HOUR || resultFixture.time;
      resultFixture.referee = row.REFEREE || null;
      resultFixture.assistantReferee1 = row["ASSISTANT-REFEREE1"] || null;
      resultFixture.assistantReferee2 = row["ASSISTANT-REFEREE2"] || null;
      continue;
    }
    fixtures.push({
      division: row.DIV, date, time: row.HOUR, homeTeam: row.HOME, awayTeam: row.AWAY,
      ownIsHome: home, scoreHome: null, scoreAway: null, status: "scheduled", sourceFile: "designations",
      referee: row.REFEREE || null,
      assistantReferee1: row["ASSISTANT-REFEREE1"] || null,
      assistantReferee2: row["ASSISTANT-REFEREE2"] || null
    });
  }

  const occurrences = new Map<string, number>();
  return fixtures.map(fixture => {
    const signature = `${fixture.date}|${fixture.time}|${fixture.homeTeam}|${fixture.awayTeam}`;
    const occurrence = occurrences.get(signature) ?? 0;
    occurrences.set(signature, occurrence + 1);
    return {
      ...fixture,
      key: createHash("sha256").update(`${signature}|${occurrence}`).digest("hex").slice(0, 24)
    };
  });
}

export function rbfaFixtureOpponent(fixture: Pick<RbfaClubFixture, "ownIsHome" | "homeTeam" | "awayTeam">) {
  return fixture.ownIsHome ? fixture.awayTeam : fixture.homeTeam;
}

export function filterUnlinkedRbfaFixtures(fixtures: RbfaClubFixture[], matches: Array<{
  club_team_id: string | null; match_date: string | null; start_time: string | null; team_b_name: string;
}>) {
  const linkedCounts = new Map<string, number>();
  for (const match of matches) {
    if (!match.club_team_id || !match.match_date) continue;
    const signature = `${match.match_date}|${normalizeRbfaFixtureName(match.team_b_name)}`;
    linkedCounts.set(signature, (linkedCounts.get(signature) ?? 0) + 1);
  }
  return fixtures.filter(fixture => {
    const signature = `${fixture.date}|${normalizeRbfaFixtureName(rbfaFixtureOpponent(fixture))}`;
    const count = linkedCounts.get(signature) ?? 0;
    if (!count) return true;
    linkedCounts.set(signature, count - 1);
    return false;
  });
}
