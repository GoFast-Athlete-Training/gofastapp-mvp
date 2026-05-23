import assert from "node:assert/strict";
import test from "node:test";
import {
  activityLocalYmdFromSummary,
  activityNameContainsPushedWorkoutTitle,
  garminTitleForWorkout,
  normalizeActivityNameForMatch,
} from "./garmin-activity-match-helpers";

test("garminTitleForWorkout prefixes unlabelled plan workouts with GF week", () => {
  assert.equal(
    garminTitleForWorkout({ title: "Long run 12.3 miles", weekNumber: 1 }),
    "GF W1: Long run 12.3 miles"
  );
});

test("normalizeActivityNameForMatch strips location and GF week prefix", () => {
  assert.equal(
    normalizeActivityNameForMatch("Arlington County - GF W1: Long run 12.3 miles"),
    "long run 12.3 miles"
  );
});

test("activityNameContainsPushedWorkoutTitle matches core title after normalization", () => {
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
