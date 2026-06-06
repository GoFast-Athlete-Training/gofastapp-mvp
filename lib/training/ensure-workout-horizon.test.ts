import assert from "node:assert/strict";
import test from "node:test";
import {
  clampHorizonDays,
  horizonDateKeyFromOffset,
  isRunnablePlanDay,
} from "./ensure-workout-horizon";
import { MaterializeWorkoutError, NO_PRESCRIPTION_STEPS } from "./workout-materializer";

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
