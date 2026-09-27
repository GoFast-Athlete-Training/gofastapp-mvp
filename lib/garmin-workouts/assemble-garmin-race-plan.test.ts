import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleGarminRacePlanWorkout } from "./assemble-garmin-race-plan";
import { GarminIntensity, GarminTargetType } from "./types";

test("assembleGarminRacePlanWorkout uses cue and pace band per block", () => {
  const workout = assembleGarminRacePlanWorkout({
    title: "Boulderthon",
    plan: {
      goal: "Hold steady",
      primaryRule: "",
      blocks: [
        {
          mileStart: 0,
          mileEnd: 3,
          paceLow: "7:03",
          paceHigh: "7:07",
          effort: "Easy",
          instruction: "Settle",
          cue: "EASY OUT",
        },
      ],
    },
  });
  assert.equal(workout.steps.length, 1);
  assert.equal(workout.steps[0]!.description, "EASY OUT");
  assert.equal(workout.steps[0]!.intensity, GarminIntensity.ACTIVE);
  assert.equal(workout.steps[0]!.targetType, GarminTargetType.SPEED);
  assert.ok(workout.steps[0]!.targetValueLow != null);
  assert.ok(workout.steps[0]!.targetValueHigh != null);
});
