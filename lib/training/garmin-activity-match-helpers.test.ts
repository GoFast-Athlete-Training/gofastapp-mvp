import assert from "node:assert/strict";
import test from "node:test";
import {
  activityLocalYmdFromSummary,
  activityMatchCandidateUtcRange,
  activityNameContainsPushedWorkoutTitle,
  garminPushTitleForPlannedWorkout,
  workoutTitleMatchVariants,
  garminTitleForWorkout,
  normalizeActivityNameForMatch,
} from "./garmin-activity-match-helpers";

test("workoutTitleMatchVariants includes (Updated) pushed title for edit-after-push matching", () => {
  const variants = workoutTitleMatchVariants({
    workoutTitle: "Friday Easy",
    weekNumber: 5,
    workoutType: "Easy",
    dayAssigned: "Friday",
    planId: "plan-1",
    catalogueName: "Easy",
  });
  assert.ok(variants.includes("GF W5: Easy (Fri)"));
  assert.ok(variants.includes("(Updated) GF W5: Easy (Fri)"));
});

test("activityNameContainsPushedWorkoutTitle matches (Updated) re-send title", () => {
  assert.equal(
    activityNameContainsPushedWorkoutTitle({
      activityName: "Falmouth - (Updated) GF W5: Easy (Fri)",
      workoutTitle: "Friday Easy",
      weekNumber: 5,
      workoutType: "Easy",
      dayAssigned: "Friday",
      planId: "plan-1",
      catalogueName: "Easy",
    }),
    true
  );
});

test("garminPushTitleForPlannedWorkout prefers catalogue over generic stored title", () => {
  assert.equal(
    garminPushTitleForPlannedWorkout({
      title: "Tuesday Tempo work 6 miles",
      weekNumber: 9,
      dayAssigned: "Tuesday",
      catalogueName: "2-1 Tempo",
      planId: "plan-1",
      workoutType: "Tempo",
      estimatedDistanceInMeters: 6 * 1609.34,
    }),
    "GF W9: 2-1 Tempo (Tue)"
  );
});

test("garminPushTitleForPlannedWorkout cleans generic stored title without catalogue", () => {
  assert.equal(
    garminPushTitleForPlannedWorkout({
      title: "Friday Easy 6 miles",
      weekNumber: 9,
      dayAssigned: "Friday",
      planId: "plan-1",
      workoutType: "Easy",
      estimatedDistanceInMeters: 6 * 1609.34,
    }),
    "GF W9: Easy 6 miles (Fri)"
  );
});

test("garminPushTitleForPlannedWorkout uses catalogue name and short weekday", () => {
  assert.equal(
    garminPushTitleForPlannedWorkout({
      title: "2-1 Tempo",
      weekNumber: 7,
      dayAssigned: "Tuesday",
      catalogueName: "2-1 Tempo",
      planId: "plan-1",
      workoutType: "Tempo",
    }),
    "GF W7: 2-1 Tempo (Tue)"
  );
});

test("normalizeActivityNameForMatch strips weekday marker from pushed title", () => {
  assert.equal(
    normalizeActivityNameForMatch("GF W7: 2-1 Tempo (Tue)"),
    "2-1 tempo"
  );
});

test("activityNameContainsPushedWorkoutTitle matches new weekday-suffixed push title", () => {
  assert.equal(
    activityNameContainsPushedWorkoutTitle({
      activityName: "Falmouth - GF W7: 2-1 Tempo (Tue)",
      workoutTitle: "2-1 Tempo",
      weekNumber: 7,
      workoutType: "Tempo",
      dayAssigned: "Tuesday",
      planId: "plan-1",
      catalogueName: "2-1 Tempo",
    }),
    true
  );
});

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

test("activityNameContainsPushedWorkoutTitle matches en-dash catalogue against hyphen activity", () => {
  assert.equal(
    activityNameContainsPushedWorkoutTitle({
      activityName: "Bloomington - GF W14: 2-1 Tempo (Tue)",
      workoutTitle: "2–1 Tempo",
      weekNumber: 14,
      workoutType: "Tempo",
      dayAssigned: "Tuesday",
      planId: "plan-1",
      catalogueName: "2–1 Tempo",
    }),
    true
  );
});

test("activityNameContainsPushedWorkoutTitle matches pushed catalogue long-run title", () => {
  assert.equal(
    activityNameContainsPushedWorkoutTitle({
      activityName: "Arlington County - GF W13: Long Run (Sat)",
      workoutTitle: "Saturday Long run 19.6 miles",
      weekNumber: 13,
      workoutType: "LongRun",
      dayAssigned: "Saturday",
      planId: "plan-1",
      catalogueName: "Long Run",
      estimatedDistanceInMeters: 19.6 * 1609.34,
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
