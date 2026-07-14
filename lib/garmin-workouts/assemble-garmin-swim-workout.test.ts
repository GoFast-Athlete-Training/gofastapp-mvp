import assert from "node:assert/strict";
import test from "node:test";
import { assembleGarminSwimWorkout } from "@/lib/garmin-workouts/assemble-garmin-swim-workout";
import { GarminSport, GarminDurationType, GarminTargetType } from "@/lib/garmin-workouts/types";

test("assembleGarminSwimWorkout maps distance steps with pace targets", () => {
  const payload = assembleGarminSwimWorkout({
    id: "sw1",
    athleteId: "a1",
    title: "Threshold 8×100",
    description: null,
    date: null,
    poolLengthMeters: 25,
    cssSecPer100m: 95,
    garminWorkoutId: null,
    garminScheduleId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [
      {
        id: "s1",
        swimWorkoutId: "sw1",
        stepOrder: 1,
        title: "Main set",
        intensity: "MAIN",
        repeatCount: 8,
        durationType: "DISTANCE",
        durationMeters: 100,
        durationSeconds: null,
        paceSecPer100mLow: 95,
        paceSecPer100mHigh: 97,
        paceNote: "1:35–1:37/100m",
        strokeType: "FREESTYLE",
        equipment: null,
        drillType: null,
        restSeconds: 15,
        targetZone: null,
        heartRateLow: null,
        heartRateHigh: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });

  assert.equal(payload.sport, GarminSport.SWIMMING);
  assert.equal(payload.poolLength, 25);
  assert.equal(payload.steps.length, 1);
  const step = payload.steps[0]!;
  assert.equal(step.durationType, GarminDurationType.DISTANCE);
  assert.equal(step.durationValue, 100);
  assert.equal(step.targetType, GarminTargetType.PACE);
  assert.equal(step.targetValueLow, 95);
  assert.equal(step.targetValueHigh, 97);
  assert.ok(step.description?.includes("1:35"));
});
