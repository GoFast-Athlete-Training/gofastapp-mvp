import assert from "node:assert/strict";
import test from "node:test";
import type { workout_catalogue } from "@prisma/client";
import {
  descriptorsToWorkoutSteps,
  getTemplateSegments,
  prescribe,
} from "@/lib/training/prescription";
import { PACE_ANCHOR_CURRENT_BUILDUP, PACE_ANCHOR_MP_SIMULATION } from "@/lib/training/goal-pace-calculator";
import { getTrainingPaces, paceTargetFromSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { effectivePaceProfileForPreset } from "@/lib/training/pace-key-resolver";

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

test("Easy workout uses paceProfile easy key when profile is set", () => {
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "Easy",
      workPaceOffsetSecPerMile: 90,
      warmupMiles: 0,
      cooldownMiles: 0,
      workBaseMiles: 5,
    }),
    scheduleMiles: 5,
    anchorSecondsPerMile: ANCHOR_SEC,
    easyWorkPaceOffsetOverrideSecPerMile: 150,
    paceProfile: {
      easy: { anchor: "current5k", offsetSecPerMile: 120 },
    },
  });
  const work = steps.find((s) => s.title === "Work");
  assert.ok(work?.targets?.length, "easy work should have pace targets");
  const paceTarget = work!.targets!.find((t) => t.type === "PACE");
  assert.ok(paceTarget);
  const fromProfile = paceTargetFromSecondsPerMile(ANCHOR_SEC + 120);
  const fromOverride = paceTargetFromSecondsPerMile(ANCHOR_SEC + 150);
  assert.equal(paceTarget!.valueLow, fromProfile.valueLow);
  assert.notEqual(paceTarget!.valueLow, fromOverride.valueLow);
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

const M400 = 400 / 1609.34;

test("Tempo mile-list materializes rolling-hills 400/400/400 from distanceMeters", () => {
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "Tempo",
      workPaceOffsetSecPerMile: 30,
      segmentPaceDist: [
        { distanceMeters: 400, paceKey: "threshold" },
        { distanceMeters: 400, paceKey: "steady" },
        { distanceMeters: 400, paceKey: "threshold" },
      ] as unknown as workout_catalogue["segmentPaceDist"],
    }),
    scheduleMiles: 3.25,
    anchorSecondsPerMile: ANCHOR_SEC,
    paceProfile: {
      threshold: { anchor: "current5k", offsetSecPerMile: 30 },
      steady: { anchor: "current5k", offsetSecPerMile: 45 },
    },
  });
  const tempoSteps = steps.filter((s) => s.title === "Tempo");
  assert.equal(tempoSteps.length, 3, "expected three distinct tempo segments");
  for (const s of tempoSteps) {
    assert.ok(s.durationValue > 0.2 && s.durationValue < 0.3, "each step ~400m in miles");
    assert.ok(s.targets?.length, "tempo steps should have pace targets");
  }
});

test("Tempo blockRepeat accepts distanceMeters segments", () => {
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "Tempo",
      workPaceOffsetSecPerMile: 30,
      segmentPaceDist: {
        layout: "blockRepeat",
        segments: [
          { distanceMeters: 400, paceKey: "threshold" },
          { distanceMeters: 400, paceKey: "steady" },
          { distanceMeters: 400, paceKey: "threshold" },
        ],
        repeatCount: 2,
        recoveryBetweenCyclesSeconds: 90,
      } as unknown as workout_catalogue["segmentPaceDist"],
    }),
    scheduleMiles: 8,
    anchorSecondsPerMile: ANCHOR_SEC,
    paceProfile: {
      threshold: { anchor: "current5k", offsetSecPerMile: 30 },
      steady: { anchor: "current5k", offsetSecPerMile: 45 },
    },
  });
  const tempoSteps = steps.filter((s) => s.title === "Tempo");
  assert.equal(tempoSteps.length, 6, "2 cycles × 3 segments");
  const recoveries = steps.filter((s) => s.title === "Recovery");
  assert.equal(recoveries.length, 1, "one recovery between two cycles");
  assert.equal(recoveries[0]!.durationValue, 1.5, "90s → 1.5 min");
});

