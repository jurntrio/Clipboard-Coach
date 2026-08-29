import assert from "node:assert/strict";
import test from "node:test";
import { canManageMatchVideoSources } from "../src/lib/auth/match-video-sources.ts";

const assignedTrainer = {
  readOnly: false,
  canAccessTeam: true,
  canCreateGames: true,
  role: "trainer",
  matchCoachId: "another-user",
  userId: "trainer-user"
};

test("an assigned trainer can add sources to an imported team match", () => {
  assert.equal(canManageMatchVideoSources(assignedTrainer), true);
});

test("a trainer cannot manage sources for an unassigned team", () => {
  assert.equal(canManageMatchVideoSources({ ...assignedTrainer, canAccessTeam: false }), false);
});

test("a trainer without match creation rights cannot manage another owner's sources", () => {
  assert.equal(canManageMatchVideoSources({ ...assignedTrainer, canCreateGames: false }), false);
});

test("read-only club accounts cannot manage sources", () => {
  assert.equal(canManageMatchVideoSources({ ...assignedTrainer, role: "club_admin_viewer", readOnly: true }), false);
});

test("the legacy match owner retains source management", () => {
  assert.equal(canManageMatchVideoSources({ ...assignedTrainer, canCreateGames: false, matchCoachId: "trainer-user" }), true);
});
