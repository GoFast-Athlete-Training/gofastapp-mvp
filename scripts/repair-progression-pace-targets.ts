/**
 * Backfill null preset paceProfile and rematerialize one progression long run.
 *
 * Usage:
 *   npx tsx scripts/repair-progression-pace-targets.ts
 *   npx tsx scripts/repair-progression-pace-targets.ts --dry-run
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { defaultPaceProfileForCapability } from "../lib/training/preset-strategy";
import { materializeWorkoutForPlanDay } from "../lib/training/workout-materializer";
import { ymdFromDate } from "../lib/training/plan-utils";

const PRESET_ID = "cmohyxfcw0000l704gc3qqxof";
const WORKOUT_ID = "cmt4d15qq0001l5040y0z6z9c";

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const profile = defaultPaceProfileForCapability(null);

  if (dryRun) {
    console.info("[dry-run] would backfill preset", PRESET_ID, profile);
  } else {
    await prisma.training_plan_preset.update({
      where: { id: PRESET_ID },
      data: { paceProfile: profile, updatedAt: new Date() },
    });
    console.info("[repair-progression-pace-targets] backfilled preset", PRESET_ID);
  }

  const workout = await prisma.workouts.findUnique({
    where: { id: WORKOUT_ID },
    select: { id: true, athleteId: true, planId: true, date: true },
  });
  if (!workout?.athleteId || !workout.planId || !workout.date) {
    throw new Error(`Workout ${WORKOUT_ID} missing plan context`);
  }
  const dateYmd = ymdFromDate(workout.date);

  if (dryRun) {
    console.info("[dry-run] would rematerialize", WORKOUT_ID, dateYmd);
    return;
  }

  await prisma.$transaction([
    prisma.workout_segments.deleteMany({ where: { workoutId: WORKOUT_ID } }),
    prisma.workouts.update({
      where: { id: WORKOUT_ID },
      data: { segmentSnapshotJson: Prisma.DbNull, updatedAt: new Date() },
    }),
  ]);

  const result = await materializeWorkoutForPlanDay({
    planId: workout.planId,
    athleteId: workout.athleteId,
    dateParam: dateYmd,
  });
  console.info("[repair-progression-pace-targets] rematerialized", WORKOUT_ID, result.status);

  const repaired = await prisma.workouts.findUnique({
    where: { id: WORKOUT_ID },
    select: {
      estimatedDistanceInMeters: true,
      segments: {
        orderBy: { stepOrder: "asc" },
        select: { stepOrder: true, title: true, durationValue: true, targets: true },
      },
    },
  });
  console.info(JSON.stringify(repaired, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
