import assert from "node:assert/strict";
import test from "node:test";
import {
  activityLocalYmdFromSummary,
  activityMatchCandidateUtcRange,
  activityNameContainsPushedWorkoutTitle,
  garminTitleForWorkout,
  normalizeActivityNameForMatch,
} from "./garmin-activity-match-helpers";

test("garminTitleForWorkout prefixes unlabelled plan workouts with GF week", () => {
  assert.equal(
    garminTitleForWorkout({ title: "Long run 12.3 miles", weekNumber: 1 }),
    "GF W1: Long run 12.3 miles"
  );
  assert.equal(
    garminTitleForWorkout({ title: "Tuesday Tempo", weekNumber: 6 }),
    "GF W6: Tuesday Tempo"
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

test("activityNameContainsPushedWorkoutTitle matches despite extra spaces and casing", () => {
  assert.equal(
    activityNameContainsPushedWorkoutTitle({
      activityName: "Arlington County -  GF  W1:  LONG RUN 12.3 MILES",
      workoutTitle: "Long run 12.3 miles",
      weekNumber: 1,
    }),
    true
  );
});

test("activityNameContainsPushedWorkoutTitle matches when workout title already has GF prefix", () => {
  assert.equal(
    activityNameContainsPushedWorkoutTitle({
      activityName: "GF W2: Tempo Work - 6 Miles",
      workoutTitle: "GF W2: Tempo Work - 6 Miles",
      weekNumber: 2,
    }),
    true
  );
});

test("activityNameContainsPushedWorkoutTitle matches canonical day/type alias", () => {
  assert.equal(
    activityNameContainsPushedWorkoutTitle({
      activityName: "Falmouth - GF W6: Tuesday Tempo",
      workoutTitle: "2-1 Tempo",
      weekNumber: 6,
      workoutType: "Tempo",
      dayAssigned: "Tuesday",
      planId: "plan-1",
    }),
    true
  );
});

test("activityNameContainsPushedWorkoutTitle matches stored catalogue title on activity", () => {
  assert.equal(
    activityNameContainsPushedWorkoutTitle({
      activityName: "Falmouth - GF W6: 2-1 Tempo",
      workoutTitle: "2-1 Tempo",
      weekNumber: 6,
      workoutType: "Tempo",
      dayAssigned: "Tuesday",
      planId: "plan-1",
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

test("activityMatchCandidateUtcRange spans three UTC days around activity local date", () => {
  const range = activityMatchCandidateUtcRange("2026-06-17");
  assert.equal(range.start.toISOString(), "2026-06-16T00:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-06-19T00:00:00.000Z");
});
