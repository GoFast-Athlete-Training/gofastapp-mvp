/**
 * One-time: set training_plans.totalWeeks to the effective count when the goal race
 * falls on a Monday (UTC calendar). Those plans used to store +1 "phantom" week.
 *
 * Run: npm run db:fix-monday-race-totalweeks
 *
 * Safe to re-run; only updates rows where stored totalWeeks differs from
 * calendarTrainingWeekCount(startDate, raceDate) for Monday-race fold cases.
 */

import { prisma } from "../lib/prisma";
import {
  calendarTrainingWeekCount,
  mondayRaceFoldsIntoPriorPlanWeek,
} from "../lib/training/plan-utils";

async function main(): Promise<void> {
  const plans = await prisma.training_plans.findMany({
    where: { raceId: { not: null } },
    include: { race_registry: { select: { raceDate: true } } },
  });

  let updated = 0;
  for (const p of plans) {
    const r = p.race_registry;
    if (!r?.raceDate) continue;
    if (!mondayRaceFoldsIntoPriorPlanWeek(p.startDate, r.raceDate)) continue;
    const correct = calendarTrainingWeekCount(p.startDate, r.raceDate);
    if (p.totalWeeks === correct) continue;
    const prev = p.totalWeeks;
    await prisma.training_plans.update({
      where: { id: p.id },
      data: { totalWeeks: correct, updatedAt: new Date() },
    });
    updated += 1;
    console.log(`plan ${p.id}: totalWeeks ${prev} → ${correct}`);
  }

  console.log(`Done. Updated ${updated} plan(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
