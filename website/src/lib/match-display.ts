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
