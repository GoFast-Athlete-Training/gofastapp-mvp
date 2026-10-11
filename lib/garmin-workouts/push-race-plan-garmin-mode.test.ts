import assert from "node:assert/strict";
import test from "node:test";

/** Documents push behavior: reuse garminWorkoutId when present. */
function shouldUpdateExistingGarminWorkout(garminWorkoutId: number | null): boolean {
  return garminWorkoutId != null;
}

test("push race plan uses update when garminWorkoutId exists", () => {
  assert.equal(shouldUpdateExistingGarminWorkout(12345), true);
  assert.equal(shouldUpdateExistingGarminWorkout(null), false);
});
