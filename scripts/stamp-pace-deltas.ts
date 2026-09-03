/**
 * Stamp lap pace deltas for a matched workout (backfill / repair).
 *
 * Usage:
 *   node scripts/with-env-local.mjs npx tsx scripts/stamp-pace-deltas.ts --workout-id=<id>
 *   node scripts/with-env-local.mjs npx tsx scripts/stamp-pace-deltas.ts --activity-id=<id>
 */

import { prisma } from "../lib/prisma";
import { stampPaceDeltas } from "../lib/training/stamp-pace-deltas";

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() || null : null;
}

async function main() {
  const workoutId = readArg("workout-id");
  const activityId = readArg("activity-id");

  if (workoutId) {
    const workout = await prisma.workouts.findUnique({
      where: { id: workoutId },
      select: { id: true, garminDetailActivityId: true },
    });
    if (!workout?.garminDetailActivityId) {
      console.error("Workout not found or not linked to an activity");
      process.exit(1);
    }

    const lapCount = await prisma.workout_segment_laps.count({
      where: { activityId: workout.garminDetailActivityId },
    });
    if (lapCount > 0) {
      await prisma.workouts.update({
        where: { id: workout.id },
        data: { splitsStamped: true },
      });
    }

    const result = await stampPaceDeltas({
      workoutId: workout.id,
      activityId: workout.garminDetailActivityId,
    });
    console.log(JSON.stringify({ lapCount, result }, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  if (activityId) {
    const workout = await prisma.workouts.findFirst({
      where: { garminDetailActivityId: activityId },
      select: { id: true },
    });
    if (!workout) {
      console.error("No workout linked to activity");
      process.exit(1);
    }

    const lapCount = await prisma.workout_segment_laps.count({ where: { activityId } });
    if (lapCount > 0) {
      await prisma.workouts.update({
        where: { id: workout.id },
        data: { splitsStamped: true },
      });
    }

    const result = await stampPaceDeltas({ workoutId: workout.id, activityId });
    console.log(JSON.stringify({ lapCount, result }, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  console.error("Provide --workout-id=<id> or --activity-id=<id>");
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
