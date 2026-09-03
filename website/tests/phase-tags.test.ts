import assert from "node:assert/strict";
import test from "node:test";
import { createPhaseTagRange, MIN_PHASE_TAG_SECONDS } from "../src/lib/phase-tags";

test("creates a phase range from zero", () => {
  assert.deepEqual(createPhaseTagRange(0, 4.5), { startTime: 0, endTime: 4.5 });
});

test("normalizes a reversed range after a backwards time value", () => {
  assert.deepEqual(createPhaseTagRange(8, 3), { startTime: 3, endTime: 8 });
});

test("rejects zero-length and imperceptibly short ranges", () => {
  assert.equal(createPhaseTagRange(2, 2), null);
  assert.equal(createPhaseTagRange(2, 2 + MIN_PHASE_TAG_SECONDS / 2), null);
});

test("rejects invalid media times", () => {
  assert.equal(createPhaseTagRange(Number.NaN, 2), null);
  assert.equal(createPhaseTagRange(2, Number.POSITIVE_INFINITY), null);
});
