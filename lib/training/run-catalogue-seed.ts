import type { PrismaClient } from "@prisma/client";
import { newEntityId } from "@/lib/training/new-entity-id";
import { SEED_CATALOGUE_ROWS } from "@/lib/training/catalogue-seed-rows";

export async function runCatalogueSeed(prisma: PrismaClient): Promise<{
  created: number;
  updated: number;
}> {
  const now = new Date();
  let created = 0;
  let updated = 0;

  for (const row of SEED_CATALOGUE_ROWS) {
    const existing = await prisma.workout_catalogue.findUnique({
      where: {
        name_workoutType: { name: row.name, workoutType: row.workoutType },
      },
    });

    const data = {
      intendedPhase: row.intendedPhase,
      isQuality: row.isQuality,
      isLongRunQuality: row.isLongRunQuality,
      isLadderCapable: row.isLadderCapable,
      paceAnchor: row.paceAnchor,
      mpFraction: row.mpFraction,
      mpBlockPosition: row.mpBlockPosition,
      mpBlockProgression: row.mpBlockProgression,
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
    };

    if (existing) {
      await prisma.workout_catalogue.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.workout_catalogue.create({
        data: {
          id: newEntityId(),
          name: row.name,
          workoutType: row.workoutType,
          ...data,
          intendedHeartRateZone: null,
          intendedHRBpmLow: null,
          intendedHRBpmHigh: null,
        },
      });
      created++;
    }
  }

  return { created, updated };
}
