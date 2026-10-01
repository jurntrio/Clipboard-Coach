export type MatchDisplaySource = {
  team_a_name: string;
  team_b_name: string;
  score_a: number | null;
  score_b: number | null;
  is_home_match: boolean;
  club_name?: string | null;
  official_home_team_name?: string | null;
  official_away_team_name?: string | null;
};

export function getMatchDisplay(match: MatchDisplaySource) {
  const ownTeamIsHome = match.is_home_match !== false;
  const ownTeamName = match.club_name?.trim() || match.team_a_name;
  const officialHomeTeamName = match.official_home_team_name?.trim();
  const officialAwayTeamName = match.official_away_team_name?.trim();
  return {
    homeTeamName: officialHomeTeamName || (ownTeamIsHome ? ownTeamName : match.team_b_name),
    awayTeamName: officialAwayTeamName || (ownTeamIsHome ? match.team_b_name : ownTeamName),
    homeScore: ownTeamIsHome ? match.score_a : match.score_b,
    awayScore: ownTeamIsHome ? match.score_b : match.score_a
  };
}

export function getMatchTitle(match: Pick<MatchDisplaySource, "team_a_name" | "team_b_name" | "is_home_match" | "official_home_team_name" | "official_away_team_name"> | null, fallbackA: string, fallbackB: string) {
  const display = getMatchDisplay({ ...match, team_a_name: match?.team_a_name || fallbackA, team_b_name: match?.team_b_name || fallbackB, is_home_match: match?.is_home_match !== false, score_a: null, score_b: null });
  return `${display.homeTeamName} – ${display.awayTeamName}`;
}
