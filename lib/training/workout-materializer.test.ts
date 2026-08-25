import assert from "node:assert/strict";
import test from "node:test";
import {
  clampHorizonDays,
  horizonDateKeyFromOffset,
  isRunnablePlanDay,
} from "./ensure-workout-horizon";
import {
  MaterializeWorkoutError,
  NO_PRESCRIPTION_STEPS,
  type MaterializeWorkoutForPlanDayResult,
} from "./workout-materializer";

test("clampHorizonDays defaults to 14 and caps at 21", () => {
  assert.equal(clampHorizonDays(undefined), 14);
  assert.equal(clampHorizonDays(0), 1);
  assert.equal(clampHorizonDays(-3), 1);
  assert.equal(clampHorizonDays(30), 21);
});

test("horizonDateKeyFromOffset advances calendar days in UTC", () => {
  assert.equal(horizonDateKeyFromOffset("2026-06-01", 0), "2026-06-01");
  assert.equal(horizonDateKeyFromOffset("2026-06-01", 13), "2026-06-14");
});

test("isRunnablePlanDay skips rest days and null schedule slots", () => {
  assert.equal(isRunnablePlanDay(null), false);
  assert.equal(isRunnablePlanDay({ workoutType: "Easy", title: "Rest" }), false);
  assert.equal(isRunnablePlanDay({ workoutType: "Easy", title: "Easy Run" }), true);
});

test("MaterializeWorkoutError exposes stable no-steps code prefix", () => {
  const err = new MaterializeWorkoutError(
    `${NO_PRESCRIPTION_STEPS}: Could not prescribe segments for Tempo on 2026-06-01.`
  );
  assert.equal(err.name, "MaterializeWorkoutError");
  assert.match(err.message, new RegExp(`^${NO_PRESCRIPTION_STEPS}:`));
});

test("materialize result exposes plannedWorkoutId as canonical id", () => {
  const result: MaterializeWorkoutForPlanDayResult = {
    plannedWorkoutId: "planned_abc",
    workoutId: "planned_abc",
    status: "already_ready",
  };
  assert.equal(result.plannedWorkoutId, result.workoutId);
});

test("never-done plan day has no instance requirement in result shape", () => {
  const result: MaterializeWorkoutForPlanDayResult = {
    plannedWorkoutId: "planned_only",
    workoutId: "planned_only",
    status: "materialized",
  };
  assert.ok(result.plannedWorkoutId);
  assert.equal(typeof result.plannedWorkoutId, "string");
});
