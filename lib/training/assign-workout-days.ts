/**
 * Pass 1: assign workout types to each training day (DOW placement).
 * Miles stay at 0 until long-run and tempo/interval/easy passes.
 */

import type { WorkoutType } from "@prisma/client";
import { WorkoutType as WT } from "@prisma/client";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import {
  addDaysUtc,
  mondayUtcOfWeekContaining,
  nOffsetFromWeekAnchor,
  utcDateOnly,
  ymdFromDate,
} from "@/lib/training/plan-utils";
import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import {
  peakWeekNumberFromTotal,
  taperStartWeekNumberFromTotal,
  longRunCapMilesFromPeakWeekly,
  weekCycleMeta,
} from "@/lib/training/cycle-blocks";
import type { RunTypePosition } from "@/lib/training/run-type-config-shared";

export type WorkoutDayInput = {
  planStartDate: Date;
  raceDate: Date;
  raceName: string;
  raceDistanceMiles: number;
  totalWeeks: number;
  preferredDays: number[];
  preferredLongRunDow?: number | null;
  preferredTempoDow?: number | null;
  preferredIntervalDow?: number | null;
  tempoIdealDow: number;
  intervalIdealDow: number;
  longRunDefaultDow: number;
  peakWeeklyMilesForCap: number | null;
  /** LR macro block: one long run per week for LR1..LRn; must match preset cycleLen and apply-long-run */
  longRunCycleLen: number;
  longRunPositions: readonly RunTypePosition[];
  intervalsPositions: readonly RunTypePosition[];
  tempoPositions: readonly RunTypePosition[];
  easyPositions: readonly RunTypePosition[];
};

const HARD_SESSION_SLOTS = 2;

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayKind = "tempo" | "interval" | "long" | "easy" | "race";

type SkeletonEntry = {
  kind: DayKind;
  catalogueWorkoutId: string | null;
  /** rotation index for presets */
  planCycleIndex: number | null;
};

function ourDowFromUtcDate(d: Date): number {
  const js = utcDateOnly(d).getUTCDay();
  return js === 0 ? 7 : js;
}

function circularDistOurDow(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 7 - d);
}

function normalizeLongRunOurDow(pref: number | null | undefined, defaultDow: number): number {
  if (pref === 6 || pref === 7) return pref;
  return defaultDow === 7 ? 7 : 6;
}

function orderSessionCandidates(
  idealOurDow: number,
  isLongRun: boolean,
  preferredSorted: number[]
): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  if (isLongRun) {
    const other = idealOurDow === 6 ? 7 : 6;
    for (const d of [idealOurDow, other]) {
      if (preferredSorted.includes(d) && !seen.has(d)) {
        out.push(d);
        seen.add(d);
      }
    }
    return out;
  }
  if (preferredSorted.includes(idealOurDow)) {
    out.push(idealOurDow);
    seen.add(idealOurDow);
  }
  const rest = preferredSorted
    .filter((d) => !seen.has(d))
    .sort((a, b) => circularDistOurDow(a, idealOurDow) - circularDistOurDow(b, idealOurDow));
  return out.concat(rest);
}

function resolvedPositions(pos: readonly RunTypePosition[]): RunTypePosition[] {
  return [...pos].sort((a, b) => a.cyclePosition - b.cyclePosition);
}

function catalogueIdForRotation(
  positions: readonly RunTypePosition[],
  cycleIndex: number
): string | null {
  const p = resolvedPositions(positions);
  if (!p.length) return null;
  const slot = p[cycleIndex % p.length];
  return slot.catalogueWorkoutId ?? null;
}

/**
 * Weeks with typed days; miles filled by apply-long-run, apply-tempo, apply-interval, distribute-easy.
 */
