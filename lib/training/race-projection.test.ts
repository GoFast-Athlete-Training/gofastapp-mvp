import assert from "node:assert/strict";
import test from "node:test";
import { deriveGoalPaces } from "@/lib/pace-utils";
import {
  buildLongEffortEvidenceFromRun,
  computeRaceReadiness,
  differenceToGoal,
  parseGoalTimeToSeconds,
  parsePaceStringToSecPerMile,
  projectRaceFromFiveKSecPerMile,
} from "@/lib/training/race-projection";

const MILES_MARATHON = 26.21875;

test("6:25/mi 5K pace with 2:59 marathon goal and no long evidence — no finish verdict", () => {
  const current5kSecPerMile = parsePaceStringToSecPerMile("6:25");
  assert.equal(current5kSecPerMile, 385);

  const goalFinishSec = parseGoalTimeToSeconds("2:59:00");
  assert.ok(goalFinishSec);

  const { goalPace5K, goalRacePace } = deriveGoalPaces({
    distance: "marathon",
    goalTime: "2:59:00",
    distanceMiles: MILES_MARATHON,
  });
  assert.ok(goalPace5K);
  assert.ok(goalRacePace);

  const readiness = computeRaceReadiness({
    current5kSecPerMile,
    goalFinishSec,
    goalPaceSecPerMile: goalRacePace,
    goalPace5KSecPerMile: goalPace5K,
    eventMiles: MILES_MARATHON,
    evidence: null,
  });

  assert.equal(readiness.confidence, "none");
  assert.equal(readiness.estimatedFinish, null);
  assert.equal(readiness.finishDeltaSec, null);
  assert.match(
    readiness.readinessLabel ?? "",
    /Need a recent long effort/i
  );
  assert.ok(readiness.modelFinishFrom5k);
  assert.notEqual(readiness.gapLabel, readiness.modelFinishFrom5k);

  const fiveKOnly = projectRaceFromFiveKSecPerMile(current5kSecPerMile!, MILES_MARATHON);
  assert.ok(fiveKOnly);
  const oldDiff = differenceToGoal({
    goalFinishSec,
    projectedFinishSec: fiveKOnly!.projectedFinishSec,
    goalPaceSecPerMile: goalRacePace,
    projectedPaceSecPerMile: fiveKOnly!.projectedPaceSecPerMile,
  });
  assert.ok(oldDiff.finishDeltaLabel?.includes("behind goal"));
  assert.notEqual(readiness.gapLabel, oldDiff.finishDeltaLabel);
});

test("6:25/mi with 13.1 mi hold produces confidence-labeled marathon estimate", () => {
  const current5kSecPerMile = parsePaceStringToSecPerMile("6:25");
  const goalFinishSec = parseGoalTimeToSeconds("2:59:00");
  const { goalPace5K, goalRacePace } = deriveGoalPaces({
    distance: "marathon",
    goalTime: "2:59:00",
    distanceMiles: MILES_MARATHON,
  });

  const evidence = buildLongEffortEvidenceFromRun({
    activityId: "act-1",
    activityName: "Long run",
    startTime: new Date().toISOString(),
    distanceMiles: 13.1,
    durationSeconds: Math.round(6 * 60 + 55) * 13.1,
  });
  assert.ok(evidence);
  assert.equal(evidence!.tier, "half_hold");

  const readiness = computeRaceReadiness({
    current5kSecPerMile,
    goalFinishSec,
    goalPaceSecPerMile: goalRacePace,
    goalPace5KSecPerMile: goalPace5K,
    eventMiles: MILES_MARATHON,
    evidence,
  });

  assert.notEqual(readiness.confidence, "none");
  assert.ok(readiness.estimatedFinish);
  assert.ok(readiness.gapLabel?.includes("goal"));
  assert.ok(readiness.gapLabel?.includes("13.1 mi"));
});

test("short race still uses 5K projection directly", () => {
  const current5kSecPerMile = parsePaceStringToSecPerMile("6:25");
  const goalFinishSec = parseGoalTimeToSeconds("19:30");
  const { goalPace5K, goalRacePace } = deriveGoalPaces({
    distance: "5k",
    goalTime: "19:30",
  });

  const readiness = computeRaceReadiness({
    current5kSecPerMile,
    goalFinishSec,
    goalPaceSecPerMile: goalRacePace,
    goalPace5KSecPerMile: goalPace5K,
    eventMiles: 3.10686,
    evidence: null,
  });

  assert.equal(readiness.confidence, "high");
  assert.equal(readiness.requiresEnduranceEvidence, false);
  assert.ok(readiness.estimatedFinish);
  assert.ok(readiness.gapLabel);
});
