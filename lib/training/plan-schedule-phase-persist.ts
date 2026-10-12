import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import type { PlanWeekPhaseSplit } from "@/lib/training/plan-week-phase-split";
import {
  isBuildWeek,
  isRaceWeek,
  isTaperWeek,
} from "@/lib/training/plan-week-phase-split";

export type PlanSchedulePhaseSlices = {
  build: PlanWeekSchedule[];
  taper: PlanWeekSchedule[];
  raceWeek: PlanWeekSchedule[];
};

export function slicePlanScheduleByPhases(
  schedule: PlanWeekSchedule[],
  split: PlanWeekPhaseSplit,
): PlanSchedulePhaseSlices {
  const build: PlanWeekSchedule[] = [];
  const taper: PlanWeekSchedule[] = [];
  const raceWeek: PlanWeekSchedule[] = [];

  for (const week of schedule) {
    if (isBuildWeek(split, week.weekNumber)) build.push(week);
    else if (isTaperWeek(split, week.weekNumber)) taper.push(week);
    else if (isRaceWeek(split, week.weekNumber)) raceWeek.push(week);
  }

  build.sort((a, b) => a.weekNumber - b.weekNumber);
  taper.sort((a, b) => a.weekNumber - b.weekNumber);
  raceWeek.sort((a, b) => a.weekNumber - b.weekNumber);

  return { build, taper, raceWeek };
}

export function mergePlanSchedulePhaseSlices(
  slices: PlanSchedulePhaseSlices,
): PlanWeekSchedule[] {
  return [...slices.build, ...slices.taper, ...slices.raceWeek].sort(
    (a, b) => a.weekNumber - b.weekNumber,
  );
}

/** Prefer merged phase columns when present; fall back to legacy planSchedule. */
export function resolvePlanScheduleFromPlanRow(row: {
  planSchedule?: unknown;
  planScheduleBuild?: unknown;
  planScheduleTaper?: unknown;
  planScheduleRaceWeek?: unknown;
}): unknown {
  const build = row.planScheduleBuild;
  const taper = row.planScheduleTaper;
  const raceWeek = row.planScheduleRaceWeek;
  const hasPhase =
    (Array.isArray(build) && build.length > 0) ||
    (Array.isArray(taper) && taper.length > 0) ||
    (Array.isArray(raceWeek) && raceWeek.length > 0);
  if (hasPhase) {
    return mergePlanSchedulePhaseSlices({
      build: (Array.isArray(build) ? build : []) as PlanWeekSchedule[],
      taper: (Array.isArray(taper) ? taper : []) as PlanWeekSchedule[],
      raceWeek: (Array.isArray(raceWeek) ? raceWeek : []) as PlanWeekSchedule[],
    });
  }
  return row.planSchedule ?? null;
}
