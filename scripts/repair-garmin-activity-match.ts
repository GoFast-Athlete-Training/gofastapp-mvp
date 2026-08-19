/**
 * Re-run planned-workout matching for one Garmin activity.
 *
 * Usage:
 *   npx tsx scripts/repair-garmin-activity-match.ts --activity-id=<id>
 */

import { prisma } from "../lib/prisma";
import { tryMatchActivityToTrainingWorkout } from "../lib/training/match-activity-to-workout";

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() || null : null;
}

async function main() {
  const activityId = readArg("activity-id");
  if (!activityId) {
    console.error("Usage: npx tsx scripts/repair-garmin-activity-match.ts --activity-id=<id>");
    process.exit(1);
  }

  const result = await tryMatchActivityToTrainingWorkout(activityId);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.matched ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
