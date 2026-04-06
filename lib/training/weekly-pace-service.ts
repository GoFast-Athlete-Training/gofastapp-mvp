/**
 * End-of-week batch: quality pace + long run + mileage → optional Athlete.fiveKPace adjustment
 * and pace_adjustment_log row for in-app notification.
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDaysUtc, utcDateOnly } from "@/lib/training/plan-utils";
import { dateForDayInWeek } from "@/lib/training/schedule-parser";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { syncAthleteFiveKPaceToActivePlan } from "@/lib/training/plan-lifecycle";

const LR_MIN_RATIO = 0.85;
const MILEAGE_MIN_PCT = 0.8;
const STRONG_QUALITY_DELTA = 5;
const MAX_ADJUST_SEC = 10;

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

export type WeeklyPaceResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; planId: string; weekNumber: number; adjustmentSecPerMile: number }
  | { ok: false; error: string };

/**
 * Analyze one plan week and optionally adjust pace + write pace_adjustment_log.
 */
export async function runWeeklyPaceAnalysis(params: {
  athleteId: string;
  planId: string;
  weekNumber: number;
}): Promise<WeeklyPaceResult> {
  const { athleteId, planId, weekNumber } = params;

  const existing = await prisma.pace_adjustment_log.findFirst({
    where: { planId, weekNumber },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, skipped: true, reason: "already_processed" };
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { fiveKPace: true },
  });
  if (!athlete?.fiveKPace?.trim()) {
    return { ok: true, skipped: true, reason: "no_five_k_pace" };
  }

  const weekWorkouts = await prisma.workouts.findMany({
    where: { athleteId, planId, weekNumber },
    select: {
      id: true,
      workoutType: true,
      matchedActivityId: true,
      estimatedDistanceInMeters: true,
      actualDistanceMeters: true,
      evaluationEligibleFlag: true,
      derivedPerformanceDeltaSeconds: true,
    },
  });

  if (weekWorkouts.length === 0) {
    return { ok: true, skipped: true, reason: "no_workouts_in_week" };
  }

  const quality = weekWorkouts.filter(
    (w) =>
      (w.workoutType === "Tempo" || w.workoutType === "Intervals") &&
      w.evaluationEligibleFlag &&
      w.derivedPerformanceDeltaSeconds != null
  );
  const qualityDeltas = quality.map((w) => w.derivedPerformanceDeltaSeconds!);
  const qualityCount = qualityDeltas.length;
  const qualityAvgDelta =
    qualityCount > 0
      ? Math.round(
          qualityDeltas.reduce((a, b) => a + b, 0) / qualityCount
        )
      : null;

  const longRun = weekWorkouts.find((w) => w.workoutType === "LongRun");
  let longRunCompleted = false;
  let longRunCompletionRatio: number | null = null;
  if (
    longRun?.matchedActivityId &&
    longRun.estimatedDistanceInMeters != null &&
    longRun.estimatedDistanceInMeters > 0 &&
    longRun.actualDistanceMeters != null &&
    longRun.actualDistanceMeters > 0
  ) {
    longRunCompleted = true;
    longRunCompletionRatio =
      longRun.actualDistanceMeters / longRun.estimatedDistanceInMeters;
  }

  let plannedMeters = 0;
  let actualMeters = 0;
  for (const w of weekWorkouts) {
    if (w.estimatedDistanceInMeters != null && w.estimatedDistanceInMeters > 0) {
      plannedMeters += w.estimatedDistanceInMeters;
    }
    if (w.matchedActivityId && w.actualDistanceMeters != null && w.actualDistanceMeters > 0) {
      actualMeters += w.actualDistanceMeters;
    }
  }
  const weeklyMileageCompletionPct =
    plannedMeters > 0 ? actualMeters / plannedMeters : null;

  const longRunBonus =
    longRunCompleted && longRunCompletionRatio != null && longRunCompletionRatio >= LR_MIN_RATIO;
  const mileageBonus =
    weeklyMileageCompletionPct != null && weeklyMileageCompletionPct >= MILEAGE_MIN_PCT;

  if (qualityCount === 0 && !longRunCompleted) {
    return { ok: true, skipped: true, reason: "insufficient_data" };
  }

  let adjustSec = 0;
  if (
    qualityCount >= 1 &&
    qualityAvgDelta != null &&
    qualityAvgDelta >= STRONG_QUALITY_DELTA &&
    (longRunBonus || mileageBonus)
  ) {
    adjustSec = 5;
  } else if (
    qualityCount >= 1 &&
    qualityAvgDelta != null &&
    qualityAvgDelta >= 0 &&
    longRunBonus &&
    mileageBonus
  ) {
    adjustSec = 3;
  }

  adjustSec = Math.min(adjustSec, MAX_ADJUST_SEC);

  const rawPrev = athlete.fiveKPace!.trim();
  const previousSec = parsePaceToSecondsPerMile(rawPrev);

  if (adjustSec <= 0) {
    await prisma.pace_adjustment_log.create({
      data: {
        athleteId,
        planId,
        weekNumber,
        previousPaceSecPerMile: previousSec,
        newPaceSecPerMile: previousSec,
        adjustmentSecPerMile: 0,
        qualityWorkoutsCount: qualityCount,
        qualityAvgDeltaSecPerMile: qualityAvgDelta,
        longRunCompleted,
        longRunCompletionRatio,
        weeklyMileageCompletionPct,
        summaryMessage: buildNoChangeSummary({
          qualityCount,
          qualityAvgDelta,
          longRunBonus,
          mileageBonus,
        }),
      },
    });
    return { ok: true, planId, weekNumber, adjustmentSecPerMile: 0 };
  }

  const newSec = Math.max(
    previousSec - adjustSec,
    Math.floor(previousSec * 0.9)
  );
  const newPaceStr = secondsPerMileToPaceString(newSec);
  const summaryMessage = `Based on last week (${qualityCount} quality workout${qualityCount === 1 ? "" : "s"}${longRunCompleted ? ", long run done" : ""}${mileageBonus ? ", strong mileage" : ""}), your 5K pace is now ${newPaceStr}.`;

  await prisma.$transaction(async (tx) => {
    await tx.athlete.update({
      where: { id: athleteId },
      data: { fiveKPace: newPaceStr, updatedAt: new Date() },
    });
    await tx.pace_adjustment_log.create({
      data: {
        athleteId,
        planId,
        weekNumber,
        previousPaceSecPerMile: previousSec,
        newPaceSecPerMile: newSec,
        adjustmentSecPerMile: previousSec - newSec,
        qualityWorkoutsCount: qualityCount,
        qualityAvgDeltaSecPerMile: qualityAvgDelta,
        longRunCompleted,
        longRunCompletionRatio,
        weeklyMileageCompletionPct,
        summaryMessage,
      },
    });
  });

  await syncAthleteFiveKPaceToActivePlan(athleteId);

  return { ok: true, planId, weekNumber, adjustmentSecPerMile: previousSec - newSec };
}

