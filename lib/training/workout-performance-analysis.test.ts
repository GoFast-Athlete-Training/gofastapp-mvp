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
  structuredSegmentExecutionReady,
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
    garminDetailActivityId: "act1",
    garmin_detail_activity: { detailData: null, hydratedAt: null },
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
  assert.equal(analysis.requiresPaceForPaceAnalysis, true);
  assert.match(analysis.paceForPaceError ?? "", /Garmin activity detail is required/);
  assert.equal(analysis.scorecard.workEffort, null);
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
    garminDetailActivityId: "act1",
    garmin_detail_activity: { detailData: { laps: [] }, hydratedAt: new Date() },
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

test("interval with detail and work bolt surfaces detail despite non-1:1 warmup laps", () => {
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
  assert.equal(structuredSegmentExecutionReady({
    segments,
    segmentExecutionStatus: null,
    paceDeltaSecPerMile: -30,
  }), true);

  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "Intervals",
    targetPaceSecPerMile: 420,
    targetPaceSecPerMileHigh: 430,
    paceDeltaSecPerMile: -30,
    actualAvgPaceSecPerMile: 520,
    actualDistanceMeters: 10000,
    actualDurationSeconds: 2880,
    completedActivityDetailJson: { laps: [] },
    garminDetailActivityId: "act1",
    garmin_detail_activity: { detailData: { laps: [] }, hydratedAt: new Date() },
    segments,
  });

  assert.equal(analysis.analysisMode, "detail");
  assert.equal(analysis.canJudgeTargetPace, true);
  assert.ok(analysis.phaseAwareLaps.length > 0);
  assert.equal(analysis.lapSource, "step");
  assert.notEqual(analysis.workSegmentActual, null);
});

test("interval 400x8 with eight laps on one work segment surfaces detail analysis", () => {
  const workLaps = Array.from({ length: 8 }, (_, i) => ({
    lapIndex: i,
    avgPaceSecPerMile: 400 + i,
  }));

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
      title: "400m",
      stepOrder: 2,
      targets: [{ type: "PACE", valueLow: 260, valueHigh: 270 }],
      paceTargetEncodingVersion: 2,
      actualPaceSecPerMile: 403,
      actualDurationSeconds: 1920,
      actualDistanceMiles: 1.99,
      segment_laps: workLaps,
    },
  ];

  assert.equal(structuredSegmentLapsAligned(segments), false);
  assert.equal(
    structuredSegmentExecutionReady({
      segments,
      segmentExecutionStatus: "ALIGNED",
      paceDeltaSecPerMile: 17,
    }),
    true
  );

  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "Intervals",
    targetPaceSecPerMile: 420,
    targetPaceSecPerMileHigh: 430,
    paceDeltaSecPerMile: 17,
    actualAvgPaceSecPerMile: 520,
    actualDistanceMeters: 10000,
    actualDurationSeconds: 2880,
    completedActivityDetailJson: { laps: [] },
    garminDetailActivityId: "act1",
    garmin_detail_activity: { detailData: { laps: [] }, hydratedAt: new Date() },
    segmentExecutionStatus: "ALIGNED",
    segmentExecutionLapCount: 9,
    segmentExecutionSegmentCount: 2,
    segments,
  });

  assert.equal(analysis.analysisMode, "detail");
  assert.equal(analysis.canJudgeTargetPace, true);
  assert.ok((analysis.scorecard.workSegmentDeltas.length ?? 0) > 0);
  assert.equal(analysis.workSegmentActual?.workSegmentCount, 1);
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
    garminDetailActivityId: "act1",
    garmin_detail_activity: { detailData: { laps: [] }, hydratedAt: new Date() },
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
  assert.match(analysis.paceForPaceError ?? analysis.completionOnlyMessage ?? "", /Garmin detail is available/);
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

