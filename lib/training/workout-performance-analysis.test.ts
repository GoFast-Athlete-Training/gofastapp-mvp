import assert from "node:assert/strict";
import test from "node:test";
import {
  computeWorkSegmentActual,
  computeWorkoutPerformanceAnalysis,
  isWorkSegmentTitle,
  requiresDetailForTargetAnalysis,
  resolveTargetComparisonPace,
} from "./workout-performance-analysis";

test("isWorkSegmentTitle excludes recovery and bookends", () => {
  assert.equal(isWorkSegmentTitle("600m"), true);
  assert.equal(isWorkSegmentTitle("Recovery"), false);
  assert.equal(isWorkSegmentTitle("Warmup"), false);
  assert.equal(isWorkSegmentTitle("Cooldown"), false);
});

test("interval workout without detail is summary_pending_detail", () => {
  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "Intervals",
    targetPaceSecPerMile: 420,
    targetPaceSecPerMileHigh: 430,
    paceDeltaSecPerMile: -20,
    actualAvgPaceSecPerMile: 450,
    completedActivityDetailJson: null,
    matchedActivityId: "act1",
    matched_activity: { detailData: null, hydratedAt: null },
    segments: [
      {
        id: "s1",
        title: "Warmup",
        stepOrder: 1,
        targets: null,
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: null,
        actualDurationSeconds: null,
        actualDistanceMiles: null,
        segment_laps: [],
      },
      {
        id: "s2",
        title: "600m",
        stepOrder: 2,
        targets: [{ type: "PACE", valueLow: 260, valueHigh: 270 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: null,
        actualDurationSeconds: null,
        actualDistanceMiles: null,
        segment_laps: [],
      },
    ],
  });

  assert.equal(analysis.analysisMode, "summary_pending_detail");
  assert.equal(analysis.canJudgeTargetPace, false);
  assert.equal(requiresDetailForTargetAnalysis("Intervals"), true);
});

test("interval workout with work segment actuals uses rep pace not whole run", () => {
  const segments = [
    {
      id: "s1",
      title: "Warmup",
      stepOrder: 1,
      targets: null,
      paceTargetEncodingVersion: 2,
      actualPaceSecPerMile: 540,
      actualDurationSeconds: 600,
      actualDistanceMiles: 1.5,
      segment_laps: [{ id: "l1" }],
    },
    {
      id: "s2",
      title: "600m",
      stepOrder: 2,
      targets: [{ type: "PACE", valueLow: 260, valueHigh: 270 }],
      paceTargetEncodingVersion: 2,
      actualPaceSecPerMile: 400,
      actualDurationSeconds: 120,
      actualDistanceMiles: 0.37,
      segment_laps: [{ id: "l2" }],
    },
    {
      id: "s3",
      title: "Recovery",
      stepOrder: 3,
      targets: null,
      paceTargetEncodingVersion: 2,
      actualPaceSecPerMile: 720,
      actualDurationSeconds: 90,
      actualDistanceMiles: 0.1,
      segment_laps: [{ id: "l3" }],
    },
  ];

  const work = computeWorkSegmentActual(segments, 420, 430);
  assert.ok(work);
  assert.equal(work!.actualPaceSecPerMile, 400);
  assert.equal(work!.segments.length, 1);
  assert.equal(work!.segments[0]!.title, "600m");

  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "Intervals",
    targetPaceSecPerMile: 420,
    targetPaceSecPerMileHigh: 430,
    paceDeltaSecPerMile: -30,
    actualAvgPaceSecPerMile: 520,
    completedActivityDetailJson: { laps: [] },
    matchedActivityId: "act1",
    matched_activity: { detailData: { laps: [] }, hydratedAt: new Date() },
    segments,
  });

  assert.equal(analysis.analysisMode, "detail");
  assert.equal(analysis.canJudgeTargetPace, true);

  const comparison = resolveTargetComparisonPace({
    analysis,
    workoutType: "Intervals",
    actualAvgPaceSecPerMile: 520,
    paceDeltaSecPerMile: -30,
    targetPaceSecPerMile: 420,
    targetPaceSecPerMileHigh: 430,
  });

  assert.equal(comparison.actualPaceSecPerMile, 400);
  assert.notEqual(comparison.actualPaceSecPerMile, 520);
});

test("easy run can judge pace from summary whole-run average", () => {
  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "Easy",
    targetPaceSecPerMile: 540,
    targetPaceSecPerMileHigh: null,
    paceDeltaSecPerMile: 10,
    actualAvgPaceSecPerMile: 530,
    completedActivityDetailJson: null,
    matchedActivityId: "act1",
    matched_activity: null,
    segments: [],
  });

  assert.equal(analysis.analysisMode, "summary_only");
  assert.equal(analysis.canJudgeTargetPace, true);

  const comparison = resolveTargetComparisonPace({
    analysis,
    workoutType: "Easy",
    actualAvgPaceSecPerMile: 530,
    paceDeltaSecPerMile: 10,
    targetPaceSecPerMile: 540,
    targetPaceSecPerMileHigh: null,
  });

  assert.equal(comparison.actualPaceSecPerMile, 530);
});
