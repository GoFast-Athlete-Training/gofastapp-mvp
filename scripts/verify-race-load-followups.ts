/**
 * Non-DB checks for race-load followups (segment snapshots + MP materialization + equivalents).
 * Run: npx tsx scripts/verify-race-load-followups.ts
 */

import assert from "node:assert";
import type { workout_catalogue } from "@prisma/client";
import { catalogueEntryToApiSegments } from "@/lib/training/catalogue-to-segments";
import { segmentSnapshotDocumentFromApiSegments } from "@/lib/training/workout-segment-snapshot";
import { bikeMetersToRunEquivalentMiles, swimMetersToRunEquivalentMiles } from "@/lib/training/cross-training-volume-equivalents";
import {
  paceAnchorReadinessNarratives,
  THRESHOLD_HEADROOM_COMFORT_SEC,
  aerobicCeilingGapLines,
} from "@/lib/training/race-load-gap-analysis";
import {
  computeMatchedWorkoutPaceCredits,
  computeMatchedWorkoutAerobicCeilingCredit,
} from "@/lib/training/match-activity-to-workout";
import { computeNextAerobicCeilingBpm } from "@/lib/training/apply-aerobic-ceiling-credit";

function baseLongRunMpCatalogue(
  overrides: Partial<workout_catalogue> = {}
): workout_catalogue {
  return {
    id: "ctest",
    name: "Test",
    slug: "test",
    runSubType: "MP",
    segmentPaceDist: null,
    warmupFraction: null,
    workFraction: null,
    cooldownFraction: null,
    workBaseMiles: null,
    workBasePaceOffsetSecPerMile: null,
    workBaseReps: null,
    workBaseRepMeters: null,
    recoveryDistanceMeters: null,
    warmupMiles: 2,
    cooldownMiles: 2,
    workPaceOffsetSecPerMile: null,
    recoveryPaceOffsetSecPerMile: null,
    intendedHeartRateZone: null,
    intendedHRBpmLow: null,
    intendedHRBpmHigh: null,
    warmupPaceOffsetSecPerMile: null,
    cooldownPaceOffsetSecPerMile: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    workoutType: "LongRun",
    description: null,
    paceAnchor: "mpSimulation",
    mpFraction: null,
    mpBlockPosition: null,
    mpBlockProgression: "flat",
    mpTotalMiles: null,
    mpPaceOffsetSecPerMile: null,
    recoveryDurationSeconds: null,
    trainingIntent: [],
    ...overrides,
  } as workout_catalogue;
}