test("easy run with segment laps reaches detail with mile splits", () => {
  const segments = [
    {
      id: "s1",
      title: "Easy",
      stepOrder: 1,
      targets: [{ type: "PACE", valueLow: 335, valueHigh: 345 }],
      paceTargetEncodingVersion: 2,
      actualPaceSecPerMile: 513,
      actualDurationSeconds: 480,
      actualDistanceMiles: 1.0,
      segment_laps: [{ lapIndex: 0, avgPaceSecPerMile: 510, avgHeartRate: 132 }],
    },
    {
      id: "s2",
      title: "Easy",
      stepOrder: 2,
      targets: [{ type: "PACE", valueLow: 335, valueHigh: 345 }],
      paceTargetEncodingVersion: 2,
      actualPaceSecPerMile: 516,
      actualDurationSeconds: 480,
      actualDistanceMiles: 1.0,
      segment_laps: [{ lapIndex: 1, avgPaceSecPerMile: 518, avgHeartRate: 134 }],
    },
  ];

  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "Easy",
    targetPaceSecPerMile: 540,
    targetPaceSecPerMileHigh: 550,
    paceDeltaSecPerMile: 10,
    actualAvgPaceSecPerMile: 513,
    actualDistanceMeters: 4 * 1609.34,
    actualDurationSeconds: 3000,
    completedActivityDetailJson: { laps: [] },
    garminDetailActivityId: "act1",
    garmin_detail_activity: { detailData: { laps: [] }, hydratedAt: new Date() },
    segments,
  });

  assert.equal(analysis.analysisMode, "detail");
  assert.equal(analysis.lapSource, "step");
  assert.ok(analysis.phaseAwareLaps.length >= 2);
  assert.equal(analysis.canJudgeTargetPace, true);
  assert.ok(analysis.executionHeadline?.includes("on target"));

  const comparison = resolveTargetComparisonPace({
    analysis,
    workoutType: "Easy",
    actualAvgPaceSecPerMile: 513,
    paceDeltaSecPerMile: 10,
    targetPaceSecPerMile: 540,
    targetPaceSecPerMileHigh: 550,
  });

  assert.notEqual(comparison.actualPaceSecPerMile, null);
});

