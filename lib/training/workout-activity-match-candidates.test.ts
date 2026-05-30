import assert from "node:assert/strict";
import test from "node:test";
import {
  isHighConfidenceActivityCandidate,
  scoreActivityCandidateForWorkout,
  scoreAndSortActivityCandidates,
} from "./workout-activity-match-candidates";

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

test("scoreActivityCandidateForWorkout detects title match and same day", () => {
  const scored = scoreActivityCandidateForWorkout({
    workout: baseWorkout,
    activity: baseActivity(),
  });
  assert.ok(scored);
  assert.ok(scored!.reasonLabels.includes("Title match"));
  assert.ok(scored!.reasonLabels.includes("Same day"));
  assert.ok(scored!.reasonLabels.includes("Distance close"));
});

test("scoreActivityCandidateForWorkout excludes activities more than one day away", () => {
  const scored = scoreActivityCandidateForWorkout({
    workout: baseWorkout,
    activity: baseActivity({
      startTime: new Date("2026-05-25T14:00:00.000Z"),
      activityName: "Random run",
    }),
  });
  assert.equal(scored, null);
});

test("scoreAndSortActivityCandidates ranks title match above same-day only", () => {
  const sorted = scoreAndSortActivityCandidates({
    workout: baseWorkout,
    activities: [
      baseActivity({
        id: "same-day-only",
        activityName: "Morning jog",
        distance: 5000,
      }),
      baseActivity({
        id: "title-match",
        activityName: "Arlington County - GF W1: Long run 12.3 miles",
      }),
    ],
  });
  assert.equal(sorted[0]?.id, "title-match");
  assert.ok(sorted[0]!.score > sorted[1]!.score);
});

test("tiny same-day activity is not a high-confidence match for long planned workout", () => {
  const longRunWorkout = {
    id: "w-long",
    title: "Long run 10.5 miles",
    weekNumber: 1,
    date: new Date("2026-05-23T12:00:00.000Z"),
    estimatedDistanceInMeters: 10.5 * 1609.34,
  };
  const tinyRun = baseActivity({
    id: "tiny-run",
    activityName: "Arlington County Run",
    distance: 0.3 * 1609.34,
    startTime: new Date("2026-05-23T08:00:00.000Z"),
  });
  const scored = scoreActivityCandidateForWorkout({
    workout: longRunWorkout,
    activity: tinyRun,
  });
  assert.ok(scored);
  assert.ok(scored!.reasonLabels.includes("Same day"));
  assert.ok(scored!.reasonLabels.includes("Distance far off"));
  assert.equal(isHighConfidenceActivityCandidate(scored!), false);
});

test("distance-close same-day activity can be high-confidence without title match", () => {
  const longRunWorkout = {
    id: "w-long",
    title: "Long run 10.5 miles",
    weekNumber: 1,
    date: new Date("2026-05-23T12:00:00.000Z"),
    estimatedDistanceInMeters: 10.5 * 1609.34,
  };
  const closeRun = baseActivity({
    id: "close-run",
    activityName: "Morning long run",
    distance: 10.4 * 1609.34,
    startTime: new Date("2026-05-23T08:00:00.000Z"),
  });
  const scored = scoreActivityCandidateForWorkout({
    workout: longRunWorkout,
    activity: closeRun,
  });
  assert.ok(scored);
  assert.equal(isHighConfidenceActivityCandidate(scored!), true);
});
