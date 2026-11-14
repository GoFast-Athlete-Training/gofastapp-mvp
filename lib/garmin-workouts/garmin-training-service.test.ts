import assert from "node:assert/strict";
import test from "node:test";
import { assembleGarminWorkout } from "./garmin-training-service";
import { GarminIntensity, GarminRepeatType, GarminTargetType } from "./types";
import { parsedPasteToWorkoutSteps } from "@/lib/training/paste-workout-pipeline";
import { tryParsePastedWorkoutText } from "@/lib/training/parse-pasted-workout";
import { collapseFlatSegmentsForEditor, expandSegmentsForGarminPush } from "@/lib/training/segment-summary";
import {
  KM_PER_MILE,
  parsePaceToSecondsPerMile,
  secondsPerMileToSecondsPerKm,
  secondsPerMileToStoredPaceSecKm,
} from "@/lib/workout-generator/pace-calculator";

const M400 = 400 / 1609.34;

test("assembleGarminWorkout nests work inside REPEAT_UNTIL_STEPS_CMPLT for repeatCount without recovery", () => {
  const workout = assembleGarminWorkout({
    id: "w1",
    title: "Intervals",
    workoutType: "Intervals",
    segments: [
      {
        id: "s1",
        workoutId: "w1",
        stepOrder: 1,
        title: "Interval",
        durationType: "DISTANCE",
        durationValue: M400,
        repeatCount: 8,
      },
    ],
  });

  assert.equal(workout.steps.length, 1);
  const repeat = workout.steps[0]!;
  assert.equal(repeat.type, "WorkoutRepeatStep");
  assert.equal(repeat.repeatType, GarminRepeatType.REPEAT_UNTIL_STEPS_CMPLT);
  assert.equal(repeat.repeatValue, 8);
  assert.ok(Array.isArray(repeat.steps));
  assert.equal(repeat.steps!.length, 1);
  assert.equal(repeat.steps![0]!.type, "WorkoutStep");
});

test("assembleGarminWorkout nests work + recovery inside repeat block", () => {
  const workout = assembleGarminWorkout({
    id: "w1",
    title: "Intervals",
    workoutType: "Intervals",
    segments: [
      {
        id: "s1",
        workoutId: "w1",
        stepOrder: 1,
        title: "Interval",
        durationType: "DISTANCE",
        durationValue: M400,
        repeatCount: 8,
      },
      {
        id: "s2",
        workoutId: "w1",
        stepOrder: 2,
        title: "Recovery",
        durationType: "DISTANCE",
        durationValue: 0.062,
      },
    ],
  });

  assert.equal(workout.steps.length, 1);
  const repeat = workout.steps[0]!;
  assert.equal(repeat.repeatType, GarminRepeatType.REPEAT_UNTIL_STEPS_CMPLT);
  assert.equal(repeat.repeatValue, 8);
  assert.equal(repeat.steps!.length, 2);
  assert.equal(repeat.steps![0]!.description, "Interval");
  assert.equal(repeat.steps![1]!.description, "Recovery");
});

test("assembleGarminWorkout nests timed ON/OFF fartlek with paced recovery leg", () => {
  const note = "8x (3 min ON at 7:25, 3 min OFF at 8:25)";
  const parsed = tryParsePastedWorkoutText(note, "Intervals");
  assert.ok(parsed);
  const steps = parsedPasteToWorkoutSteps(parsed, "6:14");
  const collapsed = collapseFlatSegmentsForEditor(
    steps.map((s, i) => ({ ...s, id: `s-${i}` }))
  );
  const garminRows = expandSegmentsForGarminPush(
    collapsed.map((s, i) => ({ ...s, id: `g-${i}`, workoutId: "w1", paceTargetEncodingVersion: 2 as const }))
  );

  const workout = assembleGarminWorkout({
    id: "w1",
    title: "Fartlek",
    workoutType: "Intervals",
    segments: garminRows.map((s) => ({
      ...s,
      workoutId: "w1",
      paceTargetEncodingVersion: 2,
    })),
  });

  const repeat = workout.steps.find((st) => st.type === "WorkoutRepeatStep");
  assert.ok(repeat);
  assert.equal(repeat.repeatValue, 8);
  assert.equal(repeat.steps?.length, 2);
  const offStep = repeat.steps?.[1];
  assert.ok(offStep?.targetValueLow != null || offStep?.targetValue != null);
});

test("assembleGarminWorkout maps Main Work and Work to ACTIVE for running", () => {
  for (const title of ["Main Work", "Work"]) {
    const workout = assembleGarminWorkout({
      id: "w1",
      title: "Easy Run",
      workoutType: "Easy",
      segments: [
        {
          id: "s1",
          workoutId: "w1",
          stepOrder: 1,
          title,
          durationType: "DISTANCE",
          durationValue: 6,
        },
      ],
    });
    assert.equal(workout.steps.length, 1);
    assert.equal(workout.steps[0]!.intensity, GarminIntensity.ACTIVE);
  }
});

