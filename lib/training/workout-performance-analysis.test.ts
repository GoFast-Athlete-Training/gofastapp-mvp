import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPhaseAwareLapRows,
  buildWorkSegmentDeltas,
  classifySegmentPhase,
  computeWorkSegmentActual,
  computeWorkoutPerformanceAnalysis,
  countWorkRepsOnTarget,
  formatCompletionOnlyMessage,
  formatAlignmentFailedMessage,
  isWorkSegmentTitle,
  requiresDetailForTargetAnalysis,
  resolveTargetComparisonPace,
  structuredSegmentLapsAligned,
} from "./workout-performance-analysis";

test("isWorkSegmentTitle excludes recovery and bookends", () => {
  assert.equal(isWorkSegmentTitle("600m"), true);
  assert.equal(isWorkSegmentTitle("Recovery"), false);
  assert.equal(isWorkSegmentTitle("Warmup"), false);
  assert.equal(isWorkSegmentTitle("Cooldown"), false);
});

test("classifySegmentPhase maps warmup work recovery cooldown", () => {
  assert.equal(classifySegmentPhase("Warmup"), "warmup");
  assert.equal(classifySegmentPhase("600m"), "work");
  assert.equal(classifySegmentPhase("Recovery jog"), "recovery");
  assert.equal(classifySegmentPhase("Cooldown"), "cooldown");
});

test("interval workout without detail is completion_only", () => {
  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "Intervals",
    targetPaceSecPerMile: 420,
    targetPaceSecPerMileHigh: 430,
    paceDeltaSecPerMile: -20,
    actualAvgPaceSecPerMile: 450,
    actualDistanceMeters: 10000,
    actualDurationSeconds: 2880,
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

  assert.equal(analysis.analysisMode, "completion_only");
  assert.equal(analysis.canJudgeTargetPace, false);
  assert.equal(requiresDetailForTargetAnalysis("Intervals"), true);
  assert.match(analysis.completionOnlyMessage ?? "", /Nice work/);
  assert.match(analysis.completionOnlyMessage ?? "", /6\.21 mi/);
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
      segment_laps: [{ lapIndex: 0, avgPaceSecPerMile: 540 }],
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
      segment_laps: [{ lapIndex: 0, avgPaceSecPerMile: 400 }],
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
      segment_laps: [{ lapIndex: 0, avgPaceSecPerMile: 720 }],
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
  assert.equal(analysis.executionHeadline, "1 of 1 work reps on target");
  assert.equal(analysis.scorecard.workEffort?.summary, "1 of 1 reps on target · 0.4 of 0.4 work mi on target");
  assert.equal(analysis.scorecard.workSegmentDeltas.length, 1);
  assert.notEqual(analysis.scorecard.workSegmentDeltas[0]!.deltaDisplay, "—");

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

test("interval with detail but misaligned laps is completion_only", () => {
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
      segment_laps: [
        { lapIndex: 0, avgPaceSecPerMile: 540 },
        { lapIndex: 1, avgPaceSecPerMile: 530 },
      ],
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
      segment_laps: [{ lapIndex: 0, avgPaceSecPerMile: 400 }],
    },
  ];

  assert.equal(structuredSegmentLapsAligned(segments), false);

  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "Intervals",
    targetPaceSecPerMile: 420,
    targetPaceSecPerMileHigh: 430,
    paceDeltaSecPerMile: -30,
    actualAvgPaceSecPerMile: 520,
    actualDistanceMeters: 10000,
    actualDurationSeconds: 2880,
    completedActivityDetailJson: { laps: [] },
    matchedActivityId: "act1",
    matched_activity: { detailData: { laps: [] }, hydratedAt: new Date() },
    segments,
  });

  assert.equal(analysis.analysisMode, "completion_only");
  assert.equal(analysis.canJudgeTargetPace, false);
  assert.equal(analysis.phaseAwareLaps.length, 0);
  assert.equal(analysis.workSegmentActual, null);
});

test("interval with detail and alignment failure shows explicit completion message", () => {
  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "Intervals",
    targetPaceSecPerMile: 420,
    targetPaceSecPerMileHigh: 430,
    paceDeltaSecPerMile: -30,
    actualAvgPaceSecPerMile: 520,
    actualDistanceMeters: 10000,
    actualDurationSeconds: 2880,
    completedActivityDetailJson: { laps: [{ startTimeInSeconds: 1 }] },
    matchedActivityId: "act1",
    matched_activity: { detailData: { laps: [] }, hydratedAt: new Date() },
    segmentExecutionStatus: "ALIGNMENT_FAILED",
    segmentExecutionLapCount: 8,
    segmentExecutionSegmentCount: 12,
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
    ],
  });

  assert.equal(analysis.analysisMode, "completion_only");
  assert.match(analysis.completionOnlyMessage ?? "", /Garmin detail is available/);
  assert.match(analysis.completionOnlyMessage ?? "", /8/);
  assert.match(analysis.completionOnlyMessage ?? "", /12/);
});

test("formatAlignmentFailedMessage includes lap and segment counts", () => {
  const msg = formatAlignmentFailedMessage({
    lapCount: 8,
    segmentCount: 12,
    actualDistanceMeters: 10000,
    actualDurationSeconds: 2880,
  });
  assert.match(msg, /activity laps \(8\)/);
  assert.match(msg, /planned steps \(12\)/);
});

