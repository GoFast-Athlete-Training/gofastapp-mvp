/**
 * Non-DB checks for race-load followups (segment snapshots + MP materialization + equivalents).
 * Run: npx tsx scripts/verify-race-load-followups.ts
 */

import assert from "node:assert";
import type { workout_catalogue } from "@prisma/client";
import { catalogueEntryToApiSegments } from "@/lib/training/catalogue-to-segments";
import { segmentSnapshotDocumentFromApiSegments } from "@/lib/training/workout-segment-snapshot";
import { bikeMetersToRunEquivalentMiles, swimMetersToRunEquivalentMiles } from "@/lib/training/cross-training-volume-equivalents";

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

  console.log("verify-race-load-followups: OK");
}

main();
