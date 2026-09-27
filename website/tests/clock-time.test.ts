import assert from "node:assert/strict";
import test from "node:test";
import { parseClockTime } from "../src/lib/clock-time.ts";

test("parses natural minute and second input without moving digits", () => {
  assert.equal(parseClockTime("5:20"), 320);
  assert.equal(parseClockTime("0:05:20"), 320);
  assert.equal(parseClockTime("52:00"), 3120);
});

test("rejects malformed clock input", () => {
  assert.equal(parseClockTime("5:72"), null);
  assert.equal(parseClockTime(""), null);
});
