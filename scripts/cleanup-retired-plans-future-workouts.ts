/**
 * Remove future unmatched workout rows left on ARCHIVED/PARKED training plans.
 * Run: npx tsx scripts/cleanup-retired-plans-future-workouts.ts [athleteId]
 *
 * Omit athleteId to clean all retired plans in the database.
 */

import {
  cleanupAllRetiredPlansFutureWorkouts,
  formatRetiredPlanCleanupSummary,
} from "../lib/training/cleanup-retired-plans-future-workouts";

async function main() {
  const athleteId = process.argv[2]?.trim() || undefined;
  if (athleteId) {
    console.log(`Scoping cleanup to athlete ${athleteId}`);
  } else {
    console.log("Cleaning future rows for all ARCHIVED/PARKED plans");
  }

  const summary = await cleanupAllRetiredPlansFutureWorkouts({ athleteId });
  console.log(formatRetiredPlanCleanupSummary(summary));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
