import assert from "node:assert/strict";
import test from "node:test";
import { inPeriod, isExpected, summarize } from "../src/lib/training-statistics.ts";

test("counts present, injured and absent and calculates the percentage", () => {
  assert.deepEqual(summarize(["present", "present", "injured", "absent"]), { present: 2, injured: 1, absent: 1, total: 4, percentage: 50 });
});

test("injury is expected but is not present", () => assert.deepEqual(summarize(["injured"]), { present: 0, injured: 1, absent: 0, total: 1, percentage: 0 }));
test("outside-membership cells do not count", () => assert.deepEqual(summarize([null, "present", null]), { present: 1, injured: 0, absent: 0, total: 1, percentage: 100 }));
test("a later join excludes earlier training", () => { const player = { validFrom: "2026-10-01", validUntil: null }; assert.equal(isExpected(player, "2026-09-30"), false); assert.equal(isExpected(player, "2026-10-01"), true); });
test("a departure includes the last day and excludes later training", () => { const player = { validFrom: "2026-08-01", validUntil: "2026-10-01" }; assert.equal(isExpected(player, "2026-10-01"), true); assert.equal(isExpected(player, "2026-10-02"), false); });
test("period filters include exact custom boundaries", () => { assert.equal(inPeriod("2026-08-03", "custom", "2026-08", "2026-07", "2026-08-03", "2026-08-03"), true); assert.equal(inPeriod("2026-08-04", "custom", "2026-08", "2026-07", "2026-08-03", "2026-08-03"), false); });
test("scales to 30 players and 120 trainings", () => { const statuses = Array.from({ length: 30 * 120 }, (_, index) => index % 11 === 0 ? "injured" as const : index % 7 === 0 ? "absent" as const : "present" as const); assert.equal(summarize(statuses).total, 3600); });
