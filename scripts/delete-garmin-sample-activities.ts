/**
 * One-time cleanup: remove Garmin "Sample Activity" junk rows.
 * Run: npx tsx scripts/delete-garmin-sample-activities.ts
 */
import { PrismaClient } from '@prisma/client';
import { isGenericGarminActivityName } from '../lib/garmin-events/generic-activity-names';

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.athlete_activities.findMany({
    where: { source: 'garmin' },
    select: { id: true, activityName: true, athleteId: true },
  });

  const junkIds = candidates
    .filter((row) => isGenericGarminActivityName(row.activityName))
    .map((row) => row.id);

  console.log(`Found ${junkIds.length} generic Garmin sample activities to delete.`);

  if (junkIds.length === 0) {
    return;
  }

  const result = await prisma.athlete_activities.deleteMany({
    where: { id: { in: junkIds } },
  });

  console.log(`Deleted ${result.count} rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
