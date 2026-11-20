import assert from "node:assert/strict";
import test from "node:test";
import { plannedWorkoutSnapshot, segmentPaceLabel } from "./company-plan-planned-workout";

test("plannedWorkoutSnapshot reads like a text", () => {
  assert.equal(
    plannedWorkoutSnapshot({
      dayKey: "2026-11-20",
      todayKey: "2026-11-20",
      miles: 5.3,
      pace: "9:32",
      fiveKPace: "8:42",
    }),
    "Today you have 5.3 miles at 9:32/mi based on your 8:42 5K.",
  );
});

test("segmentPaceLabel collapses an equal band", () => {
  assert.equal(
    segmentPaceLabel({
      paceLowMin: "9",
      paceLowSec: "32",
      paceHighMin: "9",
      paceHighSec: "32",
    }),
    "9:32",
  );
});