test("recovery laps are labeled recovery not slower", () => {
  const rows = buildPhaseAwareLapRows({
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
        segment_laps: [{ lapIndex: 0, avgPaceSecPerMile: 540 }],
      },
      {
        id: "s2",
        title: "600m",
        stepOrder: 2,
        targets: [{ type: "PACE", valueLow: 260, valueHigh: 270 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: 400,
        actualDurationSeconds: null,
        actualDistanceMiles: null,
        segment_laps: [{ lapIndex: 0, avgPaceSecPerMile: 420 }],
      },
      {
        id: "s3",
        title: "Recovery",
        stepOrder: 3,
        targets: null,
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: 720,
        actualDurationSeconds: null,
        actualDistanceMiles: null,
        segment_laps: [{ lapIndex: 0, avgPaceSecPerMile: 720 }],
      },
    ],
    workoutTargetLow: 420,
    workoutTargetHigh: 430,
  });

  assert.equal(rows.length, 3);
  assert.equal(rows[0]!.vsPlanPaceLabel, "Warmup");
  assert.notEqual(rows[1]!.vsPlanPaceLabel, "Slower");
  assert.equal(rows[2]!.vsPlanPaceLabel, "Recovery");
});

test("countWorkRepsOnTarget ignores recovery segments", () => {
  const work = computeWorkSegmentActual(
    [
      {
        id: "s2",
        title: "600m",
        stepOrder: 2,
        targets: [{ type: "PACE", valueLow: 260, valueHigh: 270 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: 500,
        actualDurationSeconds: 120,
        actualDistanceMiles: 0.37,
        segment_laps: [{ lapIndex: 0 }],
      },
      {
        id: "s4",
        title: "600m",
        stepOrder: 4,
        targets: [{ type: "PACE", valueLow: 260, valueHigh: 270 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: 400,
        actualDurationSeconds: 120,
        actualDistanceMiles: 0.37,
        segment_laps: [{ lapIndex: 0 }],
      },
    ],
    420,
    430
  );

  const counts = countWorkRepsOnTarget(work);
  assert.deepEqual(counts, { onTarget: 1, total: 2 });
});

test("easy run with matched activity is completion_only without pace judgement", () => {
  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "Easy",
    targetPaceSecPerMile: 540,
    targetPaceSecPerMileHigh: null,
    paceDeltaSecPerMile: 10,
    actualAvgPaceSecPerMile: 530,
    actualDistanceMeters: 10000,
    actualDurationSeconds: 3000,
    completedActivityDetailJson: null,
    matchedActivityId: "act1",
    matched_activity: null,
    segments: [],
  });

  assert.equal(analysis.analysisMode, "completion_only");
  assert.equal(analysis.canJudgeTargetPace, false);
  assert.match(analysis.completionOnlyMessage ?? "", /Nice work/);

  const comparison = resolveTargetComparisonPace({
    analysis,
    workoutType: "Easy",
    actualAvgPaceSecPerMile: 530,
    paceDeltaSecPerMile: 10,
    targetPaceSecPerMile: 540,
    targetPaceSecPerMileHigh: null,
  });

  assert.equal(comparison.actualPaceSecPerMile, null);
});

test("scorecard exposes total miles and work segment deltas", () => {
  const work = computeWorkSegmentActual(
    [
      {
        id: "s2",
        title: "600m",
        stepOrder: 2,
        targets: [{ type: "PACE", valueLow: 260, valueHigh: 270 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: 500,
        actualDurationSeconds: 120,
        actualDistanceMiles: 0.37,
        segment_laps: [{ lapIndex: 0 }],
      },
    ],
    420,
    430
  );

  const deltas = buildWorkSegmentDeltas(work);
  assert.equal(deltas.length, 1);
  assert.match(deltas[0]!.deltaDisplay, /slower|faster|On target/);

  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "Intervals",
    targetPaceSecPerMile: 420,
    targetPaceSecPerMileHigh: 430,
    paceDeltaSecPerMile: -30,
    actualAvgPaceSecPerMile: 520,
    actualDistanceMeters: 10000,
    estimatedDistanceInMeters: 10000,
    completedActivityDetailJson: { laps: [] },
    matchedActivityId: "act1",
    matched_activity: { detailData: { laps: [] }, hydratedAt: new Date() },
    segments: [
      {
        id: "s2",
        title: "600m",
        stepOrder: 2,
        targets: [{ type: "PACE", valueLow: 260, valueHigh: 270 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: 500,
        actualDurationSeconds: 120,
        actualDistanceMiles: 0.37,
        segment_laps: [{ lapIndex: 0, avgPaceSecPerMile: 500 }],
      },
    ],
  });

  assert.ok(Math.abs((analysis.scorecard.totalMiles.actualMiles ?? 0) - 6.21) < 0.01);
  assert.equal(analysis.scorecard.totalMiles.status, "on_plan");
  assert.ok(analysis.scorecard.workEffort?.summary?.includes("reps on target"));
});

test("formatCompletionOnlyMessage builds distance and duration copy", () => {
  assert.equal(
    formatCompletionOnlyMessage({
      actualDistanceMeters: 10000,
      actualDurationSeconds: 2880,
    }),
    "Nice work — you completed 6.21 mi in 48 min."
  );
});
