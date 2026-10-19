/**
 * Race-day and completed-day protection for week-scope plan ingest.
 */

import { prisma } from "@/lib/prisma";
import type { AthletePlanContext } from "@/lib/training/plan-ingest-plan-context";
import type { PlanDaySchedule, PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import { isStructuredPlanWeek } from "@/lib/training/plan-schedule-schema";
import { weekBoundsFromPlan } from "@/lib/training/plan-schedule";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import { utcDateOnly, ymdFromDate } from "@/lib/training/plan-utils";
import { WorkoutType as WT } from "@prisma/client";

export function ensureStructuredPlanSchedule(planSchedule: unknown): PlanWeekSchedule[] {
  if (!Array.isArray(planSchedule)) return [];
  const out: PlanWeekSchedule[] = [];
  for (const w of planSchedule) {
    if (isStructuredPlanWeek(w)) out.push(w);
  }
  return out.sort((a, b) => a.weekNumber - b.weekNumber);
}

export function dateKeyForWeekDay(
  planStartDate: Date,
  weekNumber: number,
  dow: number
): string {
  return ymdFromDate(dateForDayInWeek(planStartDate, weekNumber, dow));
}

export function dateKeyInWeekBounds(
  dateKey: string,
  weekStart: Date,
  weekEnd: Date
): boolean {
  const d = utcDateOnly(new Date(`${dateKey}T12:00:00.000Z`));
  const start = utcDateOnly(weekStart);
  const end = utcDateOnly(weekEnd);
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

export async function loadProtectedDateKeysForWeek(params: {
  planId: string;
  athleteId: string;
  startDate: Date;
  weekNumber: number;
  totalWeeks: number;
  raceDate: Date | null;
}): Promise<Set<string>> {
  const bounds = weekBoundsFromPlan(params.startDate, params.weekNumber, {
    raceDate: params.raceDate,
    totalWeeks: params.totalWeeks,
  });
  const protectedKeys = new Set<string>();

  if (params.raceDate) {
    const raceKey = ymdFromDate(utcDateOnly(params.raceDate));
    if (dateKeyInWeekBounds(raceKey, bounds.weekStart, bounds.weekEnd)) {
      protectedKeys.add(raceKey);
    }
  }

  const planned = await prisma.planned_workouts.findMany({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      date: { gte: bounds.weekStart, lte: bounds.weekEnd },
      OR: [{ workoutCompleted: true }, { workoutId: { not: null } }],
    },
    select: { date: true },
  });

  for (const row of planned) {
    protectedKeys.add(ymdFromDate(utcDateOnly(row.date)));
  }

  return protectedKeys;
}

export function mergeWeekIngestWithGuard(params: {
  incoming: PlanWeekSchedule;
  existingSchedule: unknown;
  planStartDate: Date;
  weekNumber: number;
  protectedDateKeys: Set<string>;
  skippedNotes: string[];
}): PlanWeekSchedule {
  const existingWeeks = ensureStructuredPlanSchedule(params.existingSchedule);
  const existingWeek = existingWeeks.find((w) => w.weekNumber === params.weekNumber);

  const byDow = new Map<number, PlanDaySchedule>();

  for (const day of params.incoming.days) {
    const dateKey = dateKeyForWeekDay(params.planStartDate, params.weekNumber, day.dow);
    if (day.workoutType === WT.Race) {
      params.skippedNotes.push(`Skipped ${dateKey}: race workout (use My Race for race day)`);
      continue;
    }
    if (params.protectedDateKeys.has(dateKey)) {
      params.skippedNotes.push(`Skipped ${dateKey}: protected (race or already completed)`);
      continue;
    }
    byDow.set(day.dow, day);
  }

  if (existingWeek) {
    for (const day of existingWeek.days) {
      const dateKey = dateKeyForWeekDay(params.planStartDate, params.weekNumber, day.dow);
      if (params.protectedDateKeys.has(dateKey) && !byDow.has(day.dow)) {
        byDow.set(day.dow, day);
      }
    }
  }

  const days = [...byDow.values()].sort((a, b) => a.dow - b.dow);
  return { weekNumber: params.weekNumber, days };
}

export async function applyWeekIngestGuard(params: {
  plan: AthletePlanContext;
  weekNumber: number;
  incomingWeek: PlanWeekSchedule;
}): Promise<{
  week: PlanWeekSchedule;
  skippedNotes: string[];
  protectedDateKeys: Set<string>;
}> {
  const protectedDateKeys = await loadProtectedDateKeysForWeek({
    planId: params.plan.id,
    athleteId: params.plan.athleteId,
    startDate: params.plan.startDate,
    weekNumber: params.weekNumber,
    totalWeeks: params.plan.totalWeeks,
    raceDate: params.plan.raceCtx.raceDate,
  });

  const skippedNotes: string[] = [];
  const week = mergeWeekIngestWithGuard({
    incoming: { ...params.incomingWeek, weekNumber: params.weekNumber },
    existingSchedule: params.plan.planSchedule,
    planStartDate: params.plan.startDate,
    weekNumber: params.weekNumber,
    protectedDateKeys,
    skippedNotes,
  });

  return { week, skippedNotes, protectedDateKeys };
}

export function appendSkippedToSummary(baseSummary: string, skippedNotes: string[]): string {
  if (skippedNotes.length === 0) return baseSummary;
  return `${baseSummary}. Skipped: ${skippedNotes.join("; ")}`;
}
