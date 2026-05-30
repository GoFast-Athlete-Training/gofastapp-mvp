import assert from "node:assert/strict";
import test from "node:test";
import { isManualMatchOnlyWorkout } from "./match-activity-to-workout";

test("isManualMatchOnlyWorkout is true for plan-linked workouts", () => {
  assert.equal(isManualMatchOnlyWorkout({ planId: "plan-1" }), true);
});

test("isManualMatchOnlyWorkout is false for standalone pushed workouts", () => {
  assert.equal(isManualMatchOnlyWorkout({ planId: null }), false);
});
