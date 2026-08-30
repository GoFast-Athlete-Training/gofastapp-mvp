import assert from "node:assert/strict";
import test from "node:test";
import {
  computeWorkoutPerformanceAnalysis,
  type PerformanceAnalysisWorkoutInput,
} from "./workout-performance-analysis";
import { derivePaceForPaceStatus } from "./pace-for-pace-status";
import {
  expandPlannedToLapPrescriptions,
  translatePlannedOntoWorkout,
} from "./workout-pace-analyzer";

test("expands 4x400 compact row into work + recovery prescriptions", () => {
  const expanded = expandPlannedToLapPrescriptions([
    {
      id: "warm",
      stepOrder: 1,
      title: "Warmup",
      targets: null,
      paceTargetEncodingVersion: 2,
      repeatCount: null,
      recoveryDurationType: null,
      recoveryDurationValue: null,
    },
    {
      id: "int",
      stepOrder: 2,
      title: "Interval",
      targets: [{ type: "PACE", valueLow: 300, valueHigh: 320 }],
      paceTargetEncodingVersion: 2,
      repeatCount: 4,
      recoveryDurationType: "DISTANCE",
      recoveryDurationValue: 0.12,
    },
  ]);
  assert.equal(expanded.filter((e) => e.kind === "work").length, 4);
  assert.equal(expanded.filter((e) => e.kind === "open").length, 4);
});

test("writes lap deltas from prescribed band midpoint", () => {
  const aimed = translatePlannedOntoWorkout({
    plannedSegments: [
      {
        id: "work",
        stepOrder: 1,
        title: "Tempo",
        targets: [{ type: "PACE", valueLow: 300, valueHigh: 320 }],
        paceTargetEncodingVersion: 2,
        repeatCount: null,
        recoveryDurationType: null,
        recoveryDurationValue: null,
      },
    ],
    workoutLaps: [
      {
        id: "lap1",
        lapIndex: 0,
        segmentId: "seg1",
        segmentTitle: "Tempo",
        segmentStepOrder: 1,
        avgPaceSecPerMile: 400,
      },
    ],
  });
  assert.equal(typeof aimed[0]?.prescribedPaceMinSecPerMile, "number");
  assert.equal(typeof aimed[0]?.paceDeltaSecPerMile, "number");
});

test("does not treat whole-run paceDelta or slogans as splits available", () => {
  const baseWorkout: PerformanceAnalysisWorkoutInput = {
    workoutType: "LongRun",
    targetPaceSecPerMile: 480,
    targetPaceSecPerMileHigh: 500,
    paceDeltaSecPerMile: 3,
    actualAvgPaceSecPerMile: 477,
    matchedActivityId: "act-1",
    segments: [
      {
        id: "seg1",
        title: "Long Run",
        stepOrder: 1,
        targets: [{ type: "PACE", valueLow: 300, valueHigh: 320 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: 477,
        actualDurationSeconds: 3600,
        actualDistanceMiles: 10,
        segment_laps: [
          {
            lapIndex: 0,
            avgPaceSecPerMile: 477,
            paceDeltaSecPerMile: null,
          },
        ],
      },
    ],
  };
  const analysis = computeWorkoutPerformanceAnalysis(baseWorkout);
  assert.equal(analysis.executionHeadline, null);
  const status = derivePaceForPaceStatus(baseWorkout, analysis);
  assert.notEqual(status.status, "PACE_FOR_PACE_AVAILABLE");
  assert.doesNotMatch(status.message ?? "", /faster than prescribed/i);
});

test("treats lap pace deltas as splits available", () => {
  const withDeltas: PerformanceAnalysisWorkoutInput = {
    workoutType: "LongRun",
    targetPaceSecPerMile: 480,
    targetPaceSecPerMileHigh: 500,
    paceDeltaSecPerMile: null,
    actualAvgPaceSecPerMile: 477,
    matchedActivityId: "act-1",
    segments: [
      {
        id: "seg1",
        title: "Long Run",
        stepOrder: 1,
        targets: [{ type: "PACE", valueLow: 300, valueHigh: 320 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: 477,
        actualDurationSeconds: 3600,
        actualDistanceMiles: 10,
        segment_laps: [
          {
            lapIndex: 0,
            avgPaceSecPerMile: 477,
            paceDeltaSecPerMile: 5,
            prescribedPaceMinSecPerMile: 480,
            prescribedPaceMaxSecPerMile: 500,
          },
        ],
      },
    ],
  };
  const analysis = computeWorkoutPerformanceAnalysis(withDeltas);
  const status = derivePaceForPaceStatus(withDeltas, analysis);
  assert.equal(status.status, "PACE_FOR_PACE_AVAILABLE");
  assert.equal(analysis.phaseAwareLaps[0]?.paceDeltaSecPerMile, 5);
});

test("MP multi-block stays on segment path without whole-run headline", () => {
  const mpWorkout: PerformanceAnalysisWorkoutInput = {
    workoutType: "LongRun",
    targetPaceSecPerMile: 480,
    targetPaceSecPerMileHigh: 500,
    paceDeltaSecPerMile: 10,
    actualAvgPaceSecPerMile: 470,
    matchedActivityId: "act-mp",
    segments: [
      {
        id: "w",
        title: "Warmup",
        stepOrder: 1,
        targets: null,
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: 520,
        actualDurationSeconds: 600,
        actualDistanceMiles: 1.5,
        segment_laps: [{ lapIndex: 0, avgPaceSecPerMile: 520 }],
      },
      {
        id: "mp",
        title: "Marathon Pace",
        stepOrder: 2,
        targets: [{ type: "PACE", valueLow: 280, valueHigh: 290 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: 470,
        actualDurationSeconds: 2400,
        actualDistanceMiles: 6,
        segment_laps: [
          {
            lapIndex: 1,
            avgPaceSecPerMile: 470,
            paceDeltaSecPerMile: 8,
            prescribedPaceMinSecPerMile: 475,
            prescribedPaceMaxSecPerMile: 485,
          },
        ],
      },
    ],
  };
  const analysis = computeWorkoutPerformanceAnalysis(mpWorkout);
  assert.equal(analysis.executionHeadline, null);
  assert.equal(derivePaceForPaceStatus(mpWorkout, analysis).status, "PACE_FOR_PACE_AVAILABLE");
});
