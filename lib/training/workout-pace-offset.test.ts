import assert from "node:assert/strict";
import test from "node:test";
import {
  inferOffsetSecPerMileFromPace,
  isWorkBlockEligibleForPaceOffset,
  presetIdForWorkoutOffset,
  shiftPaceBandSecPerMile,
} from "@/lib/training/workout-pace-offset";

test("inferOffsetSecPerMileFromPace uses midpoint vs 5K anchor", () => {
  assert.equal(inferOffsetSecPerMileFromPace(416, 428, 386), 36);
});

test("shiftPaceBandSecPerMile preserves band width", () => {
  assert.deepEqual(shiftPaceBandSecPerMile(416, 428, -10), { low: 406, high: 418 });
});

test("presetIdForWorkoutOffset maps known offsets", () => {
  assert.equal(presetIdForWorkoutOffset(15), "10k");
  assert.equal(presetIdForWorkoutOffset(20), "custom");
});

test("tempo work blocks get pace offset controls even without stored PACE targets", () => {
  assert.equal(
    isWorkBlockEligibleForPaceOffset({
      title: "Tempo",
      hasPaceTarget: false,
      conversational: false,
    }),
    true
  );
  assert.equal(
    isWorkBlockEligibleForPaceOffset({
      title: "Warm-up",
      hasPaceTarget: false,
      conversational: false,
    }),
    false
  );
});
