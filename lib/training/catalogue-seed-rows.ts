import type { Prisma, WorkoutType } from "@prisma/client";
import {
  PACE_ANCHOR_CURRENT_BUILDUP,
  PACE_ANCHOR_MP_SIMULATION,
} from "@/lib/training/goal-pace-calculator";

export type CatalogueSeedRow = {
  name: string;
  slug?: string | null;
  runSubType?: string | null;
  workoutType: WorkoutType;
  description: string | null;
  workSegmentsJson: Prisma.InputJsonValue | null;
  warmupFraction: number | null;
  workFraction: number | null;
  cooldownFraction: number | null;
  paceAnchor: string;
  mpFraction: number | null;
  mpTotalMiles: number | null;
  mpPaceOffsetSecPerMile: number | null;
  mpBlockPosition: string | null;
  mpBlockProgression: string;
  workBaseReps: number | null;
  workBaseRepMeters: number | null;
  workBaseMiles: number | null;
  recoveryDistanceMeters: number | null;
  warmupMiles: number | null;
  warmupPaceOffsetSecPerMile: number | null;
  cooldownMiles: number | null;
  cooldownPaceOffsetSecPerMile: number | null;
  workPaceOffsetSecPerMile: number | null;
  workBasePaceOffsetSecPerMile: number | null;
  recoveryPaceOffsetSecPerMile: number | null;
  notes: string | null;
};