function buildNoChangeSummary(p: {
  qualityCount: number;
  qualityAvgDelta: number | null;
  longRunBonus: boolean;
  mileageBonus: boolean;
}): string {
  if (p.qualityCount === 0) {
    return "Weekly review: not enough quality pace data to adjust your 5K pace yet.";
  }
  return `Weekly review: no pace change this week (quality avg ${p.qualityAvgDelta ?? 0}s/mi vs targets; volume checks: long run ${p.longRunBonus ? "met" : "not met"}, mileage ${p.mileageBonus ? "met" : "not met"}).`;
}

/**
 * Cron entry: for each ACTIVE plan, if the training week that ended last Sunday matches a plan
 * week N, run analysis for that N.
 */
export async function runWeeklyPaceBatchForActivePlans(now: Date = new Date()): Promise<{
  plansChecked: number;
  results: WeeklyPaceResult[];
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

  const results: WeeklyPaceResult[] = [];

  for (const plan of plans) {
    const weekNumber = planWeekNumberEndingOnSunday(
      plan.startDate,
      endingSunday,
      plan.totalWeeks
    );
    if (weekNumber == null) continue;

    const r = await runWeeklyPaceAnalysis({
      athleteId: plan.athleteId,
      planId: plan.id,
      weekNumber,
    });
    results.push(r);
  }

  return { plansChecked: plans.length, results };
}