test("assembleGarminWorkout keeps Race and Work-prefixed steps ACTIVE", () => {
  for (const title of ["Race", "Work — start out strong"]) {
    const workout = assembleGarminWorkout({
      id: "w1",
      title: "Boulderthon",
      workoutType: "Race",
      segments: [
        {
          id: "s1",
          workoutId: "w1",
          stepOrder: 1,
          title,
          durationType: "DISTANCE",
          durationValue: 3,
        },
      ],
    });
    assert.equal(workout.steps[0]!.intensity, GarminIntensity.ACTIVE);
  }
});

test("assembleGarminWorkout heals corrupted durationValue 400 (meters stored as miles)", () => {
  const workout = assembleGarminWorkout({
    id: "w1",
    title: "Rolling 400s",
    workoutType: "Intervals",
    segments: [
      {
        id: "s1",
        workoutId: "w1",
        stepOrder: 1,
        title: "Interval",
        durationType: "DISTANCE",
        durationValue: 400,
        repeatCount: 8,
      },
    ],
  });

  const repeat = workout.steps[0]!;
  assert.equal(repeat.steps![0]!.durationValue, 400);
});

test("assembleGarminWorkout sends pace only when a running repeat also has heart rate", () => {
  const workout = assembleGarminWorkout({
    id: "w1",
    title: "Saturday MP",
    workoutType: "Easy",
    segments: [
      {
        id: "s1",
        workoutId: "w1",
        stepOrder: 1,
        title: "Work",
        durationType: "DISTANCE",
        durationValue: 5,
        repeatCount: 3,
        targets: [
          { type: "PACE", valueLow: 400, valueHigh: 410 },
          { type: "HEART_RATE", valueLow: 120, valueHigh: 160 },
        ],
      },
    ],
  });

  const step = workout.steps[0]!.steps![0]!;
  assert.equal(step.targetType, GarminTargetType.SPEED);
  assert.equal(step.secondaryTargetType, undefined);
  assert.ok(step.targetValueLow != null);
  assert.ok(step.targetValueHigh != null);
});

test("assembleGarminWorkout keeps heart rate as the only target when pace is absent", () => {
  const workout = assembleGarminWorkout({
    id: "w1",
    title: "HR run",
    workoutType: "Easy",
    segments: [
      {
        id: "s1",
        workoutId: "w1",
        stepOrder: 1,
        title: "Work",
        durationType: "DISTANCE",
        durationValue: 5,
        targets: [{ type: "HEART_RATE", valueLow: 120, valueHigh: 160 }],
      },
    ],
  });

  const step = workout.steps[0]!;
  assert.equal(step.targetType, GarminTargetType.HEART_RATE);
  assert.equal(step.targetValueLow, 120);
  assert.equal(step.targetValueHigh, 160);
  assert.equal(step.secondaryTargetType, undefined);
});

function expectedSpeedMps(secKm: number): number {
  const secPerMile = Math.round(secKm) * KM_PER_MILE;
  return Math.round((3600 / secPerMile) * 0.44704 * 1000) / 1000;
}

test("assembleGarminWorkout sends a saved 6:50–7:00 band with no extra pad", () => {
  const fast = secondsPerMileToStoredPaceSecKm(parsePaceToSecondsPerMile("6:50"));
  const slow = secondsPerMileToStoredPaceSecKm(parsePaceToSecondsPerMile("7:00"));
  const workout = assembleGarminWorkout({
    id: "w1",
    title: "Saturday MP",
    workoutType: "LongRun",
    segments: [
      {
        id: "s1",
        workoutId: "w1",
        stepOrder: 1,
        title: "Work",
        durationType: "DISTANCE",
        durationValue: 5,
        paceTargetEncodingVersion: 2,
        targets: [{ type: "PACE", valueLow: fast, valueHigh: slow }],
      },
    ],
  });

  assert.equal(workout.workoutName, "Saturday MP");
  const step = workout.steps[0]!;
  assert.equal(step.targetType, GarminTargetType.SPEED);
  assert.equal(step.targetValueHigh, expectedSpeedMps(fast));
  assert.equal(step.targetValueLow, expectedSpeedMps(slow));
  const paddedFast = secondsPerMileToStoredPaceSecKm(parsePaceToSecondsPerMile("6:40"));
  const paddedSlow = secondsPerMileToStoredPaceSecKm(parsePaceToSecondsPerMile("7:10"));
  assert.notEqual(step.targetValueHigh, expectedSpeedMps(paddedFast));
  assert.notEqual(step.targetValueLow, expectedSpeedMps(paddedSlow));
});
