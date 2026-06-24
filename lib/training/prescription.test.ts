import assert from "node:assert/strict";
import test from "node:test";
import type { workout_catalogue } from "@prisma/client";
import {
  descriptorsToWorkoutSteps,
  getTemplateSegments,
  prescribe,
} from "@/lib/training/prescription";
import { PACE_ANCHOR_CURRENT_BUILDUP, PACE_ANCHOR_MP_SIMULATION } from "@/lib/training/goal-pace-calculator";
import { getTrainingPaces } from "@/lib/workout-generator/pace-calculator";

const ANCHOR_SEC = 420; // 7:00/mi 5K anchor

function baseCatalogue(
  overrides: Partial<workout_catalogue> = {}
): workout_catalogue {
  return {
    id: "ctest",
    name: "Test",
    slug: "test",
    runSubType: null,
    segmentPaceDist: null,
    warmupFraction: null,
    workFraction: null,
    cooldownFraction: null,
    workBaseMiles: null,
    workBasePaceOffsetSecPerMile: null,
    workBaseReps: null,
    workBaseRepMeters: null,
    recoveryDistanceMeters: null,
    recoveryDurationSeconds: null,
    warmupMiles: 1.5,
    cooldownMiles: 1.0,
    workPaceOffsetSecPerMile: 30,
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
    paceAnchor: PACE_ANCHOR_CURRENT_BUILDUP,
    mpFraction: null,
    mpBlockPosition: null,
    mpBlockProgression: "flat",
    mpTotalMiles: null,
    mpPaceOffsetSecPerMile: null,
    trainingIntent: [],
    ...overrides,
  } as workout_catalogue;
}

function bookendSteps(steps: ReturnType<typeof prescribe>) {
  return steps.filter((s) => {
    const t = s.title.toLowerCase();
    return t.includes("warm") || t.includes("cool");
  });
}

test("LongRun segment paceKey resolves through preset paceProfile", () => {
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "LongRun",
      workPaceOffsetSecPerMile: 90,
      segmentPaceDist: [
        { miles: 3, paceKey: "steady" },
        { miles: 2, paceKey: "moderate" },
      ] as unknown as workout_catalogue["segmentPaceDist"],
    }),
    scheduleMiles: 8,
    anchorSecondsPerMile: ANCHOR_SEC,
    paceProfile: {
      steady: { anchor: "current5k", offsetSecPerMile: 90 },
      moderate: { anchor: "current5k", offsetSecPerMile: 60 },
    },
  });
  const paced = steps.filter((s) => s.targets?.length);
  assert.ok(paced.length >= 2, "expected paceKey-resolved segment targets");
});

test("sustained Tempo keeps bookend miles but omits pace targets even when offsets are set", () => {
  const steps = prescribe({
    entry: baseCatalogue({ workoutType: "Tempo", workPaceOffsetSecPerMile: 30 }),
    scheduleMiles: 6,
    anchorSecondsPerMile: ANCHOR_SEC,
  });
  const bookends = bookendSteps(steps);
  assert.ok(bookends.length >= 2, "expected warmup and cooldown segments");
  for (const seg of bookends) {
    assert.ok(seg.durationValue > 0, "bookend should keep distance");
    assert.equal(seg.targets, undefined, `${seg.title} should be OPEN (no targets)`);
  }
  const tempo = steps.find((s) => s.title === "Tempo");
  assert.ok(tempo?.targets?.length, "work segment should still have pace targets");
});

test("legacy Intervals keep bookend miles but omit pace targets even when offsets are set", () => {
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "Intervals",
      workBaseReps: 4,
      workBaseRepMeters: 800,
      workBasePaceOffsetSecPerMile: -30,
      workPaceOffsetSecPerMile: null,
    }),
    scheduleMiles: 8,
    anchorSecondsPerMile: ANCHOR_SEC,
  });
  const bookends = bookendSteps(steps);
  assert.ok(bookends.length >= 2);
  for (const seg of bookends) {
    assert.equal(seg.targets, undefined, `${seg.title} should be OPEN (no targets)`);
  }
  const interval = steps.find((s) => s.title === "Interval");
  assert.ok(interval?.targets?.length, "interval work should still have pace targets");
});

test("MP long run bookends stay distance-only when pace offsets are set", () => {
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "LongRun",
      paceAnchor: PACE_ANCHOR_MP_SIMULATION,
      warmupMiles: 2,
      cooldownMiles: 1.5,
      workPaceOffsetSecPerMile: null,
      recoveryPaceOffsetSecPerMile: 120,
    }),
    scheduleMiles: 12,
    anchorSecondsPerMile: ANCHOR_SEC,
    racePaceSecondsPerMile: 480,
  });
  const bookends = bookendSteps(steps);
  assert.ok(bookends.length >= 2);
  for (const seg of bookends) {
    assert.equal(seg.targets, undefined, `${seg.title} should be OPEN (no targets)`);
  }
  const mp = steps.find((s) => s.title.toLowerCase().includes("marathon"));
  assert.ok(mp?.targets?.length, "MP block should still have pace targets");
});

test("fallback tempo template bookends are distance-only", () => {
  const paces = getTrainingPaces(ANCHOR_SEC);
  const descriptors = getTemplateSegments("Tempo", 6, paces);
  const steps = descriptorsToWorkoutSteps(descriptors, paces);
  const bookends = bookendSteps(steps);
  assert.ok(bookends.length >= 2);
  for (const seg of bookends) {
    assert.equal(seg.targets, undefined, `${seg.title} should be OPEN (no targets)`);
  }
});
