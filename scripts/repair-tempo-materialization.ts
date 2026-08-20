/**
 * Re-materialize Tempo plan workouts whose catalogue uses distanceMeters in segmentPaceDist.
 *
 * Usage:
 *   npx tsx scripts/repair-tempo-materialization.ts
 *   npx tsx scripts/repair-tempo-materialization.ts --dry-run
 *   npx tsx scripts/repair-tempo-materialization.ts --catalogue-id=<id>
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { segmentPaceDistUsesDistanceMeters } from "../lib/training/catalogue-segment-distance";
import { materializeWorkoutForPlanDay } from "../lib/training/workout-materializer";
import { ymdFromDate } from "../lib/training/plan-utils";

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() || null : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const catalogueIdFilter = readArg("catalogue-id");

  const catalogues = await prisma.workout_catalogue.findMany({
    where: {
      workoutType: "Tempo",
      ...(catalogueIdFilter ? { id: catalogueIdFilter } : {}),
    },
    select: { id: true, name: true, segmentPaceDist: true },
  });

  const targetCatalogueIds = catalogues
    .filter((c) => segmentPaceDistUsesDistanceMeters(c.segmentPaceDist))
    .map((c) => c.id);

  if (targetCatalogueIds.length === 0) {
    console.info("[repair-tempo-materialization] no Tempo catalogues with distanceMeters");
    return;
  }

  console.info("[repair-tempo-materialization] catalogues", {
    count: targetCatalogueIds.length,
    ids: targetCatalogueIds,
    dryRun,
  });

  const workouts = await prisma.workouts.findMany({
    where: {
      workoutType: "Tempo",
      planId: { not: null },
      catalogueWorkoutId: { in: targetCatalogueIds },
    },
    select: {
      id: true,
      athleteId: true,
      planId: true,
      date: true,
      catalogueWorkoutId: true,
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  console.info("[repair-tempo-materialization] workouts to repair", {
    count: workouts.length,
  });

  let repaired = 0;
  let failed = 0;

  for (const w of workouts) {
    if (!w.athleteId || !w.planId || !w.date) continue;
    const dateYmd = ymdFromDate(w.date);
    const label = `${w.id} ${dateYmd} catalogue=${w.catalogueWorkoutId}`;

    if (dryRun) {
      console.info("[dry-run] would rematerialize", label);
      repaired++;
      continue;
    }

    try {
      await prisma.$transaction([
        prisma.workout_segments.deleteMany({ where: { workoutId: w.id } }),
        prisma.workouts.update({
          where: { id: w.id },
          data: {
            segmentSnapshotJson: Prisma.DbNull,
            updatedAt: new Date(),
          },
        }),
      ]);

      const result = await materializeWorkoutForPlanDay({
        planId: w.planId,
        athleteId: w.athleteId,
        dateParam: dateYmd,
      });

      console.info("[repair-tempo-materialization] ok", label, result.status);
      repaired++;
    } catch (e) {
      failed++;
      console.error("[repair-tempo-materialization] failed", label, e);
    }
  }

  console.info("[repair-tempo-materialization] complete", {
    repaired,
    failed,
    dryRun,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
