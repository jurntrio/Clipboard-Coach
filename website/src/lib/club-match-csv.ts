export type ClubMatchCsvRow = {
  date: string; time: string; competition: string; homeTeam: string; awayTeam: string;
  isHome: boolean; scoreHome: number | null; scoreAway: number | null; status: "scheduled" | "finished";
};

function splitCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value.trim()); value = "";
    } else value += char;
  }
  values.push(value.trim());
  return values;
}

export function parseClubMatchCsv(source: string): ClubMatchCsvRow[] {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Het CSV-bestand bevat geen wedstrijden.");
  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  if (["date", "time", "home_team", "away_team"].some((header) => !headers.includes(header))) {
    throw new Error("Gebruik een CSV met minstens date, time, home_team en away_team.");
  }
  const at = (values: string[], name: string) => values[headers.indexOf(name)]?.trim() ?? "";
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const date = at(values, "date");
    const time = at(values, "time");
    const homeTeam = at(values, "home_team");
    const awayTeam = at(values, "away_team");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time) || !homeTeam || !awayTeam) {
      throw new Error(`Ongeldige wedstrijd op CSV-regel ${index + 2}.`);
    }
    const numberOrNull = (entry: string) => entry !== "" && Number.isFinite(Number(entry)) ? Number(entry) : null;
    const sourceStatus = at(values, "status").toLowerCase();
    return {
      date, time, homeTeam, awayTeam, competition: at(values, "competition"),
      isHome: ["true", "1", "yes", "ja"].includes(at(values, "is_snaaskerke_home").toLowerCase()),
      scoreHome: numberOrNull(at(values, "score_home")), scoreAway: numberOrNull(at(values, "score_away")),
      status: ["played", "finished", "ended", "forfait"].includes(sourceStatus) ? "finished" : "scheduled"
    };
  });
}
