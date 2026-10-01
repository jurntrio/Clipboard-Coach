import assert from "node:assert/strict";
import test from "node:test";
import { makeReportGoal, normalizeReportGoals, validateGoalRange, goalMediaState, type GoalMedia } from "../src/lib/goal-media.ts";

test("both scoring sides use the home-away score as stable goal identity", () => {
  assert.equal(makeReportGoal({ scoreAfter: "1-0", team: "home" }).id, "goal-1");
  const equalizer = makeReportGoal({ scoreAfter: "1-1", team: "away", minute: 24, scorerId: "player" });
  assert.equal(equalizer.id, "goal-2");
  assert.equal(equalizer.minute, 24);
  assert.equal(equalizer.scorerPlayerId, "player");
  for (const input of [{ scoreAfter: "0-0", team: "home" }, { scoreAfter: "0-1", team: "home" }, { scoreAfter: "31-1", team: "away" }, { scoreAfter: "1-0", team: "home", minute: -1 }]) {
    assert.throws(() => makeReportGoal(input));
  }
});

test("clips require finite confirmed times within the source and duration limit", () => {
  assert.deepEqual(validateGoalRange(10, 20, 100), { start: 10, end: 20 });
  for (const [start, end, duration] of [[0, 0, 100], [-1, 20, 100], [0, 181, 1000], [1, 101, 100], [NaN, 10, 100], [0, Infinity, 100]]) {
    assert.throws(() => validateGoalRange(start, end, duration));
  }
});

test("a goal tagged out of order occupies its own report position without duplicate IDs", () => {
  const fifth = makeReportGoal({ scoreAfter: "3-2", team: "home" });
  fifth.description = "Bestaande notitie";
  const result = normalizeReportGoals([fifth], 6);
  assert.equal(result.length, 6);
  assert.equal(result[4], fifth);
  assert.equal(result[0].scoreAfter, "");
  assert.equal(new Set(result.map(goal => goal.id)).size, 6);
  assert.equal(normalizeReportGoals([fifth], 0).length, 5);
});

test("only a completed stored clip is labelled saved; later corrections require confirmation", () => {
  const media: GoalMedia = { id: "link", goal_id: "goal-1", tag_id: "tag", clip_id: "clip", start_time: 10, end_time: 20,
    clips: { id: "clip", render_status: "rendering", rendered_segments: [] } };
  assert.equal(goalMediaState(media), "Clip wordt bewaard");
  media.clips!.render_status = "failed";
  assert.equal(goalMediaState(media), "Bewaren mislukt");
  media.clips!.render_status = "ready";
  assert.equal(goalMediaState(media), "Clip wordt bewaard");
  media.clips!.rendered_segments = [{ url: "stored.mp4" }];
  assert.equal(goalMediaState(media), "Clip bewaard");
  assert.match(goalMediaState(media, { start_time: 9, end_time: 20 }), /opnieuw bevestigen/);
  assert.equal(goalMediaState({ ...media, tag_id: null }), "Clip bewaard");
});
