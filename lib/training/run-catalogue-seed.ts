import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { newEntityId } from "@/lib/training/new-entity-id";
import { generateCatalogueSlug } from "@/lib/training/catalogue-slug";
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

    const slug = row.slug ?? generateCatalogueSlug(row.name);
    const data = {
      slug,
      runSubType: row.runSubType ?? null,
      description: row.description,
      segmentPaceDist:
        row.segmentPaceDist === null
          ? Prisma.JsonNull
          : (row.segmentPaceDist as Prisma.InputJsonValue),
      warmupFraction: row.warmupFraction,
      workFraction: row.workFraction,
      cooldownFraction: row.cooldownFraction,
      paceAnchor: row.paceAnchor,
      mpFraction: row.mpFraction,
      mpTotalMiles: row.mpTotalMiles,
      mpPaceOffsetSecPerMile: row.mpPaceOffsetSecPerMile,
      mpBlockPosition: row.mpBlockPosition,
      mpBlockProgression: row.mpBlockProgression,
      workBaseReps: row.workBaseReps,
      workBaseRepMeters: row.workBaseRepMeters,
      workBaseMiles: row.workBaseMiles,
      recoveryDistanceMeters: row.recoveryDistanceMeters,
      recoveryDurationSeconds: row.recoveryDurationSeconds ?? null,
      warmupMiles: row.warmupMiles,
      warmupPaceOffsetSecPerMile: row.warmupPaceOffsetSecPerMile,
      cooldownMiles: row.cooldownMiles,
      cooldownPaceOffsetSecPerMile: row.cooldownPaceOffsetSecPerMile,
      workPaceOffsetSecPerMile: row.workPaceOffsetSecPerMile,
      workBasePaceOffsetSecPerMile: row.workBasePaceOffsetSecPerMile,
      recoveryPaceOffsetSecPerMile: row.recoveryPaceOffsetSecPerMile,
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
