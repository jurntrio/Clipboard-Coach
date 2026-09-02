import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateMasTrainingZones,
  calculateVamevalMas,
  formatMasKmh,
  formatTestDuration,
  isValidSecondsComponent,
  isValidVamevalDurationSeconds,
} from "../src/lib/vameval.ts";

test("120 seconds gives 8 km/u", () => {
  assert.equal(calculateVamevalMas(120), 8);
});

test("180 seconds gives 8.5 km/u", () => {
  assert.equal(calculateVamevalMas(180), 8.5);
});

test("720 seconds gives 13 km/u", () => {
  assert.equal(calculateVamevalMas(720), 13);
  assert.equal(formatMasKmh(calculateVamevalMas(720)), "13");
});

test("training zone bounds at MAS 13 km/u", () => {
  const zones = calculateMasTrainingZones(13);
  assert.deepEqual(zones.map((zone) => [zone.percentMin, zone.percentMax, zone.lowerKmh, zone.upperKmh]), [
    [60, 70, 7.8, 9.1],
    [70, 80, 9.1, 10.4],
    [80, 90, 10.4, 11.7],
    [90, 95, 11.7, 12.4],
    [100, 105, 13, 13.7],
  ]);
});

test("formats seconds as mm:ss", () => {
  assert.equal(formatTestDuration(120), "2:00");
  assert.equal(formatTestDuration(195), "3:15");
  assert.equal(formatTestDuration(720), "12:00");
  assert.equal(formatTestDuration(65), "1:05");
});

test("rejects a total duration under 120 seconds", () => {
  assert.equal(isValidVamevalDurationSeconds(119), false);
  assert.equal(isValidVamevalDurationSeconds(0), false);
  assert.throws(() => calculateVamevalMas(119), RangeError);
});

test("rejects seconds outside the 0-59 range", () => {
  assert.equal(isValidSecondsComponent(-1), false);
  assert.equal(isValidSecondsComponent(60), false);
  assert.equal(isValidSecondsComponent(0), true);
  assert.equal(isValidSecondsComponent(59), true);
});

test("rejects NaN, Infinity and non-integer durations as unrealistic/invalid input", () => {
  assert.equal(isValidVamevalDurationSeconds(Number.NaN), false);
  assert.equal(isValidVamevalDurationSeconds(Number.POSITIVE_INFINITY), false);
  assert.equal(isValidVamevalDurationSeconds(-720), false);
  assert.equal(isValidVamevalDurationSeconds(720.5), false);
  assert.equal(isValidVamevalDurationSeconds(999999), false); // unrealistically long test
});

test("server-side MAS is recomputed from the raw duration only, never trusting a client-supplied value", () => {
  // Simulates what the API route does: it reads `results.duration_seconds` from the
  // request body and always recalculates MAS itself, ignoring any `mas_kmh` the
  // client might have included (e.g. a tampered/inflated value).
  const tamperedClientPayload = { duration_seconds: 720, mas_kmh: 999 };
  const trustedMas = calculateVamevalMas(tamperedClientPayload.duration_seconds);
  assert.equal(trustedMas, 13);
  assert.notEqual(trustedMas, tamperedClientPayload.mas_kmh);
});
