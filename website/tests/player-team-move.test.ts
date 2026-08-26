import assert from "node:assert/strict";
import test from "node:test";
import { canMovePlayerToTeam } from "../src/lib/auth/player-team-move.ts";

const base = {
  sourceClubId: "club-a",
  targetClubId: "club-a",
  targetClubTeamId: "club-team-a",
  sourceCoachId: null,
  targetCoachId: null,
  isPlatformAdmin: false,
  canAccessTargetTeam: true,
  canManageTeams: true,
  canOverrideRosterLock: false,
  targetTrainersCanEditRoster: true
};

test("allows a trainer to move a player to an accessible editable team in the same club", () => {
  assert.equal(canMovePlayerToTeam(base), true);
});

test("rejects a target team in another club", () => {
  assert.equal(canMovePlayerToTeam({ ...base, targetClubId: "club-b" }), false);
});

test("keeps the club boundary for platform admins", () => {
  assert.equal(canMovePlayerToTeam({ ...base, targetClubId: "club-b", isPlatformAdmin: true }), false);
});

test("rejects an inaccessible team in the same club", () => {
  assert.equal(canMovePlayerToTeam({ ...base, canAccessTargetTeam: false }), false);
});

test("rejects a locked target roster for an ordinary trainer", () => {
  assert.equal(canMovePlayerToTeam({ ...base, targetTrainersCanEditRoster: false }), false);
});

test("allows a club-wide roster manager to use a locked target roster", () => {
  assert.equal(canMovePlayerToTeam({ ...base, targetTrainersCanEditRoster: false, canOverrideRosterLock: true }), true);
});

test("allows a legacy player move only to another personal team of the same owner", () => {
  const legacy = { ...base, sourceClubId: null, targetClubId: null, targetClubTeamId: null, sourceCoachId: "trainer-a", targetCoachId: "trainer-a" };
  assert.equal(canMovePlayerToTeam(legacy), true);
  assert.equal(canMovePlayerToTeam({ ...legacy, targetCoachId: "trainer-b" }), false);
  assert.equal(canMovePlayerToTeam({ ...legacy, targetClubTeamId: "club-team-a" }), false);
});

test("keeps legacy personal teams separated for platform admins", () => {
  const legacy = { ...base, sourceClubId: null, targetClubId: null, targetClubTeamId: null, sourceCoachId: "trainer-a", targetCoachId: "trainer-b", isPlatformAdmin: true };
  assert.equal(canMovePlayerToTeam(legacy), false);
});