function main() {
  const entry = baseLongRunMpCatalogue();
  const segs = catalogueEntryToApiSegments({
    entry,
    scheduleMiles: 12,
    anchorSecondsPerMile: 420,
    racePaceSecondsPerMile: 480,
    planCycleIndex: 0,
  });
  const titles = segs.map((s) => s.title);
  assert.ok(titles.includes("Warmup"), `expected Warmup, got ${titles.join(",")}`);
  assert.ok(
    titles.some((t) => t.toLowerCase().includes("marathon")),
    `expected MP segment, got ${titles.join(",")}`
  );
  assert.ok(titles.includes("Cooldown"), `expected Cooldown, got ${titles.join(",")}`);

  const mpSeg = segs.find((s) => s.title.toLowerCase().includes("marathon"));
  assert.strictEqual(mpSeg?.durationValue, 8, "12 total − 2 warm − 2 cool = 8 MP mi");

  const snap = segmentSnapshotDocumentFromApiSegments(segs, "api_lazy_segments");
  const doc = snap as { v: number; segments: unknown[]; source: string };
  assert.strictEqual(doc.v, 1);
  assert.strictEqual(doc.source, "api_lazy_segments");
  assert.strictEqual(doc.segments.length, segs.length);

  const bikeEq = bikeMetersToRunEquivalentMiles(16093.4);
  assert.ok(bikeEq > 2.4 && bikeEq < 2.6, `expected ~2.5 run-mi equiv for 10 bike mi, got ${bikeEq}`);
  const swimEq = swimMetersToRunEquivalentMiles(800);
  assert.ok(swimEq > 0.7 && swimEq < 0.9, `expected ~0.8 run-mi equiv for 800m swim, got ${swimEq}`);

  // Threshold pace MVP1 — pace anchor readiness (pure, no DB)
  assert.strictEqual(THRESHOLD_HEADROOM_COMFORT_SEC, 15);

  const comfort = paceAnchorReadinessNarratives({
    athleteFiveKPaceSecPerMile: 360,
    athleteThresholdPaceSecPerMile: 400,
    goalRacePaceSecPerMile: 480,
  });
  assert.strictEqual(comfort.thresholdVsFiveKSec, 40);
  assert.strictEqual(comfort.goalRaceVsThresholdSec, 80);
  assert.strictEqual(comfort.fiveKAnchorStaleVsThreshold, false);
  assert.strictEqual(comfort.goalPaceTooCloseToThreshold, false);
  assert.ok(
    comfort.narratives.some((n) => n.includes("below redline")),
    "expected comfortable MP vs threshold narrative"
  );

  const stale5k = paceAnchorReadinessNarratives({
    athleteFiveKPaceSecPerMile: 400,
    athleteThresholdPaceSecPerMile: 395,
    goalRacePaceSecPerMile: 480,
  });
  assert.ok(stale5k.fiveKAnchorStaleVsThreshold);
  assert.ok(
    stale5k.narratives.some((n) => n.includes("stale")),
    "expected stale 5K narrative"
  );

  const tight = paceAnchorReadinessNarratives({
    athleteFiveKPaceSecPerMile: 360,
    athleteThresholdPaceSecPerMile: 470,
    goalRacePaceSecPerMile: 478,
  });
  assert.ok(tight.goalPaceTooCloseToThreshold);
  assert.ok(
    tight.narratives.some((n) => n.includes("too close")),
    "expected goal-too-close narrative"
  );

  const missingThr = paceAnchorReadinessNarratives({
    athleteFiveKPaceSecPerMile: 360,
    athleteThresholdPaceSecPerMile: null,
    goalRacePaceSecPerMile: 480,
  });
  assert.ok(
    missingThr.narratives.some((n) => n.includes("establish threshold")),
    "expected prompt to complete tempo when threshold missing"
  );

  // Match routing: Tempo → threshold credit; Intervals → 5K credit (no DB)
  const tempoCredit = computeMatchedWorkoutPaceCredits({
    workoutType: "Tempo",
    paceSecPerMile: 402,
    paceDeltaSecPerMile: 2,
    intervalsCatalogueOffsetSecPerMile: null,
  });
  assert.strictEqual(tempoCredit.creditedThresholdPaceSecPerMile, 402);
  assert.strictEqual(tempoCredit.creditedFiveKPaceSecPerMile, null);

  const intervalCredit = computeMatchedWorkoutPaceCredits({
    workoutType: "Intervals",
    paceSecPerMile: 370,
    paceDeltaSecPerMile: 5,
    intervalsCatalogueOffsetSecPerMile: null,
  });
  assert.strictEqual(
    intervalCredit.creditedFiveKPaceSecPerMile,
    380,
    "default interval offset -10 → rep implied 5K 10 s/mi faster than average"
  );
  assert.strictEqual(intervalCredit.creditedThresholdPaceSecPerMile, null);

  const noQuality = computeMatchedWorkoutPaceCredits({
    workoutType: "Tempo",
    paceSecPerMile: 400,
    paceDeltaSecPerMile: -5,
    intervalsCatalogueOffsetSecPerMile: null,
  });
  assert.strictEqual(noQuality.creditedThresholdPaceSecPerMile, null);
  assert.strictEqual(noQuality.creditedFiveKPaceSecPerMile, null);

  // Aerobic ceiling MVP — HR credit routing + smoothing + readiness line (pure, no DB)
  assert.strictEqual(
    computeMatchedWorkoutAerobicCeilingCredit({
      workoutType: "Easy",
      averageHeartRateBpm: 145,
      paceDeltaSecPerMile: null,
    }),
    145
  );
  assert.strictEqual(
    computeMatchedWorkoutAerobicCeilingCredit({
      workoutType: "Easy",
      averageHeartRateBpm: 145,
      paceDeltaSecPerMile: 16,
    }),
    null,
    "too fast vs easy target → no aerobic HR credit"
  );
  assert.strictEqual(
    computeMatchedWorkoutAerobicCeilingCredit({
      workoutType: "Tempo",
      averageHeartRateBpm: 155,
      paceDeltaSecPerMile: 0,
    }),
    null
  );
  assert.strictEqual(
    computeMatchedWorkoutAerobicCeilingCredit({
      workoutType: "Intervals",
      averageHeartRateBpm: 170,
      paceDeltaSecPerMile: 0,
    }),
    null
  );

  assert.strictEqual(computeNextAerobicCeilingBpm(null, 140), 140);
  assert.strictEqual(computeNextAerobicCeilingBpm(140, 136), 136);
  assert.strictEqual(computeNextAerobicCeilingBpm(140, 130), 136, "max 4 bpm down per workout");
  assert.strictEqual(computeNextAerobicCeilingBpm(140, 142), 140, "within upward noise band");
  assert.strictEqual(computeNextAerobicCeilingBpm(140, 150), 142, "max 2 bpm up per workout");

  const acLines = aerobicCeilingGapLines(148);
  assert.strictEqual(acLines.length, 1);
  assert.ok(acLines[0].includes("148"));
  assert.strictEqual(aerobicCeilingGapLines(null).length, 0);

  console.log("verify-race-load-followups: OK");
}

main();
