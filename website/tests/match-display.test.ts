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

test("uses the club name for public own-team display when available", () => {
  assert.deepEqual(getMatchDisplay({
    team_a_name: "IP U13 Zwart",
    team_b_name: "Sparta Petegem",
    score_a: 0,
    score_b: 4,
    is_home_match: false,
    club_name: "KM Torhout"
  }), {
    homeTeamName: "Sparta Petegem",
    awayTeamName: "KM Torhout",
    homeScore: 4,
    awayScore: 0
  });
});

test("prefers official federation home and away names when available", () => {
  assert.deepEqual(getMatchDisplay({
    team_a_name: "IP U13 Zwart",
    team_b_name: "Sparta Petegem",
    score_a: 0,
    score_b: 4,
    is_home_match: false,
    club_name: "KM Torhout",
    official_home_team_name: "Sparta Petegem",
    official_away_team_name: "KM Torhout"
  }), {
    homeTeamName: "Sparta Petegem",
    awayTeamName: "KM Torhout",
    homeScore: 4,
    awayScore: 0
  });
});
