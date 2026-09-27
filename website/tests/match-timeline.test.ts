import assert from "node:assert/strict";
import test from "node:test";
import { liveTagVideoSeconds } from "../src/lib/match-timeline.ts";
import type { LiveMatchTag, Match } from "../src/types/database.ts";

const match = {
  match_date: "2026-09-27",
  start_time: "15:00:00",
  recording_start_time: "15:00:00",
  live_tag_offset_seconds: 0
} as Match;

const liveTag = { occurred_at: new Date("2026-09-27T15:10:00").toISOString() } as LiveMatchTag;

test("recording pre-roll moves a live tag later on the video timeline", () => {
  assert.equal(liveTagVideoSeconds(liveTag, match, 120), 720);
});

test("manual live-tag calibration is added to recording pre-roll", () => {
  assert.equal(liveTagVideoSeconds(liveTag, { ...match, live_tag_offset_seconds: -5 }, 120), 715);
});
