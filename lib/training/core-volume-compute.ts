/**
 * The three computes — canonical volume engine surface.
 * OpenAI proposes long-run pools; code derives pattern + Saturday split.
 */

import { LONG_RUN_BLOCK_WEEKS } from "@/lib/training/long-run-block-weeks";
import {
  deriveLongRunPoolTripletFromPeak,
  longRunCupSetter,
  type LongRunFitnessPhase,
} from "@/lib/training/long-run-cup-setter";
import {
  peakWeekNumberFromTotal,
  taperStartWeekNumberFromTotal,
} from "@/lib/training/cycle-blocks";
import {
  addDaysUtc,
  calendarTrainingWeekCount,
  mondayUtcOfWeekContaining,
  ymdFromDate,
} from "@/lib/training/plan-utils";
import type { RunTypePosition } from "@/lib/training/run-type-config-shared";
import {
  clampPeakLongRunPoolMiles,
  type LongRunPoolTriplet,
} from "@/lib/training/long-run-pool-fields";

export type { LongRunPoolTriplet as CoreVolumePools };

/** @deprecated use LongRunPoolTriplet */
export type CoreVolumeCups = LongRunPoolTriplet;

export type PeakPoolKeySaturday = {
  weekNumber: number;
  date: string;
  miles: number;
};

/** (2) Pool shape across macro blocks from plan weeks (always 4-week blocks). */
export function computePeakPoolPattern(input: {
  totalWeeks: number;
  peakLongRunPoolMiles: number;
  fitnessPhase?: LongRunFitnessPhase;
}) {
  return longRunCupSetter({
    totalWeeks: input.totalWeeks,
    longRunCycleWeeks: LONG_RUN_BLOCK_WEEKS,
    peakLongRunPoolMiles: input.peakLongRunPoolMiles,
    fitnessPhase: input.fitnessPhase,
  });
}

function sortedPos(positions: readonly RunTypePosition[]): RunTypePosition[] {
  return [...positions].sort((a, b) => a.cyclePosition - b.cyclePosition);
}

function weightNormInBlock(
  positions: readonly RunTypePosition[],
  cyclePos: number,
  weeksInBlock: number = LONG_RUN_BLOCK_WEEKS
): number {
  const rows = sortedPos(positions);
  const len = Math.max(1, Math.floor(weeksInBlock));
  if (rows.length === 0) return 1 / len;
  let blockWeightSum = 0;
  for (let k = 0; k < len; k++) {
    const row = rows[k % rows.length];
    blockWeightSum += Math.max(0, Number(row.distributionWeight) || 0);
  }
  const r = rows[cyclePos % rows.length];
  const wi = Math.max(0, Number(r.distributionWeight) || 0);
  return blockWeightSum > 0 ? wi / blockWeightSum : 1 / len;
}

/** (3) Split one block's pool across 4 Saturday long runs. */
export function computeLongRunAcrossCycle(
  blockPoolMiles: number,
  longRunPositions: readonly RunTypePosition[] = [],
  weeksInBlock: number = LONG_RUN_BLOCK_WEEKS
): number[] {
  const pool = Math.max(0, Number(blockPoolMiles));
  const len = Math.max(1, Math.floor(weeksInBlock));
  const miles: number[] = [];
  for (let cyclePos = 0; cyclePos < len; cyclePos++) {
    const norm = weightNormInBlock(longRunPositions, cyclePos, len);
    miles.push(Math.round(pool * norm * 10) / 10);
  }
  return miles;
}

export function saturdayOfTrainingWeek(planStart: Date, weekNumber: number): Date {
  const firstMon = mondayUtcOfWeekContaining(planStart);
  const weekMon = addDaysUtc(firstMon, (weekNumber - 1) * 7);
  return addDaysUtc(weekMon, 5);
}

export function mondayOfTrainingWeek(planStart: Date, weekNumber: number): Date {
  const firstMon = mondayUtcOfWeekContaining(planStart);
  return addDaysUtc(firstMon, (weekNumber - 1) * 7);
}

