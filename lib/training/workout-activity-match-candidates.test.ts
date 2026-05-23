import assert from "node:assert/strict";
import test from "node:test";
import {
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
