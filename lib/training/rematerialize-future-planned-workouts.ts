/**
 * After adaptive 5K updates, rematerialize future planned_workout rows only.
 * Spawned instance copies are never rewritten.
 */

import { prisma } from "@/lib/prisma";
import { utcDateOnly, ymdFromDate } from "./plan-utils";
import { materializeWorkoutForPlanDay } from "./workout-materializer";

export async function rematerializeFuturePlannedWorkoutsForPlan(params: {
  athleteId: string;
  planId: string;
  /** Only rematerialize on/after this calendar day (default: tomorrow UTC). */
  fromDateKey?: string;
}): Promise<{ rematerialized: number; skipped: number; errors: string[] }> {
  const fromKey =
    params.fromDateKey?.trim() ||
    ymdFromDate(
      (() => {
        const t = utcDateOnly(new Date());
        t.setUTCDate(t.getUTCDate() + 1);
        return t;
      })()
    );

  const fromDate = new Date(`${fromKey}T12:00:00.000Z`);

  const futurePlanned = await prisma.planned_workouts.findMany({
    where: {
      athleteId: params.athleteId,
      planId: params.planId,
      date: { gte: fromDate },
    },
    select: { date: true },
    orderBy: { date: "asc" },
  });

  let rematerialized = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of futurePlanned) {
    const dateKey = ymdFromDate(row.date);
    try {
      const result = await materializeWorkoutForPlanDay({
        planId: params.planId,
        athleteId: params.athleteId,
        dateParam: dateKey,
      });
      if (result.status === "materialized") rematerialized++;
      else skipped++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${dateKey}: ${msg}`);
    }
  }

  return { rematerialized, skipped, errors };
}
