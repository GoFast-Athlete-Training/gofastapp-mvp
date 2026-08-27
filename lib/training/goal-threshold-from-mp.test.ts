import assert from "node:assert/strict";
import test from "node:test";
import type { workout_catalogue } from "@prisma/client";
import { prescribe } from "@/lib/training/prescription";
import { DEFAULT_ATHLETE_PACE_ADJUSTER } from "@/lib/training/athlete-pace-adjuster";
import {
  buildTempoPrescriptionGoalBenchmark,
  goalThresholdSecPerMileFromGoalMp,
  interpretTempoVsGoalThreshold,
  prescribedTempoPaceSecPerMileFromSteps,
} from "@/lib/training/goal-threshold-from-mp";
import { computeFiveKPaceSuggestion } from "@/lib/training/workout-pace-performance";

const ANCHOR_SEC = 420;

function tempoCatalogue(
  segmentPaceDist: unknown,
  workPaceOffsetSecPerMile = 45
): workout_catalogue {
  return {
    id: "tempo-test",
    name: "Tempo test",
    slug: "tempo-test",
    runSubType: null,
    segmentPaceDist: segmentPaceDist as workout_catalogue["segmentPaceDist"],
    warmupFraction: null,
    workFraction: null,
    cooldownFraction: null,
    workBaseMiles: null,
    workBasePaceOffsetSecPerMile: null,
    workBaseReps: null,
    workBaseRepMeters: null,
    recoveryDistanceMeters: null,
    recoveryDurationSeconds: null,
    warmupMiles: 1,
    cooldownMiles: 1,
    workPaceOffsetSecPerMile,
    recoveryPaceOffsetSecPerMile: 120,
    intendedHeartRateZone: null,
    intendedHRBpmLow: null,
    intendedHRBpmHigh: null,
    warmupPaceOffsetSecPerMile: 120,
    cooldownPaceOffsetSecPerMile: 120,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    workoutType: "Tempo",
    description: null,
    paceAnchor: "current_buildup",
    mpFraction: null,
    mpBlockPosition: null,
    mpBlockProgression: "flat",
    mpTotalMiles: null,
    mpPaceOffsetSecPerMile: null,
    trainingIntent: [],
  } as workout_catalogue;
}

test("goal threshold derived from goal MP minus fixed gap", () => {
  const mp = 6 * 60 + 52;
  assert.equal(goalThresholdSecPerMileFromGoalMp(mp), mp - 25);
  assert.equal(goalThresholdSecPerMileFromGoalMp(null), null);
});

test("interpretTempoVsGoalThreshold bands", () => {
  const goalT = 387;
  assert.equal(interpretTempoVsGoalThreshold(420, goalT), "BELOW_TARGET_STIMULUS");
  assert.equal(interpretTempoVsGoalThreshold(400, goalT), "APPROACHING_GOAL_THRESHOLD");
  assert.equal(interpretTempoVsGoalThreshold(390, goalT), "ALIGNED_WITH_GOAL_THRESHOLD");
  assert.equal(interpretTempoVsGoalThreshold(380, goalT), "FASTER_THAN_THRESHOLD_TARGET");
});

test("prescribed Tempo pace unchanged when goal MP changes; interpretation changes", () => {
  const entry = tempoCatalogue([
    { miles: 1, paceOffsetSecPerMile: 45 },
    { miles: 1, paceOffsetSecPerMile: 10 },
  ]);

  const stepsA = prescribe({
    entry,
    scheduleMiles: 6,
    anchorSecondsPerMile: ANCHOR_SEC,
    racePaceSecondsPerMile: 412,
    paceAdjuster: { ...DEFAULT_ATHLETE_PACE_ADJUSTER, threshold: -20 },
  });

  const stepsB = prescribe({
    entry,
    scheduleMiles: 6,
    anchorSecondsPerMile: ANCHOR_SEC,
    racePaceSecondsPerMile: 480,
    paceAdjuster: { ...DEFAULT_ATHLETE_PACE_ADJUSTER, threshold: -20 },
  });

  const paceA = prescribedTempoPaceSecPerMileFromSteps(stepsA);
  const paceB = prescribedTempoPaceSecPerMileFromSteps(stepsB);
  assert.equal(paceA, paceB, "prescribe anchor is 5K only");

  const benchA = buildTempoPrescriptionGoalBenchmark({
    steps: stepsA,
    goalRacePaceSecPerMile: 412,
  });
  const benchB = buildTempoPrescriptionGoalBenchmark({
    steps: stepsB,
    goalRacePaceSecPerMile: 480,
  });

  assert.notEqual(benchA?.interpretation, benchB?.interpretation);
  assert.equal(benchA?.prescribedTempoPaceSecPerMile, benchB?.prescribedTempoPaceSecPerMile);
});

test("interval and long-run prescribe paths unchanged vs goal MP", () => {
  const intervalEntry = {
    ...tempoCatalogue(null, -10),
    workoutType: "Intervals" as const,
    workBaseMiles: 1,
    workBaseReps: 4,
    workBaseRepMeters: 800,
    workBasePaceOffsetSecPerMile: -10,
  };

  const intervalSteps = prescribe({
    entry: intervalEntry,
    scheduleMiles: 6,
    anchorSecondsPerMile: ANCHOR_SEC,
    racePaceSecondsPerMile: 400,
    paceAdjuster: DEFAULT_ATHLETE_PACE_ADJUSTER,
  });

  const intervalStepsOtherGoal = prescribe({
    entry: intervalEntry,
    scheduleMiles: 6,
    anchorSecondsPerMile: ANCHOR_SEC,
    racePaceSecondsPerMile: 500,
    paceAdjuster: DEFAULT_ATHLETE_PACE_ADJUSTER,
  });

  assert.deepEqual(
    intervalSteps.map((s) => s.targets),
    intervalStepsOtherGoal.map((s) => s.targets)
  );

  const longRunEntry = {
    ...tempoCatalogue([{ miles: 8, paceOffsetSecPerMile: 90 }]),
    workoutType: "LongRun" as const,
  };

  const longSteps = prescribe({
    entry: longRunEntry,
    scheduleMiles: 10,
    anchorSecondsPerMile: ANCHOR_SEC,
    racePaceSecondsPerMile: 400,
    paceAdjuster: DEFAULT_ATHLETE_PACE_ADJUSTER,
  });

  const longStepsOtherGoal = prescribe({
    entry: longRunEntry,
    scheduleMiles: 10,
    anchorSecondsPerMile: ANCHOR_SEC,
    racePaceSecondsPerMile: 500,
    paceAdjuster: DEFAULT_ATHLETE_PACE_ADJUSTER,
  });

  assert.deepEqual(
    longSteps.map((s) => s.targets),
    longStepsOtherGoal.map((s) => s.targets)
  );
});

test("five K suggestion eligible for intervals on target; not auto-applied", () => {
  const suggestion = computeFiveKPaceSuggestion({
    workoutType: "Intervals",
    paceSecPerMile: 400,
    paceDeltaSecPerMile: 5,
    currentFiveKSecPerMile: 420,
    intervalsCatalogueOffsetSecPerMile: -10,
  });

  assert.equal(suggestion.eligible, true);
  assert.ok(suggestion.suggestedFiveKSecPerMile != null);
  assert.ok(suggestion.suggestedFiveKSecPerMile! < 420);

  const longRunSuggestion = computeFiveKPaceSuggestion({
    workoutType: "LongRun",
    paceSecPerMile: 480,
    paceDeltaSecPerMile: 5,
    currentFiveKSecPerMile: 420,
  });
  assert.equal(longRunSuggestion.eligible, false);
});
