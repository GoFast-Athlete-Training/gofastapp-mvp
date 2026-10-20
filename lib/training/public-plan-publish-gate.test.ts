import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTrainingPlanPublishable,
  trainingPlanMeetsPublicPublishGate,
} from "@/lib/training/public-plan-publish-gate";

test("publish gate passes with structured schedule and name (no preset required)", () => {
  const plan = {
    name: "Marathon build",
    planSchedule: [{ weekNumber: 1, days: [{ dow: 1, workoutType: "Easy", miles: 5, catalogueWorkoutId: null, planCycleIndex: null }] }],
  };
  assert.equal(trainingPlanMeetsPublicPublishGate(plan), true);
  assert.doesNotThrow(() => assertTrainingPlanPublishable(plan));
});

test("publish gate fails without structured schedule", () => {
  assert.throws(
    () => assertTrainingPlanPublishable({ name: "X", planSchedule: [] }),
    /schedule/
  );
});
