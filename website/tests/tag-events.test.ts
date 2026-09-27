import assert from "node:assert/strict";
import test from "node:test";
import { defaultGoalEventType, getTagEventKind } from "../src/lib/tag-events.ts";

test("existing Goal Thuis and Goal Uit buttons are goal events", () => {
  assert.equal(getTagEventKind("Goal"), "goal");
  assert.equal(getTagEventKind("Goal Thuis"), "goal");
  assert.equal(getTagEventKind("Goal Uit"), "goal");
  assert.equal(getTagEventKind("Doelpoging"), null);
});

test("home and away goal labels default to the correct own-team event", () => {
  assert.equal(defaultGoalEventType("Goal Thuis", true), "goal_for");
  assert.equal(defaultGoalEventType("Goal Uit", true), "goal_against");
  assert.equal(defaultGoalEventType("Goal Thuis", false), "goal_against");
  assert.equal(defaultGoalEventType("Goal Uit", false), "goal_for");
});
