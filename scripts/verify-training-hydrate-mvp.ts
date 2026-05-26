/**
 * Smoke checks for training hydrate projection + light adaptive evaluation helpers.
 * Run: npx tsx scripts/verify-training-hydrate-mvp.ts
 */

import assert from "node:assert/strict";
import { deriveGoalPaces } from "../lib/pace-utils";
import {
  buildLongEffortEvidenceFromRun,
  computeRaceReadiness,
  parseGoalTimeToSeconds,
  parsePaceStringToSecPerMile,
  projectRaceFromFiveKSecPerMile,
} from "../lib/training/race-projection";

const MILES_MARATHON = 26.21875;

const projection = projectRaceFromFiveKSecPerMile(480, MILES_MARATHON);
assert.ok(projection);
assert.ok(projection!.projectedFinishSec > 0);
assert.ok(projection!.projectedPaceSecPerMile > 480);

const goalFinishSec = parseGoalTimeToSeconds("3:30:00");
assert.ok(goalFinishSec);

const current5kSecPerMile = parsePaceStringToSecPerMile("6:25");
assert.equal(current5kSecPerMile, 385);

const marathonGoalSec = parseGoalTimeToSeconds("2:59:00");
const { goalPace5K, goalRacePace } = deriveGoalPaces({
  distance: "marathon",
  goalTime: "2:59:00",
  distanceMiles: MILES_MARATHON,
});

const withoutEvidence = computeRaceReadiness({
  current5kSecPerMile,
  goalFinishSec: marathonGoalSec,
  goalPaceSecPerMile: goalRacePace,
  goalPace5KSecPerMile: goalPace5K,
  eventMiles: MILES_MARATHON,
  evidence: null,
});
assert.equal(withoutEvidence.confidence, "none");
assert.equal(withoutEvidence.estimatedFinish, null);

const evidence = buildLongEffortEvidenceFromRun({
  activityId: "smoke",
  activityName: "Half hold",
  startTime: new Date().toISOString(),
  distanceMiles: 13.1,
  durationSeconds: 5520,
});
assert.ok(evidence);

const withEvidence = computeRaceReadiness({
  current5kSecPerMile,
  goalFinishSec: marathonGoalSec,
  goalPaceSecPerMile: goalRacePace,
  goalPace5KSecPerMile: goalPace5K,
  eventMiles: MILES_MARATHON,
  evidence,
});
assert.notEqual(withEvidence.confidence, "none");
assert.ok(withEvidence.estimatedFinish);

console.log("verify-training-hydrate-mvp: ok");