export type CoreVolumeCalendarPreview = {
  totalWeeks: number;
  totalCycles: number;
  poolMilesByCycle: number[];
  peakWeekNumber: number | null;
  taperStartWeekNumber: number;
  longRunCycleWeeks: number;
  peakLongRunDate: string | null;
  taperStartDate: string | null;
  peakPoolKey: PeakPoolKeySaturday[];
};

export function computeCoreVolumeCalendarPreview(input: {
  planStartDate: Date;
  raceDate: Date;
  peakLongRunPoolMiles: number;
  fitnessPhase?: LongRunFitnessPhase;
  longRunPositions?: readonly RunTypePosition[];
}): CoreVolumeCalendarPreview {
  const totalWeeks = calendarTrainingWeekCount(input.planStartDate, input.raceDate);
  const cup = computePeakPoolPattern({
    totalWeeks,
    peakLongRunPoolMiles: input.peakLongRunPoolMiles,
    fitnessPhase: input.fitnessPhase,
  });
  const peakWeekNumber = peakWeekNumberFromTotal(totalWeeks, LONG_RUN_BLOCK_WEEKS);
  const taperStartWeekNumber = taperStartWeekNumberFromTotal(
    totalWeeks,
    LONG_RUN_BLOCK_WEEKS
  );

  let peakPoolKey: PeakPoolKeySaturday[] = [];
  if (peakWeekNumber != null && cup.poolMilesByCycle.length > 0) {
    const peakSlot =
      cup.nCycles >= 2 ? cup.nCycles - 2 : Math.max(0, cup.nCycles - 1);
    const peakBlockPool = cup.poolMilesByCycle[peakSlot] ?? input.peakLongRunPoolMiles;
    const peakWeeksInBlock = cup.weeksInCycle[peakSlot] ?? LONG_RUN_BLOCK_WEEKS;
    const saturdayMiles = computeLongRunAcrossCycle(
      peakBlockPool,
      input.longRunPositions ?? [],
      peakWeeksInBlock
    );
    const blockStartWeek = peakSlot * LONG_RUN_BLOCK_WEEKS + 1;
    peakPoolKey = saturdayMiles.map((miles, i) => {
      const weekNumber = blockStartWeek + i;
      return {
        weekNumber,
        date: ymdFromDate(saturdayOfTrainingWeek(input.planStartDate, weekNumber)),
        miles,
      };
    });
  }

  return {
    totalWeeks,
    totalCycles: cup.nCycles,
    poolMilesByCycle: cup.poolMilesByCycle,
    peakWeekNumber,
    taperStartWeekNumber,
    longRunCycleWeeks: LONG_RUN_BLOCK_WEEKS,
    peakLongRunDate:
      peakWeekNumber != null
        ? ymdFromDate(saturdayOfTrainingWeek(input.planStartDate, peakWeekNumber))
        : null,
    taperStartDate: ymdFromDate(
      mondayOfTrainingWeek(input.planStartDate, taperStartWeekNumber)
    ),
    peakPoolKey,
  };
}

export function normalizeLongRunPools(raw: {
  baseLongRunPoolMiles?: number;
  peakLongRunPoolMiles?: number;
  taperLongRunPoolMiles?: number;
}): LongRunPoolTriplet {
  const peak = clampPeakLongRunPoolMiles(raw.peakLongRunPoolMiles ?? 55);
  return deriveLongRunPoolTripletFromPeak(peak);
}

/** @deprecated use normalizeLongRunPools */
export function normalizeCoreVolumeCups(raw: {
  baseLrPool?: number;
  peakLrPoolMax?: number;
  taperLrPool?: number;
  baseLongRunPoolMiles?: number;
  peakLongRunPoolMiles?: number;
  taperLongRunPoolMiles?: number;
}): LongRunPoolTriplet {
  return normalizeLongRunPools({
    baseLongRunPoolMiles: raw.baseLongRunPoolMiles ?? raw.baseLrPool,
    peakLongRunPoolMiles: raw.peakLongRunPoolMiles ?? raw.peakLrPoolMax,
    taperLongRunPoolMiles: raw.taperLongRunPoolMiles ?? raw.taperLrPool,
  });
}

/** @deprecated use clampPeakLongRunPoolMiles */
export function computePeakLrPoolMax(peakLongRunPoolMiles: number): number {
  return clampPeakLongRunPoolMiles(peakLongRunPoolMiles);
}
