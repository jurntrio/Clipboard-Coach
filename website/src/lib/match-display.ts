export type MatchDisplaySource = {
  team_a_name: string;
  team_b_name: string;
  score_a: number | null;
  score_b: number | null;
  is_home_match: boolean;
};

export function getMatchDisplay(match: MatchDisplaySource) {
  const ownTeamIsHome = match.is_home_match !== false;
  return {
    homeTeamName: ownTeamIsHome ? match.team_a_name : match.team_b_name,
    awayTeamName: ownTeamIsHome ? match.team_b_name : match.team_a_name,
    homeScore: ownTeamIsHome ? match.score_a : match.score_b,
    awayScore: ownTeamIsHome ? match.score_b : match.score_a
  };
}
