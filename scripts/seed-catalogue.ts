/**
 * One-time upsert of canonical workout_catalogue rows (local/staging/prod).
 * Run: npx tsx scripts/seed-catalogue.ts
 */
import type { WorkoutType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { newEntityId } from "../lib/training/new-entity-id";

const now = new Date();

type SeedRow = {
  name: string;
  workoutType: WorkoutType;
  intendedPhase: string[];
  isQuality: boolean;
  isLadderCapable: boolean;
  ladderStepMeters: number | null;
  minLadderMeters: number | null;
  maxLadderMeters: number | null;
  progressionIndex: number | null;
  reps: number | null;
  repDistanceMeters: number | null;
  recoveryDistanceMeters: number | null;
  warmupMiles: number | null;
  cooldownMiles: number | null;
  repPaceOffsetSecPerMile: number | null;
  recoveryPaceOffsetSecPerMile: number | null;
  overallPaceOffsetSecPerMile: number | null;
  notes: string | null;
};

const rows: SeedRow[] = [
  {
    name: "Up and Over",
    workoutType: "Intervals",
    intendedPhase: ["base", "build", "peak"],
    isQuality: true,
    isLadderCapable: true,
    ladderStepMeters: 200,
    minLadderMeters: 200,
    maxLadderMeters: 800,
    progressionIndex: 1,
    reps: null,
    repDistanceMeters: null,
    recoveryDistanceMeters: null,
    warmupMiles: 1.5,
    cooldownMiles: 1.5,
    repPaceOffsetSecPerMile: -30,
    recoveryPaceOffsetSecPerMile: null,
    overallPaceOffsetSecPerMile: null,
    notes: "Pyramid ladder: step 200m, min 200m, max 800m.",
  },
  {
    name: "Tempo",
    workoutType: "Tempo",
    intendedPhase: ["base", "build", "peak"],
    isQuality: true,
    isLadderCapable: false,
    ladderStepMeters: null,
    minLadderMeters: null,
    maxLadderMeters: null,
    progressionIndex: 1,
    reps: null,
    repDistanceMeters: null,
    recoveryDistanceMeters: null,
    warmupMiles: 1.5,
    cooldownMiles: 1.0,
    repPaceOffsetSecPerMile: null,
    recoveryPaceOffsetSecPerMile: null,
    overallPaceOffsetSecPerMile: 30,
    notes: null,
  },
  {
    name: "Interval",
    workoutType: "Intervals",
    intendedPhase: ["base", "build", "peak"],
    isQuality: true,
    isLadderCapable: false,
    ladderStepMeters: null,
    minLadderMeters: null,
    maxLadderMeters: null,
    progressionIndex: 2,
    reps: 6,
    repDistanceMeters: 800,
    recoveryDistanceMeters: null,
    warmupMiles: 1.5,
    cooldownMiles: 1.5,
    repPaceOffsetSecPerMile: -30,
    recoveryPaceOffsetSecPerMile: null,
    overallPaceOffsetSecPerMile: null,
    notes: null,
  },
  {
    name: "Long Run",
    workoutType: "LongRun",
    intendedPhase: ["base", "build", "peak", "taper"],
    isQuality: false,
    isLadderCapable: false,
    ladderStepMeters: null,
    minLadderMeters: null,
    maxLadderMeters: null,
    progressionIndex: 1,
    reps: null,
    repDistanceMeters: null,
    recoveryDistanceMeters: null,
    warmupMiles: null,
    cooldownMiles: null,
    repPaceOffsetSecPerMile: null,
    recoveryPaceOffsetSecPerMile: null,
    overallPaceOffsetSecPerMile: 90,
    notes: null,
  },
  {
    name: "Long Run Quality",
    workoutType: "LongRun",
    intendedPhase: ["build", "peak"],
    isQuality: true,
    isLadderCapable: false,
    ladderStepMeters: null,
    minLadderMeters: null,
    maxLadderMeters: null,
    progressionIndex: 2,
    reps: null,
    repDistanceMeters: null,
    recoveryDistanceMeters: null,
    warmupMiles: null,
    cooldownMiles: null,
    repPaceOffsetSecPerMile: null,
    recoveryPaceOffsetSecPerMile: null,
    overallPaceOffsetSecPerMile: 60,
    notes: null,
  },
  {
    name: "Marathon Test",
    workoutType: "LongRun",
    intendedPhase: ["peak"],
    isQuality: true,
    isLadderCapable: false,
    ladderStepMeters: null,
    minLadderMeters: null,
    maxLadderMeters: null,
    progressionIndex: 3,
    reps: null,
    repDistanceMeters: null,
    recoveryDistanceMeters: null,
    warmupMiles: null,
    cooldownMiles: null,
    repPaceOffsetSecPerMile: null,
    recoveryPaceOffsetSecPerMile: null,
    overallPaceOffsetSecPerMile: 45,
    notes: null,
  },
  {
    name: "Easy Run",
    workoutType: "Easy",
    intendedPhase: ["base", "build", "peak", "taper"],
    isQuality: false,
    isLadderCapable: false,
    ladderStepMeters: null,
    minLadderMeters: null,
    maxLadderMeters: null,
    progressionIndex: 1,
    reps: null,
    repDistanceMeters: null,
    recoveryDistanceMeters: null,
    warmupMiles: null,
    cooldownMiles: null,
    repPaceOffsetSecPerMile: null,
    recoveryPaceOffsetSecPerMile: null,
    overallPaceOffsetSecPerMile: 120,
    notes: null,
  },
];

async function main() {
  for (const row of rows) {
    await prisma.workout_catalogue.upsert({
      where: {
        name_workoutType: {
          name: row.name,
          workoutType: row.workoutType,
        },
      },
      create: {
        id: newEntityId(),
        name: row.name,
        workoutType: row.workoutType,
        intendedPhase: row.intendedPhase,
        isQuality: row.isQuality,
        isLadderCapable: row.isLadderCapable,
        ladderStepMeters: row.ladderStepMeters,
        minLadderMeters: row.minLadderMeters,
        maxLadderMeters: row.maxLadderMeters,
        progressionIndex: row.progressionIndex,
        reps: row.reps,
        repDistanceMeters: row.repDistanceMeters,
        recoveryDistanceMeters: row.recoveryDistanceMeters,
        warmupMiles: row.warmupMiles,
        cooldownMiles: row.cooldownMiles,
        repPaceOffsetSecPerMile: row.repPaceOffsetSecPerMile,
        recoveryPaceOffsetSecPerMile: row.recoveryPaceOffsetSecPerMile,
        overallPaceOffsetSecPerMile: row.overallPaceOffsetSecPerMile,
        intendedHeartRateZone: null,
        intendedHRBpmLow: null,
        intendedHRBpmHigh: null,
        notes: row.notes,
        updatedAt: now,
      },
      update: {
        intendedPhase: row.intendedPhase,
        isQuality: row.isQuality,
        isLadderCapable: row.isLadderCapable,
        ladderStepMeters: row.ladderStepMeters,
        minLadderMeters: row.minLadderMeters,
        maxLadderMeters: row.maxLadderMeters,
        progressionIndex: row.progressionIndex,
        reps: row.reps,
        repDistanceMeters: row.repDistanceMeters,
        recoveryDistanceMeters: row.recoveryDistanceMeters,
        warmupMiles: row.warmupMiles,
        cooldownMiles: row.cooldownMiles,
        repPaceOffsetSecPerMile: row.repPaceOffsetSecPerMile,
        recoveryPaceOffsetSecPerMile: row.recoveryPaceOffsetSecPerMile,
        overallPaceOffsetSecPerMile: row.overallPaceOffsetSecPerMile,
        notes: row.notes,
        updatedAt: now,
      },
    });
  }
  console.log(`Upserted ${rows.length} catalogue rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
