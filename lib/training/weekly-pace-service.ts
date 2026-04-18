/**
 * Weekly cron: writes a recap notification only (no pace math — credits run per-workout on match).
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDaysUtc, utcDateOnly } from "@/lib/training/plan-utils";
import { dateForDayInWeek } from "@/lib/training/schedule-parser";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { loadWeekPerformanceSnapshot } from "@/lib/training/week-performance-metrics";

function secondsPerMileToPaceString(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${minutes}:${s.toString().padStart(2, "0")}`;
}

/** UTC date of the most recent Sunday on or before `date` (training week ends Sunday). */
export function utcSundayEndingWeekContaining(date: Date): Date {
  const x = utcDateOnly(date);
  const day = x.getUTCDay();
  const daysToSubtract = day === 0 ? 0 : day;
  return addDaysUtc(x, -daysToSubtract);
}

/** Which plan week (1-based) ends on `endingSunday` UTC midnight, or null. */
export function planWeekNumberEndingOnSunday(
  planStartDate: Date,
  endingSunday: Date,
  maxWeek: number
): number | null {
  const target = utcDateOnly(endingSunday).getTime();
  for (let w = 1; w <= maxWeek; w++) {
    const mon = dateForDayInWeek(planStartDate, w, 1);
    const sun = addDaysUtc(mon, 6);
    if (utcDateOnly(sun).getTime() === target) return w;
  }
  return null;
}

export type WeeklySummaryResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; planId: string; weekNumber: number }
  | { ok: false; error: string };

const WEEKLY_RECAP_PREFIX = "Weekly recap —";

/**
 * End-of-week wrap-up: one pace_adjustment_log row with adjustment 0 and a human summary only.
 */
export async function generateWeeklySummary(params: {
  athleteId: string;
  planId: string;
  weekNumber: number;
}): Promise<WeeklySummaryResult> {
  const { athleteId, planId, weekNumber } = params;

  const existing = await prisma.pace_adjustment_log.findFirst({
    where: {
      planId,
      weekNumber,
      summaryMessage: { startsWith: WEEKLY_RECAP_PREFIX },
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, skipped: true, reason: "already_summarized" };
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { fiveKPace: true },
  });
  if (!athlete?.fiveKPace?.trim()) {
    return { ok: true, skipped: true, reason: "no_five_k_pace" };
  }

  const currentSec = parsePaceToSecondsPerMile(athlete.fiveKPace.trim());
  const paceDisplay = `${secondsPerMileToPaceString(currentSec)}/mi`;

  const plan = await prisma.training_plans.findFirst({
    where: { id: planId, athleteId },
    select: {
      startDate: true,
      totalWeeks: true,
      race_registry: { select: { raceDate: true } },
    },
  });
  if (!plan) {
    return { ok: true, skipped: true, reason: "plan_not_found" };
  }

  const metrics = await loadWeekPerformanceSnapshot({
    planId,
    athleteId,
    planStartDate: plan.startDate,
    weekNumber,
    storedTotalWeeks: plan.totalWeeks,
    raceDate: plan.race_registry?.raceDate ?? null,
  });

  if (metrics.sessionsPlanned === 0) {
    return { ok: true, skipped: true, reason: "no_workouts_in_week" };
  }

  const miLogged =
    metrics.actualMetersMatched > 0
      ? (metrics.actualMetersMatched / 1609.34).toFixed(1)
      : "0";

  const qualityLine =
    metrics.qualityAvgDeltaSecPerMile != null
      ? ` Quality avg vs target: ${metrics.qualityAvgDeltaSecPerMile > 0 ? "+" : ""}${metrics.qualityAvgDeltaSecPerMile} sec/mi.`
      : "";

  const summaryMessage = `${WEEKLY_RECAP_PREFIX} Week ${weekNumber}: ${metrics.sessionsCompleted} of ${metrics.sessionsPlanned} sessions logged, ~${miLogged} mi${metrics.longRunCompleted ? ", long run done" : ""}.${qualityLine} Your current 5K pace is ${paceDisplay}.`;

  await prisma.pace_adjustment_log.create({
    data: {
      athleteId,
      planId,
      weekNumber,
      previousPaceSecPerMile: currentSec,
      newPaceSecPerMile: currentSec,
      adjustmentSecPerMile: 0,
      qualityWorkoutsCount: metrics.qualitySessionsCompleted,
      qualityAvgDeltaSecPerMile: metrics.qualityAvgDeltaSecPerMile,
      longRunCompleted: metrics.longRunCompleted,
      longRunCompletionRatio: metrics.longRunCompletionRatio,
      weeklyMileageCompletionPct: metrics.weeklyMileageCompletionPct,
      summaryMessage,
    },
  });

  return { ok: true, planId, weekNumber };
}

/**
 * Cron entry: for each ACTIVE plan, write a weekly recap for the plan week that ended last Sunday.
 */
export async function runWeeklyPaceBatchForActivePlans(now: Date = new Date()): Promise<{
  plansChecked: number;
  results: WeeklySummaryResult[];
}> {
  const yesterday = addDaysUtc(utcDateOnly(now), -1);
  const endingSunday = utcSundayEndingWeekContaining(yesterday);

  const plans = await prisma.training_plans.findMany({
    where: { lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
    select: {
      id: true,
      athleteId: true,
      startDate: true,
      totalWeeks: true,
    },
  });

  const results: WeeklySummaryResult[] = [];

  for (const plan of plans) {
    const weekNumber = planWeekNumberEndingOnSunday(
      plan.startDate,
      endingSunday,
      plan.totalWeeks
    );
    if (weekNumber == null) continue;

    const r = await generateWeeklySummary({
      athleteId: plan.athleteId,
      planId: plan.id,
      weekNumber,
    });
    results.push(r);
  }

  return { plansChecked: plans.length, results };
}
