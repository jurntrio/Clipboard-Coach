import assert from "node:assert/strict";
import test from "node:test";
import { calculatePhaseRanges, canManageTrainingPhases, phaseForTrainingDate, validatePhaseRanges } from "../src/lib/training-season-phases.ts";

test("calculates every non-final end date as the day before the next start", () => {
  const result = calculatePhaseRanges([
    { phase: "Pre Season", startDate: "2026-07-01" },
    { phase: "Voorbereiding", startDate: "2026-07-20", endDate: "2026-08-14" }
  ]);
  assert.equal(result.error, null);
  assert.equal(result.ranges[0].endDate, "2026-07-19");
});

test("rejects equal start dates and reverse chronology", () => {
  assert.match(calculatePhaseRanges([{ phase: "Competitie", startDate: "2026-08-01" }, { phase: "After Season", startDate: "2026-08-01", endDate: "2026-09-01" }]).error!, /zelfde dag/);
  assert.match(calculatePhaseRanges([{ phase: "Competitie", startDate: "2026-08-02" }, { phase: "After Season", startDate: "2026-08-01", endDate: "2026-09-01" }]).error!, /chronologisch/);
});

test("accepts multiple consecutive occurrences of the same phase type", () => {
  const result = calculatePhaseRanges([{ phase: "Competitie", startDate: "2026-08-01" }, { phase: "Competitie", startDate: "2026-09-01", endDate: "2026-10-01" }]);
  assert.equal(result.error, null);
  assert.deepEqual(result.ranges.map(item => item.phase), ["Competitie", "Competitie"]);
});

test("rejects overlapping phase ranges", () => {
  assert.match(validatePhaseRanges([
    { phase: "Voorbereiding", startDate: "2026-07-01", endDate: "2026-07-20" },
    { phase: "Competitie", startDate: "2026-07-20", endDate: "2027-05-14" }
  ])!, /overlappen/);
});

test("assigns trainings on both inclusive phase boundaries", () => {
  const ranges = calculatePhaseRanges([{ phase: "Voorbereiding", startDate: "2026-07-20", endDate: "2026-08-14" }]).ranges;
  assert.equal(phaseForTrainingDate("2026-07-20", ranges), "Voorbereiding");
  assert.equal(phaseForTrainingDate("2026-08-14", ranges), "Voorbereiding");
});

test("returns no phase outside all configured ranges", () => {
  const ranges = calculatePhaseRanges([{ phase: "Competitie", startDate: "2026-08-01", endDate: "2027-05-14" }]).ranges;
  assert.equal(phaseForTrainingDate("2026-07-31", ranges), null);
});

test("ordinary trainers have read-only phase access", () => {
  assert.equal(canManageTrainingPhases("trainer"), false);
  assert.equal(canManageTrainingPhases("club_admin"), true);
});
