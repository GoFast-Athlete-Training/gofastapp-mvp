/**
 * Calendar week phases: build → taper (≤2 Mon–Sun weeks) → race week (last week).
 * Week numbers are 1-based, aligned with calendarTrainingWeekCount / assign-workout-days.
 */

export type PlanWeekPhaseSplit = {
  buildWeekNumbers: number[];
  taperWeekNumbers: number[];
  raceWeekNumber: number;
  /** First taper week, or totalWeeks + 1 when there is no taper. */
  taperStartWeekNumber: number;
  /** Last build week, or null when build is empty. */
  peakWeekNumber: number | null;
};

const MAX_TAPER_WEEKS = 2;

/**
 * Split `totalWeeks` into build, taper, and race slices.
 * Race week is always week `totalWeeks`. Up to two weeks immediately before it are taper.
 * Remaining weeks are build (may be empty).
 */
export function splitPlanWeekPhases(totalWeeks: number): PlanWeekPhaseSplit {
  const total = Math.max(1, Math.floor(totalWeeks));
  const raceWeekNumber = total;

  const taperWeekNumbers: number[] = [];
  const taperSlots = Math.min(MAX_TAPER_WEEKS, Math.max(0, total - 1));
  for (let i = taperSlots; i >= 1; i--) {
    const w = total - i;
    if (w >= 1) taperWeekNumbers.push(w);
  }
  taperWeekNumbers.sort((a, b) => a - b);

  const firstTaper = taperWeekNumbers[0] ?? null;
  const taperStartWeekNumber = firstTaper ?? total + 1;

  const lastBuildWeek = firstTaper != null ? firstTaper - 1 : total - 1;
  const buildWeekNumbers =
    lastBuildWeek >= 1
      ? Array.from({ length: lastBuildWeek }, (_, i) => i + 1)
      : [];

  const peakWeekNumber =
    buildWeekNumbers.length > 0
      ? buildWeekNumbers[buildWeekNumbers.length - 1]!
      : null;

  return {
    buildWeekNumbers,
    taperWeekNumbers,
    raceWeekNumber,
    taperStartWeekNumber,
    peakWeekNumber,
  };
}

export function isBuildWeek(split: PlanWeekPhaseSplit, weekNumber: number): boolean {
  return split.buildWeekNumbers.includes(weekNumber);
}

export function isTaperWeek(split: PlanWeekPhaseSplit, weekNumber: number): boolean {
  return split.taperWeekNumbers.includes(weekNumber);
}

export function isRaceWeek(split: PlanWeekPhaseSplit, weekNumber: number): boolean {
  return weekNumber === split.raceWeekNumber;
}

/** Preset taper weekIndex (1-based) for a calendar taper week number. */
export function taperPresetWeekIndex(
  split: PlanWeekPhaseSplit,
  weekNumber: number,
): number | null {
  const idx = split.taperWeekNumbers.indexOf(weekNumber);
  return idx >= 0 ? idx + 1 : null;
}
