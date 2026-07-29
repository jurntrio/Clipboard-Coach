import assert from "node:assert/strict";
import test from "node:test";
import { normalizedTeamName, officialTeamId } from "./voetbalVlaanderen";

test("extracts the official team id from overview and calendar links", () => {
  assert.equal(officialTeamId("https://www.voetbalvlaanderen.be/club/1185/ploeg/364282/kalender"), "364282");
  assert.equal(officialTeamId("https://www.voetbalvlaanderen.be/club/1185/ploeg/364282/overzicht"), "364282");
  assert.equal(officialTeamId("https://example.com/club/1185/ploeg/364282/kalender"), null);
});

test("normalizes team names for cross-source duplicate detection", () => {
  assert.equal(normalizedTeamName("K. SV Veurne A"), normalizedTeamName("K SV VEURNE A"));
});
