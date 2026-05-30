/**
 * Re-run activity-to-segment parsing for matched workouts with stored detail.
 *
 * Usage:
 *   npx tsx scripts/reprocess-activity-segment-execution.ts
 *   npx tsx scripts/reprocess-activity-segment-execution.ts --workout-id=<id>
 *   npx tsx scripts/reprocess-activity-segment-execution.ts --activity-id=<id>
 */

import { prisma } from "../lib/prisma";
import { parseActivityToSegmentExecution } from "../lib/training/activity-to-segment-execution";

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
      select: { id: true, matchedActivityId: true },
    });
    if (!workout?.matchedActivityId) {
      console.error("Workout not found or not matched to an activity");
      process.exit(1);
    }
    const result = await parseActivityToSegmentExecution({
      activityId: workout.matchedActivityId,
      workoutId: workout.id,
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  if (activityId) {
    const result = await parseActivityToSegmentExecution({ activityId });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  const rows = await prisma.workouts.findMany({
    where: {
      matchedActivityId: { not: null },
      matched_activity: {
        detailData: { not: null },
      },
    },
    select: {
      id: true,
      matchedActivityId: true,
      title: true,
    },
    take: 200,
    orderBy: { updatedAt: "desc" },
  });

  let aligned = 0;
  let failed = 0;
  for (const row of rows) {
    if (!row.matchedActivityId) continue;
    const result = await parseActivityToSegmentExecution({
      activityId: row.matchedActivityId,
      workoutId: row.id,
    });
    console.log(
      result.ok ? "ALIGNED" : result.status,
      row.id,
      row.title ?? "",
      result.ok
        ? `laps=${result.lapCount}`
        : "message" in result
          ? result.message
          : ""
    );
    if (result.ok) aligned++;
    else failed++;
  }

  console.log(`Done. aligned=${aligned} failed=${failed} total=${rows.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
