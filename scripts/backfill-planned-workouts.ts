#!/usr/bin/env npx tsx
/**
 * Backfill planned_workouts + planned_workout_segments from legacy plan-day workouts rows.
 * Idempotent: skips dates that already have a planned row.
 *
 * Usage: npx tsx scripts/backfill-planned-workouts.ts [--dry-run] [--plan-id=...]
 */

import { prisma } from "../lib/prisma";
import { materializeWorkoutForPlanDay } from "../lib/training/workout-materializer";
import { ymdFromDate } from "../lib/training/plan-utils";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const planIdArg = process.argv.find((a) => a.startsWith("--plan-id="));
  const planIdFilter = planIdArg?.split("=")[1]?.trim() || null;

  const legacyRows = await prisma.workouts.findMany({
    where: {
      planId: planIdFilter ? planIdFilter : { not: null },
      athleteId: { not: null },
      date: { not: null },
      plannedWorkoutId: null,
    },
    select: {
      id: true,
      athleteId: true,
      planId: true,
      date: true,
      matchedActivityId: true,
    },
    orderBy: [{ planId: "asc" }, { date: "asc" }],
  });

  console.info(`Found ${legacyRows.length} legacy plan-day workout rows to backfill`);

  let materialized = 0;
  let skipped = 0;
  let spawned = 0;
  let errors = 0;

  const seenDay = new Set<string>();

  for (const row of legacyRows) {
    if (!row.athleteId || !row.planId || !row.date) continue;
    const dateKey = ymdFromDate(row.date);
    const dayKey = `${row.athleteId}|${row.planId}|${dateKey}`;
    if (seenDay.has(dayKey)) {
      skipped++;
      continue;
    }
    seenDay.add(dayKey);

    const existingPlanned = await prisma.planned_workouts.findFirst({
      where: {
        athleteId: row.athleteId,
        planId: row.planId,
        date: row.date,
      },
      select: { id: true },
    });

    if (existingPlanned) {
      skipped++;
      if (!dryRun && row.matchedActivityId) {
        await prisma.workouts.update({
          where: { id: row.id },
          data: { plannedWorkoutId: existingPlanned.id },
        });
        spawned++;
      }
      continue;
    }

    if (dryRun) {
      materialized++;
      continue;
    }

    try {
      const result = await materializeWorkoutForPlanDay({
        planId: row.planId,
        athleteId: row.athleteId,
        dateParam: dateKey,
      });
      materialized++;

      if (row.matchedActivityId) {
        await prisma.workouts.update({
          where: { id: row.id },
          data: { plannedWorkoutId: result.plannedWorkoutId },
        });
        spawned++;
      }
    } catch (e) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`backfill failed ${dayKey}: ${msg}`);
    }
  }

  console.info("Backfill complete", { materialized, skipped, spawned, errors, dryRun });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
