import assert from "node:assert/strict";
import test from "node:test";
import { planDayIsCompleted, workoutHasActuals } from "./workout-has-actuals";

test("workoutHasActuals requires positive distance or duration", () => {
  assert.equal(workoutHasActuals({ actualDistanceMeters: 1000 }), true);
  assert.equal(workoutHasActuals({ actualDurationSeconds: 600 }), true);
  assert.equal(workoutHasActuals({}), false);
});

test("planDayIsCompleted prefers ingest stamp over missing actuals", () => {
  assert.equal(
    planDayIsCompleted({
      workoutCompleted: true,
      actualDistanceMeters: null,
      actualDurationSeconds: null,
    }),
    true
  );
});

test("planDayIsCompleted falls back to actuals when stamp absent", () => {
  assert.equal(
    planDayIsCompleted({
      workoutCompleted: false,
      actualDistanceMeters: 5000,
    }),
    true
  );
});
