import assert from "node:assert/strict";
import test from "node:test";
import { getMatchDisplay } from "../src/lib/match-display.ts";

test("shows own-team home matches as team A against team B", () => {
  assert.deepEqual(getMatchDisplay({
    team_a_name: "KM Torhout",
    team_b_name: "KVV Zelzate",
    score_a: 2,
    score_b: 1,
    is_home_match: true
  }), {
    homeTeamName: "KM Torhout",
    awayTeamName: "KVV Zelzate",
    homeScore: 2,
    awayScore: 1
  });
});

test("shows future away matches with the opponent first", () => {
  assert.deepEqual(getMatchDisplay({
    team_a_name: "KM Torhout",
    team_b_name: "Sparta Petegem",
    score_a: 1,
    score_b: 3,
    is_home_match: false
  }), {
    homeTeamName: "Sparta Petegem",
    awayTeamName: "KM Torhout",
    homeScore: 3,
    awayScore: 1
  });
});