test("Tempo with invalid segmentPaceDist still falls back to sustained block", () => {
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "Tempo",
      workPaceOffsetSecPerMile: 30,
      segmentPaceDist: [{ notDistance: true }] as unknown as workout_catalogue["segmentPaceDist"],
    }),
    scheduleMiles: 6,
    anchorSecondsPerMile: ANCHOR_SEC,
  });
  const tempoSteps = steps.filter((s) => s.title === "Tempo");
  assert.equal(tempoSteps.length, 1, "sustained tempo fallback");
});

function totalDistanceMiles(steps: ReturnType<typeof prescribe>): number {
  return steps
    .filter((s) => s.durationType === "DISTANCE")
    .reduce((sum, s) => sum + s.durationValue, 0);
}

test("LongRun progression defaults null bookends to 15% open warmup and cooldown", () => {
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "LongRun",
      workPaceOffsetSecPerMile: 90,
      warmupMiles: null,
      cooldownMiles: null,
      segmentPaceDist: [
        { miles: 2, paceOffsetSecPerMile: 60 },
        { miles: 2, paceOffsetSecPerMile: 45 },
        { miles: 2, paceOffsetSecPerMile: 30 },
      ] as unknown as workout_catalogue["segmentPaceDist"],
    }),
    scheduleMiles: 12,
    anchorSecondsPerMile: ANCHOR_SEC,
  });
  const warmup = steps.find((s) => s.title === "Warmup");
  const cooldown = steps.find((s) => s.title === "Cooldown");
  assert.ok(warmup, "expected default warmup");
  assert.ok(cooldown, "expected default cooldown");
  assert.equal(warmup!.durationValue, 1.8, "15% of 12 mi");
  assert.equal(cooldown!.durationValue, 1.8, "15% of 12 mi");
  assert.equal(warmup!.targets, undefined, "warmup is OPEN");
  assert.equal(cooldown!.targets, undefined, "cooldown is OPEN");
  assert.equal(steps[0]!.title, "Warmup", "must not start with hard-paced work");
});

test("LongRun progression explicit zero bookends skip warmup and cooldown", () => {
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "LongRun",
      warmupMiles: 0,
      cooldownMiles: 0,
      workPaceOffsetSecPerMile: 90,
      segmentPaceDist: [
        { miles: 3, paceOffsetSecPerMile: 60 },
      ] as unknown as workout_catalogue["segmentPaceDist"],
    }),
    scheduleMiles: 10,
    anchorSecondsPerMile: ANCHOR_SEC,
  });
  assert.equal(steps.find((s) => s.title === "Warmup"), undefined);
  assert.equal(steps.find((s) => s.title === "Cooldown"), undefined);
});

test("LongRun progression scales authored segments to fit scheduled distance", () => {
  const scheduleMiles = 10;
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "LongRun",
      warmupMiles: null,
      cooldownMiles: null,
      workPaceOffsetSecPerMile: 90,
      segmentPaceDist: [
        { miles: 4, paceOffsetSecPerMile: 60 },
        { miles: 4, paceOffsetSecPerMile: 45 },
        { miles: 4, paceOffsetSecPerMile: 30 },
      ] as unknown as workout_catalogue["segmentPaceDist"],
    }),
    scheduleMiles,
    anchorSecondsPerMile: ANCHOR_SEC,
  });
  const total = totalDistanceMiles(steps);
  assert.ok(
    total <= scheduleMiles + 0.06,
    `total ${total} should not exceed schedule ${scheduleMiles}`
  );
  assert.ok(steps.some((s) => s.title === "Warmup"));
  assert.ok(steps.some((s) => s.title === "Cooldown"));
});

