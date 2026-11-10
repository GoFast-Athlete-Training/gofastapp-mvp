import assert from "node:assert/strict";
import test from "node:test";
import { BUILD_TO_PEAK_WEEKS, splitBuildRampToPeak } from "@/lib/training/plan-week-phase-split";

test("splitBuildRampToPeak holds early weeks when build exceeds ramp length", () => {
  const buildWeeks = Array.from({ length: 16 }, (_, i) => i + 1);
  const split = splitBuildRampToPeak(buildWeeks);
  assert.equal(split.holdWeekNumbers.length, 8);
  assert.equal(split.rampWeekNumbers.length, BUILD_TO_PEAK_WEEKS);
  assert.deepEqual(split.holdWeekNumbers, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(split.rampWeekNumbers, [9, 10, 11, 12, 13, 14, 15, 16]);
  assert.equal(split.rampStartWeekNumber, 9);
});

test("splitBuildRampToPeak uses full span when build is short", () => {
  const split = splitBuildRampToPeak([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(split.holdWeekNumbers, []);
  assert.deepEqual(split.rampWeekNumbers, [1, 2, 3, 4, 5, 6, 7, 8]);
});
