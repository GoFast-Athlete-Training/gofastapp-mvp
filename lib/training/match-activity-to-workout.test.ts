import assert from "node:assert/strict";
import test from "node:test";
import {
  canAutoMatchPlannedWorkout,
  isManualMatchOnlyWorkout,
} from "./match-activity-to-workout";
import { scoreActivityCandidateForWorkout } from "./workout-activity-match-candidates";

test("isManualMatchOnlyWorkout is true for plan-linked workouts", () => {
  assert.equal(isManualMatchOnlyWorkout({ planId: "plan-1" }), true);
});

test("isManualMatchOnlyWorkout is false for standalone pushed workouts", () => {
  assert.equal(isManualMatchOnlyWorkout({ planId: null }), false);
});

const baseWorkout = {
  id: "w1",
  title: "Long run 12.3 miles",
  weekNumber: 1,
  date: new Date("2026-05-23T12:00:00.000Z"),
  estimatedDistanceInMeters: 12.3 * 1609.34,
};

function baseActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    activityName: "Arlington County - GF W1: Long run 12.3 miles",
    activityType: "RUNNING",
    startTime: new Date("2026-05-23T14:00:00.000Z"),
    duration: 5400,
    distance: 12.3 * 1609.34,
    averageSpeed: 3.5,
    ingestionStatus: "UNMATCHED",
    summaryData: null,
    matchedWorkoutId: null,
    matchedWorkoutTitle: null,
    ...overrides,
  };
}

test("canAutoMatchPlannedWorkout allows single title-match high-confidence candidate", () => {
  const scored = scoreActivityCandidateForWorkout({
    workout: baseWorkout,
    activity: baseActivity(),
  });
  assert.ok(scored);
  assert.equal(canAutoMatchPlannedWorkout({ scored, titleMatchCount: 1 }), true);
});

test("canAutoMatchPlannedWorkout rejects ambiguous title matches", () => {
  const scored = scoreActivityCandidateForWorkout({
    workout: baseWorkout,
    activity: baseActivity(),
  });
  assert.ok(scored);
  assert.equal(canAutoMatchPlannedWorkout({ scored, titleMatchCount: 2 }), false);
});

test("canAutoMatchPlannedWorkout rejects same-day tiny run for long workout", () => {
  const scored = scoreActivityCandidateForWorkout({
    workout: baseWorkout,
    activity: baseActivity({
      activityName: "Arlington County Run",
      distance: 0.3 * 1609.34,
    }),
  });
  assert.ok(scored);
  assert.equal(canAutoMatchPlannedWorkout({ scored, titleMatchCount: 0 }), false);
});
