/**
 * B / T / RW phase stamped on each planSchedule week (same split as splitPlanWeekPhases).
 */

import type {
  PlanWeekPhaseKey,
  PlanWeekSchedule,
} from "@/lib/training/plan-schedule-schema";
import {
  isRaceWeek,
  isTaperWeek,
  splitPlanWeekPhases,
} from "@/lib/training/plan-week-phase-split";

export type { PlanWeekPhaseKey };

export function planWeekPhaseForNumber(
  totalWeeks: number,
  weekNumber: number,
): PlanWeekPhaseKey {
  const split = splitPlanWeekPhases(totalWeeks);
  if (isRaceWeek(split, weekNumber)) return "RW";
  if (isTaperWeek(split, weekNumber)) return "T";
  return "B";
}

export function stampPhaseOnPlanSchedule(
  schedule: PlanWeekSchedule[],
  totalWeeks: number,
): PlanWeekSchedule[] {
  for (const week of schedule) {
    week.phase = planWeekPhaseForNumber(totalWeeks, week.weekNumber);
  }
  return schedule;
}

export function resolveWeekPhase(
  week: PlanWeekSchedule,
  totalWeeks: number,
): PlanWeekPhaseKey {
  if (week.phase === "B" || week.phase === "T" || week.phase === "RW") {
    return week.phase;
  }
  return planWeekPhaseForNumber(totalWeeks, week.weekNumber);
}

export function planWeekPhaseUxLabel(phase: PlanWeekPhaseKey): string {
  switch (phase) {
    case "B":
      return "Build";
    case "T":
      return "Taper";
    case "RW":
      return "Race week";
  }
}

export function isTaperPhaseKey(phase: PlanWeekPhaseKey): boolean {
  return phase === "T";
}

export function isRacePhaseKey(phase: PlanWeekPhaseKey): boolean {
  return phase === "RW";
}