export function assignWorkoutDays(input: WorkoutDayInput): {
  schedule: PlanWeekSchedule[];
  peakWeekNumber: number | null;
  taperStartWeekNumber: number;
  calculatedLongRunMax: number;
} {
  const preferred =
    input.preferredDays.length > 0 ? [...input.preferredDays].sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6];

  const lrCycleLen = Math.max(1, Math.floor(input.longRunCycleLen));

  const raceUtc = utcDateOnly(input.raceDate);
  const planStart = utcDateOnly(input.planStartDate);
  const raceOurDow = ourDowFromUtcDate(raceUtc);
  const longRunIdeal = normalizeLongRunOurDow(input.preferredLongRunDow, input.longRunDefaultDow);

  let tempoDow1 = input.preferredTempoDow ?? input.tempoIdealDow;
  let intervalDow2 = input.preferredIntervalDow ?? input.intervalIdealDow;
  if (tempoDow1 === longRunIdeal) tempoDow1 = input.tempoIdealDow;
  if (intervalDow2 === longRunIdeal) intervalDow2 = input.intervalIdealDow;
  if (tempoDow1 === intervalDow2) {
    intervalDow2 = input.intervalIdealDow;
  }

  const taperStartWeekNumber = taperStartWeekNumberFromTotal(input.totalWeeks, lrCycleLen);
  const peakWeekNumber =
    peakWeekNumberFromTotal(input.totalWeeks, lrCycleLen) ??
    Math.max(1, taperStartWeekNumber - 1);
  const calculatedLongRunMax = longRunCapMilesFromPeakWeekly(input.peakWeeklyMilesForCap);

  const blockedDates = new Set<string>();
  blockedDates.add(ymdFromDate(addDaysUtc(raceUtc, -1)));

  const out: PlanWeekSchedule[] = [];
  let tempoSessionOrdinal = 0;
  let intervalSessionOrdinal = 0;
  let easySessionOrdinal = 0;

  const firstMonday = mondayUtcOfWeekContaining(planStart);
  let weekNumber = 0;

  while (weekNumber < input.totalWeeks) {
    weekNumber++;
    const weekAnchor = addDaysUtc(firstMonday, (weekNumber - 1) * 7);
    const weekEnd = addDaysUtc(weekAnchor, 6);
    const nOffset = nOffsetFromWeekAnchor(weekAnchor, raceUtc);
    const { cyclePos } = weekCycleMeta({
      weekNumber,
      totalWeeks: input.totalWeeks,
      cycleLen: lrCycleLen,
    });

    const days: PlanWeekSchedule["days"] = [];

    const dayInPlanWindow = (ourDowArg: number): boolean => {
      const dt = dateForDayInWeek(input.planStartDate, weekNumber, ourDowArg);
      if (dt.getTime() < planStart.getTime()) return false;
      if (nOffset !== 0 && dt.getTime() > raceUtc.getTime()) return false;
      return true;
    };

    const slotYmd = (ourDow: number): string =>
      ymdFromDate(dateForDayInWeek(input.planStartDate, weekNumber, ourDow));

    const placement = new Map<number, SkeletonEntry>();

    const tryPlaceEntrySkeleton = (ourDowArg: number, entry: SkeletonEntry): boolean => {
      if (placement.has(ourDowArg)) return false;
      const slotDate = dateForDayInWeek(input.planStartDate, weekNumber, ourDowArg);
      if (slotDate.getTime() < planStart.getTime()) return false;
      if (nOffset !== 0 && slotDate.getTime() > raceUtc.getTime()) return false;
      if (blockedDates.has(ymdFromDate(slotDate))) return false;
      placement.set(ourDowArg, entry);
      return true;
    };

    const tryPlaceSessionEntry = (
      idealOurDow: number,
      entry: SkeletonEntry,
      isLongRun: boolean
    ): boolean => {
      for (const dow of orderSessionCandidates(idealOurDow, isLongRun, preferred)) {
        if (tryPlaceEntrySkeleton(dow, entry)) return true;
      }
      return false;
    };

    /** Race-week focus */
    if (nOffset === 0) {
      if (
        raceUtc.getTime() >= weekAnchor.getTime() &&
        raceUtc.getTime() <= weekEnd.getTime()
      ) {
        days.push({
          dow: raceOurDow,
          workoutType: WT.Race,
          miles: 0,
          catalogueWorkoutId: null,
          planCycleIndex: null,
        });
      }
      if (days.length > 0) {
        out.push({ weekNumber, days });
      }
      continue;
    }

    const partialWeek1 = weekNumber === 1 && planStart.getTime() > weekAnchor.getTime();

    const lrCycleIndex = cyclePos;
    const lrMod =
      input.longRunPositions.length > 0 ? input.longRunPositions.length : 4;
    const longCatId = catalogueIdForRotation(
      input.longRunPositions,
      lrCycleIndex % lrMod
    );

    const skipLongOnLongRunDay = nOffset === -1;
    if (!skipLongOnLongRunDay) {
      if (partialWeek1) {
        const other = longRunIdeal === 6 ? 7 : 6;
        const lrDay =
          preferred.includes(longRunIdeal) && dayInPlanWindow(longRunIdeal)
            ? longRunIdeal
            : preferred.includes(other) && dayInPlanWindow(other)
              ? other
              : null;
        const longEntry: SkeletonEntry = {
          kind: "long",
          catalogueWorkoutId: null,
          planCycleIndex: lrCycleIndex,
        };
        if (lrDay != null) tryPlaceEntrySkeleton(lrDay, longEntry);
      } else {
        tryPlaceSessionEntry(longRunIdeal, {
          kind: "long",
          catalogueWorkoutId: longCatId,
          planCycleIndex: lrCycleIndex,
        }, true);
      }
    }

    const tRotMod = Math.max(input.tempoPositions.length, 1);
    const iRotMod = Math.max(input.intervalsPositions.length, 1);

    let hardSessionsPlacedThisWeek = 0;
    for (let slot = 0; slot < HARD_SESSION_SLOTS; slot++) {
      if (partialWeek1 && hardSessionsPlacedThisWeek >= 1) break;
      const idealDow = slot === 0 ? tempoDow1 : intervalDow2;
      const isTempo = slot === 0;
      const ordBefore = isTempo ? tempoSessionOrdinal : intervalSessionOrdinal;
      const rotMod = isTempo ? tRotMod : iRotMod;
      const pci = ordBefore % (rotMod > 0 ? rotMod : 4);
      const posId = catalogueIdForRotation(
        isTempo ? input.tempoPositions : input.intervalsPositions,
        ordBefore
      );
      const kind = isTempo ? "tempo" : ("interval" as const);
      const placed = partialWeek1
        ? preferred.includes(idealDow) &&
          tryPlaceEntrySkeleton(idealDow, { kind, catalogueWorkoutId: posId, planCycleIndex: pci })
        : tryPlaceSessionEntry(
            idealDow,
            { kind, catalogueWorkoutId: posId, planCycleIndex: pci },
            false
          );
      if (placed) {
        hardSessionsPlacedThisWeek++;
        if (slot === 0) tempoSessionOrdinal++;
        else intervalSessionOrdinal++;
      }
    }

    const used = new Set(placement.keys());
    const easyDayList = preferred.filter(
      (d) => !used.has(d) && dayInPlanWindow(d) && !blockedDates.has(slotYmd(d))
    );
    const eRotMod = Math.max(input.easyPositions.length, 1);
    for (const d of easyDayList) {
      if (input.easyPositions.length > 0) {
        const ordBefore = easySessionOrdinal;
        const pci = ordBefore % (eRotMod > 0 ? eRotMod : 1);
        const posId = catalogueIdForRotation(input.easyPositions, ordBefore);
        tryPlaceEntrySkeleton(d, {
          kind: "easy",
          catalogueWorkoutId: posId,
          planCycleIndex: pci,
        });
        easySessionOrdinal++;
      } else {
        tryPlaceEntrySkeleton(d, {
          kind: "easy",
          catalogueWorkoutId: null,
          planCycleIndex: null,
        });
      }
    }

    /** Map placements → typed days sorted by dow */
    const sortedDows = [...placement.keys()].sort((a, b) => a - b);
    for (const dow of sortedDows) {
      const ent = placement.get(dow)!;
      const workoutType: WorkoutType =
        ent.kind === "tempo"
          ? WT.Tempo
          : ent.kind === "interval"
            ? WT.Intervals
            : ent.kind === "long"
              ? WT.LongRun
              : WT.Easy;

      days.push({
        dow,
        workoutType,
        miles: 0,
        catalogueWorkoutId: ent.catalogueWorkoutId,
        planCycleIndex: ent.planCycleIndex,
      });
    }

    const mondayFolded =
      weekNumber === input.totalWeeks &&
      raceUtc.getUTCDay() === 1 &&
      utcDateOnly(addDaysUtc(weekAnchor, 7)).getTime() === raceUtc.getTime();
    if (mondayFolded) {
      days.push({
        dow: raceOurDow,
        workoutType: WT.Race,
        miles: 0,
        catalogueWorkoutId: null,
        planCycleIndex: null,
      });
      days.sort((a, b) => a.dow - b.dow);
    }

    out.push({ weekNumber, days });
  }

  return {
    schedule: out,
    peakWeekNumber,
    taperStartWeekNumber,
    calculatedLongRunMax,
  };
}

/** @internal display-only */
export function dayNameFromOurDow(dow: number): string {
  return DAY_NAMES[Math.min(7, Math.max(1, dow)) - 1]!;
}
