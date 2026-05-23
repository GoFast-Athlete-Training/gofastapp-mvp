import assert from "node:assert/strict";
import test from "node:test";
import {
  activityLocalYmdFromSummary,
  activityNameContainsPushedWorkoutTitle,
  garminTitleForWorkout,
} from "./garmin-activity-match-helpers";

test("garminTitleForWorkout prefixes unlabelled plan workouts with GF week", () => {
  assert.equal(
    garminTitleForWorkout({ title: "Long run 12.3 miles", weekNumber: 1 }),
    "GF W1: Long run 12.3 miles"
  );
});

test("activityNameContainsPushedWorkoutTitle matches Garmin location-prefixed names", () => {
  assert.equal(
    activityNameContainsPushedWorkoutTitle({
      activityName: "Arlington County - GF W1: Long run 12.3 miles",
      workoutTitle: "Long run 12.3 miles",
      weekNumber: 1,
    }),
    true
  );
});

test("activityLocalYmdFromSummary uses Garmin local offset when present", () => {
  assert.equal(
    activityLocalYmdFromSummary(new Date("2026-05-23T02:00:00.000Z"), {
      startTimeInSeconds: Date.parse("2026-05-23T02:00:00.000Z") / 1000,
      startTimeOffsetInSeconds: -14400,
    }),
    "2026-05-22"
  );
});
