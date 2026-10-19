/**
 * Load training plan row for athlete-scoped ingest / day brief.
 */

import { prisma } from "@/lib/prisma";
import { planRaceScheduleContextFromPlan } from "@/lib/training/plan-race-schedule-context";
import {
  isTaperWeek,
  splitPlanWeekPhases,
} from "@/lib/training/plan-week-phase-split";
import { weekNumberFromPlanDate } from "@/lib/training/plan-schedule";
import { utcDateOnly } from "@/lib/training/plan-utils";
import { ensureStructuredPlanSchedule } from "@/lib/training/plan-week-ingest-guard";
import {
  isTaperPhaseKey,
  resolveWeekPhase,
} from "@/lib/training/plan-week-phase-key";

export type AthletePlanContext = {
  id: string;
  athleteId: string;
  startDate: Date;
  totalWeeks: number;
  planSchedule: unknown;
  taperStartWeekNumber: number | null;
  currentFiveKPace: string | null;
  name: string;
  raceCtx: ReturnType<typeof planRaceScheduleContextFromPlan>;
};

export async function loadAthletePlanContext(
  planId: string,
  athleteId: string
): Promise<AthletePlanContext | null> {
  const plan = await prisma.training_plans.findFirst({
    where: { id: planId, athleteId },
    select: {
      id: true,
      athleteId: true,
      startDate: true,
      totalWeeks: true,
      planSchedule: true,
      taperStartWeekNumber: true,
      currentFiveKPace: true,
      name: true,
      athlete_race: {
        select: {
          raceDate: true,
          name: true,
          distanceMeters: true,
          distanceLabel: true,
        },
      },
      race_registry: {
        select: {
          raceDate: true,
          name: true,
          distanceMeters: true,
          distanceLabel: true,
        },
      },
    },
  });
  if (!plan) return null;

  return {
    id: plan.id,
    athleteId: plan.athleteId,
    startDate: plan.startDate,
    totalWeeks: plan.totalWeeks,
    planSchedule: plan.planSchedule,
    taperStartWeekNumber: plan.taperStartWeekNumber,
    currentFiveKPace: plan.currentFiveKPace,
    name: plan.name,
    raceCtx: planRaceScheduleContextFromPlan(plan),
  };
}

export function weekNumberForPlanDate(plan: AthletePlanContext, dateKey: string): number {
  const d = utcDateOnly(new Date(`${dateKey}T12:00:00.000Z`));
  return weekNumberFromPlanDate(plan.startDate, d);
}

export function isWeekInTaperWindow(plan: AthletePlanContext, weekNumber: number): boolean {
  const weeks = ensureStructuredPlanSchedule(plan.planSchedule);
  const week = weeks.find((w) => w.weekNumber === weekNumber);
  if (week) {
    const phase = resolveWeekPhase(week, plan.totalWeeks);
    if (isTaperPhaseKey(phase)) return true;
    if (phase === "B" || phase === "RW") return false;
  }
  if (plan.taperStartWeekNumber != null && weekNumber >= plan.taperStartWeekNumber) {
    return weekNumber < plan.totalWeeks;
  }
  const split = splitPlanWeekPhases(plan.totalWeeks);
  return isTaperWeek(split, weekNumber);
}
