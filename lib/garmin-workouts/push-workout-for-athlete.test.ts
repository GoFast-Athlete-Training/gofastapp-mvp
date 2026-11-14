import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GarminApiError } from "@/lib/garmin-workouts/garmin-training-api";
import { assembleGarminWorkout } from "@/lib/garmin-workouts/garmin-training-service";
import { upsertAndScheduleGarminWorkout } from "@/lib/garmin-workouts/push-workout-for-athlete";
import {
  parsePaceToSecondsPerMile,
  secondsPerMileToStoredPaceSecKm,
} from "@/lib/workout-generator/pace-calculator";

function saturdayPayload() {
  const fast = secondsPerMileToStoredPaceSecKm(parsePaceToSecondsPerMile("6:50"));
  const slow = secondsPerMileToStoredPaceSecKm(parsePaceToSecondsPerMile("7:00"));
  return assembleGarminWorkout({
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
}

test("workout create does not push to Garmin", () => {
  const src = readFileSync(new URL("../../app/api/workouts/route.ts", import.meta.url), "utf8");
  assert.equal(src.includes("pushWorkoutToGarminForAthlete"), false);
  assert.equal(src.includes("garminPush: null"), true);
});

test("first send creates the saved title and a 400 does not count as pushed", async () => {
  const payload = saturdayPayload();
  let remembered: number | null = null;
  let stamped = false;
  const created = await upsertAndScheduleGarminWorkout({
    client: {
      createWorkout: async (workout) => {
        assert.equal(workout.workoutName, "Saturday MP");
        assert.equal(/\(Updated\)/i.test(workout.workoutName), false);
        return { workoutId: 42 };
      },
      updateWorkout: async () => {
        throw new Error("first send should create");
      },
      scheduleWorkout: async (workoutId) => {
        assert.equal(workoutId, 42);
        return { scheduleId: 7 };
      },
      getSchedule: async () => ({ workoutId: 42 }),
      deleteSchedule: async () => {
        throw new Error("first send has no schedule to delete");
      },
    },
    payload,
    existingGarminWorkoutId: null,
    existingGarminScheduleId: null,
    scheduledDate: "2026-11-14",
    rememberWorkoutId: async (garminWorkoutId) => {
      remembered = garminWorkoutId;
    },
  });
  if (created.ok) stamped = true;
  assert.equal(created.ok, true);
  if (created.ok) {
    assert.equal(created.garminWorkoutId, 42);
    assert.equal(created.isUpdatedResend, false);
    assert.equal(created.garminScheduleId, 7);
  }
  assert.equal(remembered, 42);
  assert.equal(stamped, true);

  stamped = false;
  const failed = await upsertAndScheduleGarminWorkout({
    client: {
      createWorkout: async () => {
        throw new GarminApiError({
          status: 400,
          url: "https://apis.garmin.com/training-api/workout",
          details: "Secondary target valid for CYCLING and Swimming sport only",
        });
      },
      updateWorkout: async () => {
        throw new Error("failed create should not update");
      },
      scheduleWorkout: async () => {
        throw new Error("failed create should not schedule");
      },
      getSchedule: async () => ({ workoutId: 0 }),
      deleteSchedule: async () => {},
    },
    payload,
    existingGarminWorkoutId: null,
    existingGarminScheduleId: null,
    scheduledDate: "2026-11-14",
    rememberWorkoutId: async () => {
      throw new Error("failed create should not remember an id");
    },
  });
  if (failed.ok) stamped = true;
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.garminStatus, 400);
  assert.equal(stamped, false);
});

test("a resend updates the same Garmin workout and keeps the saved title", async () => {
  const payload = saturdayPayload();
  let created = 0;
  let updatedId = 0;
  let deletedSchedule = 0;
  const result = await upsertAndScheduleGarminWorkout({
    client: {
      createWorkout: async () => {
        created += 1;
        return { workoutId: 99 };
      },
      updateWorkout: async (workoutId, workout) => {
        updatedId = workoutId;
        assert.equal(workout.workoutName, "Saturday MP");
        assert.equal(/\(Updated\)/i.test(workout.workoutName), false);
      },
      deleteSchedule: async (scheduleId) => {
        deletedSchedule = scheduleId;
      },
      scheduleWorkout: async (workoutId) => {
        assert.equal(workoutId, 42);
        return { scheduleId: 11 };
      },
      getSchedule: async () => ({ workoutId: 42 }),
    },
    payload,
    existingGarminWorkoutId: 42,
    existingGarminScheduleId: 9,
    scheduledDate: "2026-11-14",
    rememberWorkoutId: async () => {
      throw new Error("resend already has an id");
    },
  });
  assert.equal(created, 0);
  assert.equal(updatedId, 42);
  assert.equal(deletedSchedule, 9);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.garminWorkoutId, 42);
    assert.equal(result.isUpdatedResend, true);
    assert.equal(result.garminScheduleId, 11);
  }
});