/** Canonical rows for API seed and `scripts/seed-catalogue.ts`. */
export const SEED_CATALOGUE_ROWS: CatalogueSeedRow[] = [
  {
    name: "Up and Over",
    runSubType: "pyramid",
    workoutType: "Intervals",
    description: "Pyramid ladder: 200–800–200 m reps at interval pace.",
    workSegmentsJson: [
      { distanceMeters: 200, paceOffsetSecPerMile: -30 },
      { distanceMeters: 400, paceOffsetSecPerMile: -30 },
      { distanceMeters: 800, paceOffsetSecPerMile: -30 },
      { distanceMeters: 400, paceOffsetSecPerMile: -30 },
      { distanceMeters: 200, paceOffsetSecPerMile: -30 },
    ],
    warmupFraction: null,
    workFraction: null,
    cooldownFraction: null,
    paceAnchor: PACE_ANCHOR_CURRENT_BUILDUP,
    mpFraction: null,
    mpTotalMiles: null,
    mpPaceOffsetSecPerMile: null,
    mpBlockPosition: null,
    mpBlockProgression: "flat",
    workBaseReps: null,
    workBaseRepMeters: null,
    workBaseMiles: null,
    recoveryDistanceMeters: null,
    warmupMiles: 1.5,
    warmupPaceOffsetSecPerMile: null,
    cooldownMiles: 1.5,
    cooldownPaceOffsetSecPerMile: null,
    workPaceOffsetSecPerMile: null,
    workBasePaceOffsetSecPerMile: -30,
    recoveryPaceOffsetSecPerMile: null,
    notes: "Pyramid ladder via workSegmentsJson.",
  },
  {
    name: "Tempo",
    workoutType: "Tempo",
    description: null,
    workSegmentsJson: null,
    warmupFraction: null,
    workFraction: null,
    cooldownFraction: null,
    paceAnchor: PACE_ANCHOR_CURRENT_BUILDUP,
    mpFraction: null,
    mpTotalMiles: null,
    mpPaceOffsetSecPerMile: null,
    mpBlockPosition: null,
    mpBlockProgression: "flat",
    workBaseReps: null,
    workBaseRepMeters: null,
    workBaseMiles: null,
    recoveryDistanceMeters: null,
    warmupMiles: 1.5,
    warmupPaceOffsetSecPerMile: null,
    cooldownMiles: 1.0,
    cooldownPaceOffsetSecPerMile: null,
    workPaceOffsetSecPerMile: 30,
    workBasePaceOffsetSecPerMile: null,
    recoveryPaceOffsetSecPerMile: null,
    notes: null,
  },
  {
    name: "Interval",
    workoutType: "Intervals",
    description: null,
    workSegmentsJson: null,
    warmupFraction: null,
    workFraction: null,
    cooldownFraction: null,
    paceAnchor: PACE_ANCHOR_CURRENT_BUILDUP,
    mpFraction: null,
    mpTotalMiles: null,
    mpPaceOffsetSecPerMile: null,
    mpBlockPosition: null,
    mpBlockProgression: "flat",
    workBaseReps: 6,
    workBaseRepMeters: 800,
    workBaseMiles: null,
    recoveryDistanceMeters: null,
    warmupMiles: 1.5,
    warmupPaceOffsetSecPerMile: null,
    cooldownMiles: 1.5,
    cooldownPaceOffsetSecPerMile: null,
    workPaceOffsetSecPerMile: null,
    workBasePaceOffsetSecPerMile: -30,
    recoveryPaceOffsetSecPerMile: null,
    notes: null,
  },
  {
    name: "Long Run",
    workoutType: "LongRun",
    description: null,
    workSegmentsJson: null,
    warmupFraction: null,
    workFraction: null,
    cooldownFraction: null,
    paceAnchor: PACE_ANCHOR_CURRENT_BUILDUP,
    mpFraction: null,
    mpTotalMiles: null,
    mpPaceOffsetSecPerMile: null,
    mpBlockPosition: null,
    mpBlockProgression: "flat",
    workBaseReps: null,
    workBaseRepMeters: null,
    workBaseMiles: null,
    recoveryDistanceMeters: null,
    warmupMiles: null,
    warmupPaceOffsetSecPerMile: null,
    cooldownMiles: null,
    cooldownPaceOffsetSecPerMile: null,
    workPaceOffsetSecPerMile: 90,
    workBasePaceOffsetSecPerMile: null,
    recoveryPaceOffsetSecPerMile: null,
    notes: null,
  },
  {
    name: "Long Run Quality",
    runSubType: "mp-block",
    workoutType: "LongRun",
    description:
      "Easy first; final block at imprinted goal race pace. mpFraction scales with plan cycle index.",
    workSegmentsJson: null,
    warmupFraction: null,
    workFraction: null,
    cooldownFraction: null,
    paceAnchor: PACE_ANCHOR_MP_SIMULATION,
    mpFraction: 0.4,
    mpTotalMiles: null,
    mpPaceOffsetSecPerMile: null,
    mpBlockPosition: "BACK_HALF",
    mpBlockProgression: "flat",
    workBaseReps: null,
    workBaseRepMeters: null,
    workBaseMiles: null,
    recoveryDistanceMeters: null,
    warmupMiles: null,
    warmupPaceOffsetSecPerMile: null,
    cooldownMiles: null,
    cooldownPaceOffsetSecPerMile: null,
    workPaceOffsetSecPerMile: 0,
    workBasePaceOffsetSecPerMile: null,
    recoveryPaceOffsetSecPerMile: null,
    notes:
      "Easy first; final block at imprinted goal race pace. mpFraction scales with plan cycle index.",
  },
  {
    name: "Marathon Test",
    workoutType: "LongRun",
    runSubType: "marathon-test",
    description: "Peak long run with larger goal-pace block.",
    workSegmentsJson: null,
    warmupFraction: null,
    workFraction: null,
    cooldownFraction: null,
    paceAnchor: PACE_ANCHOR_MP_SIMULATION,
    mpFraction: 0.55,
    mpTotalMiles: null,
    mpPaceOffsetSecPerMile: null,
    mpBlockPosition: "BACK_HALF",
    mpBlockProgression: "flat",
    workBaseReps: null,
    workBaseRepMeters: null,
    workBaseMiles: null,
    recoveryDistanceMeters: null,
    warmupMiles: null,
    warmupPaceOffsetSecPerMile: null,
    cooldownMiles: null,
    cooldownPaceOffsetSecPerMile: null,
    workPaceOffsetSecPerMile: 0,
    workBasePaceOffsetSecPerMile: null,
    recoveryPaceOffsetSecPerMile: null,
    notes: "Peak long run with larger goal-pace block.",
  },
  {
    name: "Easy Run",
    workoutType: "Easy",
    description: null,
    workSegmentsJson: null,
    warmupFraction: null,
    workFraction: null,
    cooldownFraction: null,
    paceAnchor: PACE_ANCHOR_CURRENT_BUILDUP,
    mpFraction: null,
    mpTotalMiles: null,
    mpPaceOffsetSecPerMile: null,
    mpBlockPosition: null,
    mpBlockProgression: "flat",
    workBaseReps: null,
    workBaseRepMeters: null,
    workBaseMiles: null,
    recoveryDistanceMeters: null,
    warmupMiles: null,
    warmupPaceOffsetSecPerMile: null,
    cooldownMiles: null,
    cooldownPaceOffsetSecPerMile: null,
    workPaceOffsetSecPerMile: 120,
    workBasePaceOffsetSecPerMile: null,
    recoveryPaceOffsetSecPerMile: null,
    notes: null,
  },
];
