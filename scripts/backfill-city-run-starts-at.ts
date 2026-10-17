/**
 * Backfill city_runs.startsAt + timezone from date + start clock fields.
 *
 * Usage: npx tsx scripts/backfill-city-run-starts-at.ts
 */
import { prisma } from '../lib/prisma';
import { computeCityRunStartsAt } from '../lib/city-run/city-run-starts-at-setter';

async function main() {
  const runs = await prisma.city_runs.findMany({
    select: {
      id: true,
      date: true,
      startTimeHour: true,
      startTimeMinute: true,
      startTimePeriod: true,
      timezone: true,
      citySlug: true,
      startsAt: true,
    },
  });

  let updated = 0;
  for (const run of runs) {
    const { timezone, startsAt } = computeCityRunStartsAt({
      date: run.date,
      startTimeHour: run.startTimeHour,
      startTimeMinute: run.startTimeMinute,
      startTimePeriod: run.startTimePeriod,
      timezone: run.timezone,
      citySlug: run.citySlug,
    });

    if (
      run.startsAt?.getTime() === startsAt.getTime() &&
      (run.timezone?.trim() || null) === timezone
    ) {
      continue;
    }

    await prisma.city_runs.update({
      where: { id: run.id },
      data: { timezone, startsAt },
    });
    updated += 1;
  }

  console.log(`Backfilled ${updated} of ${runs.length} city_runs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
