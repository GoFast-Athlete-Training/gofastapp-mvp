import assert from "node:assert/strict";
import test from "node:test";
import { buildScheduleNativeWorkoutSteps } from "@/lib/training/schedule-native-workout-steps";

test("tempo schedule builds single Work block with pace targets from 5K", () => {
  const steps = buildScheduleNativeWorkoutSteps({
    workoutType: "Tempo",
    miles: 2,
    fiveKPace: "6:30",
  });
  assert.equal(steps.length, 1);
  assert.equal(steps[0]!.title, "Work");
  assert.equal(steps[0]!.durationValue, 2);
  assert.ok(Array.isArray(steps[0]!.targets) && steps[0]!.targets!.length > 0);
});

test("easy schedule builds Easy block with pace band", () => {
  const steps = buildScheduleNativeWorkoutSteps({
    workoutType: "Easy",
    miles: 4,
    fiveKPace: "6:30",
  });
  assert.equal(steps[0]!.title, "Easy");
  const t = steps[0]!.targets?.[0];
  assert.equal(t?.type, "PACE");
  assert.ok(t?.valueLow != null && t?.valueHigh != null);
});
