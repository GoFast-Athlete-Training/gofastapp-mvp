import assert from "node:assert/strict";
import test from "node:test";
import {
  canAutoMatchPlannedWorkout,
  isManualMatchOnlyWorkout,
  selectPlannedWorkoutCandidate,
} from "./match-activity-to-workout";
import { scoreActivityCandidateForWorkout } from "./workout-activity-match-candidates";
import { activityMatchCandidateUtcRange } from "./garmin-activity-match-helpers";
import { isPlausiblePlannedWorkoutNearby } from "./promote-activity-to-workout";

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

const tempoWorkout = {
  id: "w-tempo",
  title: "2-1 Tempo",
  weekNumber: 6,
  date: new Date("2026-06-17T12:00:00.000Z"),
  estimatedDistanceInMeters: 6 * 1609.34,
  workoutType: "Tempo",
  dayAssigned: "Tuesday",
  planId: "plan-1",
  garminWorkoutId: null,
  matchedActivityId: null,
  athleteId: "athlete-1",
  segments: [],
  workout_catalogue: null,
};

function tempoActivity(overrides: Record<string, unknown> = {}) {
  return baseActivity({
    activityName: "Falmouth - GF W6: 2-1 Tempo",
    startTime: new Date("2026-06-17T14:00:00.000Z"),
    distance: 6 * 1609.34,
    ...overrides,
  });
}

test("selectPlannedWorkoutCandidate picks Falmouth tempo by stored catalogue title", () => {
  const result = selectPlannedWorkoutCandidate({
    planCandidates: [tempoWorkout as never],
    activity: tempoActivity(),
  });
  assert.ok(result.candidate);
  assert.equal(result.candidate!.id, "w-tempo");
  assert.equal(result.titleMatchCount, 1);
  assert.ok(result.scored?.reasonLabels.includes("Title match"));
});

test("selectPlannedWorkoutCandidate picks Falmouth tempo by canonical Tuesday Tempo alias", () => {
  const result = selectPlannedWorkoutCandidate({
    planCandidates: [tempoWorkout as never],
    activity: tempoActivity({
      activityName: "Falmouth - GF W6: Tuesday Tempo",
    }),
  });
  assert.ok(result.candidate);
  assert.equal(result.candidate!.id, "w-tempo");
  assert.equal(result.titleMatchCount, 1);
});

test("selectPlannedWorkoutCandidate auto-match eligible for Falmouth tempo title match", () => {
  const result = selectPlannedWorkoutCandidate({
    planCandidates: [tempoWorkout as never],
    activity: tempoActivity(),
  });
  assert.ok(result.scored);
  assert.equal(
    canAutoMatchPlannedWorkout({
      scored: result.scored,
      titleMatchCount: result.titleMatchCount,
    }),
    true
  );
});

test("activityMatchCandidateUtcRange spans three UTC days around activity local date", () => {
  const range = activityMatchCandidateUtcRange("2026-06-17");
  assert.equal(range.start.toISOString(), "2026-06-16T00:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-06-19T00:00:00.000Z");
});

test("isPlausiblePlannedWorkoutNearby blocks promotion for same-day planned candidate", () => {
  const scored = scoreActivityCandidateForWorkout({
    workout: tempoWorkout,
    activity: tempoActivity({ activityName: "Morning jog" }),
  });
  assert.ok(scored);
  assert.equal(isPlausiblePlannedWorkoutNearby({ scored }), true);
});