test("long run with segment laps uses auto lap source for single-block prescription", () => {
  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "LongRun",
    targetPaceSecPerMile: 540,
    targetPaceSecPerMileHigh: null,
    paceDeltaSecPerMile: null,
    actualAvgPaceSecPerMile: 530,
    actualDistanceMeters: 12 * 1609.34,
    actualDurationSeconds: 6000,
    completedActivityDetailJson: { laps: [] },
    garminDetailActivityId: "act1",
    garmin_detail_activity: { detailData: { laps: [] }, hydratedAt: new Date() },
    segments: [
      {
        id: "s1",
        title: "Long Run",
        stepOrder: 1,
        targets: [{ type: "PACE", valueLow: 335, valueHigh: 345 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: 530,
        actualDurationSeconds: 6000,
        actualDistanceMiles: 12,
        segment_laps: [{ lapIndex: 0, avgPaceSecPerMile: 530 }],
      },
    ],
  });

  assert.equal(analysis.analysisMode, "detail");
  assert.equal(analysis.lapSource, "auto");
  assert.ok(analysis.phaseAwareLaps.length > 0);
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
    garminDetailActivityId: "act1",
    garmin_detail_activity: { detailData: { laps: [] }, hydratedAt: new Date() },
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

test("easy run with matched whole-run pace shows Pace for Pace without segment bolt", () => {
  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "Easy",
    targetPaceSecPerMile: 540,
    targetPaceSecPerMileHigh: 570,
    paceDeltaSecPerMile: 10,
    actualAvgPaceSecPerMile: 530,
    actualDistanceMeters: 8000,
    actualDurationSeconds: 3600,
    garminDetailActivityId: "act-easy",
    garmin_detail_activity: { detailData: null, hydratedAt: null },
    segments: [
      {
        id: "easy-1",
        title: "Easy",
        stepOrder: 1,
        targets: [{ type: "PACE", valueLow: 335, valueHigh: 354 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: null,
        actualDurationSeconds: null,
        actualDistanceMiles: null,
        segment_laps: [],
      },
    ],
  });

  assert.equal(analysis.requiresPaceForPaceAnalysis, true);
  assert.equal(analysis.requiresSegmentLevelPaceForPace, false);
  assert.equal(analysis.analysisMode, "detail");
  assert.equal(analysis.scorecard.workEffort?.summary, "Pace faster than target");
  assert.equal(analysis.paceForPaceError, null);
});

test("regular long run with matched whole-run pace shows Pace for Pace", () => {
  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "LongRun",
    targetPaceSecPerMile: 480,
    targetPaceSecPerMileHigh: 510,
    paceDeltaSecPerMile: -15,
    actualAvgPaceSecPerMile: 520,
    actualDistanceMeters: 16093,
    actualDurationSeconds: 7920,
    garminDetailActivityId: "act-lr",
    garmin_detail_activity: { detailData: null, hydratedAt: null },
    segments: [
      {
        id: "lr-1",
        title: "Long Run",
        stepOrder: 1,
        targets: [{ type: "PACE", valueLow: 298, valueHigh: 317 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: null,
        actualDurationSeconds: null,
        actualDistanceMiles: null,
        segment_laps: [],
      },
    ],
  });

  assert.equal(analysis.requiresPaceForPaceAnalysis, true);
  assert.equal(analysis.requiresSegmentLevelPaceForPace, false);
  assert.equal(analysis.analysisMode, "detail");
  assert.equal(analysis.scorecard.workEffort?.summary, "Pace slower than target");
});

test("long run with MP without segment actuals does not use whole-run pace as Pace for Pace", () => {
  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "LongRun",
    targetPaceSecPerMile: 443,
    targetPaceSecPerMileHigh: 453,
    paceDeltaSecPerMile: 20,
    actualAvgPaceSecPerMile: 443,
    actualDistanceMeters: 33000,
    actualDurationSeconds: 9060,
    estimatedDistanceInMeters: 31500,
    completedActivityDetailJson: null,
    garminDetailActivityId: "act-lr-mp",
    garmin_detail_activity: { detailData: null, hydratedAt: null },
    segments: [
      {
        id: "lr-wu",
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
        id: "lr-mp",
        title: "Goal marathon pace",
        stepOrder: 2,
        targets: [{ type: "PACE", valueLow: 275, valueHigh: 281 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: null,
        actualDurationSeconds: null,
        actualDistanceMiles: null,
        segment_laps: [],
      },
      {
        id: "lr-easy",
        title: "Long Run",
        stepOrder: 3,
        targets: [{ type: "PACE", valueLow: 310, valueHigh: 320 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: null,
        actualDurationSeconds: null,
        actualDistanceMiles: null,
        segment_laps: [],
      },
    ],
  });

  assert.equal(analysis.requiresPaceForPaceAnalysis, true);
  assert.equal(analysis.requiresSegmentLevelPaceForPace, true);
  assert.equal(analysis.analysisMode, "completion_only");
  assert.equal(analysis.scorecard.workEffort, null);
  assert.match(analysis.paceForPaceError ?? "", /Garmin activity detail is required/);
  assert.equal(analysis.scorecard.workSegmentDeltas.length, 0);
});

test("long run with MP and aligned segment actuals shows work segment comparison", () => {
  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: "LongRun",
    targetPaceSecPerMile: 443,
    targetPaceSecPerMileHigh: 453,
    paceDeltaSecPerMile: 5,
    actualAvgPaceSecPerMile: 438,
    actualDistanceMeters: 33000,
    actualDurationSeconds: 9060,
    estimatedDistanceInMeters: 31500,
    completedActivityDetailJson: { laps: [] },
    garminDetailActivityId: "act-lr-mp",
    garmin_detail_activity: { detailData: { laps: [] }, hydratedAt: new Date() },
    segmentExecutionStatus: "ALIGNED",
    segments: [
      {
        id: "lr-mp",
        title: "Goal marathon pace",
        stepOrder: 2,
        targets: [{ type: "PACE", valueLow: 275, valueHigh: 281 }],
        paceTargetEncodingVersion: 2,
        actualPaceSecPerMile: 438,
        actualDurationSeconds: 3600,
        actualDistanceMiles: 8.2,
        segment_laps: [{ lapIndex: 0, avgPaceSecPerMile: 438 }],
      },
    ],
  });

  assert.equal(analysis.analysisMode, "detail");
  assert.equal(analysis.requiresPaceForPaceAnalysis, true);
  assert.ok(analysis.scorecard.workSegmentDeltas.length > 0);
  assert.equal(analysis.paceForPaceError, null);
});