test("LongRun paceKey without authored preset profile resolves targets via canonical fallback", () => {
  const anchorSec = 386; // 6:26/mi
  const paceProfile = effectivePaceProfileForPreset({
    paceProfile: null,
    athletePersonaCapability: null,
  });
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "LongRun",
      warmupMiles: 2,
      cooldownMiles: 2,
      workPaceOffsetSecPerMile: null,
      segmentPaceDist: [
        { miles: 3.5, paceKey: "moderate" },
        { miles: 3, paceKey: "threshold" },
        { miles: 3, paceKey: "threshold" },
      ] as unknown as workout_catalogue["segmentPaceDist"],
    }),
    scheduleMiles: 19.6,
    anchorSecondsPerMile: anchorSec,
    paceProfile,
  });

  const workSteps = steps.filter((s) => s.title.toLowerCase().includes("long run"));
  assert.equal(workSteps.length, 4, "3 progression segments + remainder filler");
  assert.equal(workSteps[0]!.durationValue, 3.5);
  assert.equal(workSteps[1]!.durationValue, 3);
  assert.equal(workSteps[2]!.durationValue, 3);
  assert.ok(workSteps[0]!.targets?.length, "moderate segment should have pace targets");
  assert.ok(workSteps[1]!.targets?.length, "threshold segment should have pace targets");
  assert.ok(workSteps[2]!.targets?.length, "threshold segment should have pace targets");

  const moderateTarget = workSteps[0]!.targets!.find((t) => t.type === "PACE")!;
  const thresholdTarget = workSteps[1]!.targets!.find((t) => t.type === "PACE")!;
  const fromModerate = paceTargetFromSecondsPerMile(anchorSec + 60);
  const fromThreshold = paceTargetFromSecondsPerMile(anchorSec + 20);
  assert.equal(moderateTarget.valueLow, fromModerate.valueLow);
  assert.equal(thresholdTarget.valueLow, fromThreshold.valueLow);
  assert.notEqual(moderateTarget.valueLow, thresholdTarget.valueLow);

  assert.equal(steps.find((s) => s.title === "Warmup")!.durationValue, 2);
  assert.equal(steps.find((s) => s.title === "Cooldown")!.durationValue, 2);
  assert.equal(totalDistanceMiles(steps), 19.6);
});

test("LongRun workFraction + goalRacePace uses back-half canonical path (no mpFraction)", () => {
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "LongRun",
      paceAnchor: PACE_ANCHOR_MP_SIMULATION,
      workFraction: 0.25,
      mpFraction: null,
      mpTotalMiles: null,
      warmupMiles: null,
      cooldownMiles: null,
      workPaceOffsetSecPerMile: 90,
    }),
    scheduleMiles: 16,
    anchorSecondsPerMile: ANCHOR_SEC,
    racePaceSecondsPerMile: 412,
  });
  const mpStep = steps.find((s) => s.title.toLowerCase().includes("goal marathon"));
  const easyStep = steps.find((s) => s.title === "Long Run");
  assert.ok(mpStep, "expected goal marathon pace block");
  assert.ok(easyStep, "expected easy long run remainder");
  assert.ok(mpStep!.stepOrder > easyStep!.stepOrder, "MP block follows easy miles");
});

test("LongRun paceKey with explicit preset profile uses authored offsets", () => {
  const anchorSec = 386;
  const steps = prescribe({
    entry: baseCatalogue({
      workoutType: "LongRun",
      warmupMiles: 2,
      cooldownMiles: 2,
      segmentPaceDist: [
        { miles: 3, paceKey: "moderate" },
      ] as unknown as workout_catalogue["segmentPaceDist"],
    }),
    scheduleMiles: 8,
    anchorSecondsPerMile: anchorSec,
    paceProfile: {
      moderate: { anchor: "current5k", offsetSecPerMile: 45 },
    },
  });
  const work = steps.find((s) => s.title === "Long run");
  assert.ok(work?.targets?.length);
  const paceTarget = work!.targets!.find((t) => t.type === "PACE")!;
  const custom = paceTargetFromSecondsPerMile(anchorSec + 45);
  assert.equal(paceTarget.valueLow, custom.valueLow);
});
