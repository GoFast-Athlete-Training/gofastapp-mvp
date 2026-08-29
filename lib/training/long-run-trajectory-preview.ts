/**
 * Preview Saturday long-run miles across a plan from peak pool + rotation weights.
 * Mirrors apply-long-run.ts / longRunCupSetter without mutating a schedule.
 */

import { LONG_RUN_BLOCK_WEEKS } from "@/lib/training/long-run-block-weeks";
import {
  saturdayOfTrainingWeek,
} from "@/lib/training/core-volume-compute";
import { ymdFromDate } from "@/lib/training/plan-utils";
import {
  longRunCupSetter,
  type LongRunFitnessPhase,
} from "@/lib/training/long-run-cup-setter";
import {
  peakWeekNumberFromTotal,
  taperStartWeekNumberFromTotal,
} from "@/lib/training/cycle-blocks";
import type { RunTypePosition } from "@/lib/training/run-type-config-shared";

export type LongRunTrajectoryRow = {
  weekNumber: number;
  date: string | null;
  miles: number;
  isPeakBlock: boolean;
};

function round1(n: number): number {
  return Math.max(0, Math.round(n * 10) / 10);
}

function sortedPos(positions: readonly RunTypePosition[]): RunTypePosition[] {
  return [...positions].sort((a, b) => a.cyclePosition - b.cyclePosition);
}

function weightNormInMacroBlock(
  positions: readonly RunTypePosition[],
  cyclePos: number,
  weeksInThisCycle: number
): number {
  const rows = sortedPos(positions);
  const len = Math.max(1, Math.floor(weeksInThisCycle));
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

export function peakBlockWeekRange(input: {
  totalWeeks: number;
  nCycles: number;
  weeksInCycle: number[];
}): { startWeek: number; endWeek: number } | null {
  const { nCycles, weeksInCycle, totalWeeks } = input;
  const peakSlot = nCycles >= 2 ? nCycles - 2 : Math.max(0, nCycles - 1);
  const startWeek = peakSlot * LONG_RUN_BLOCK_WEEKS + 1;
  const weeksInBlock = weeksInCycle[peakSlot] ?? LONG_RUN_BLOCK_WEEKS;
  if (weeksInBlock <= 0 || startWeek > totalWeeks) return null;
  return {
    startWeek,
    endWeek: Math.min(totalWeeks, startWeek + weeksInBlock - 1),
  };
}

export function computeLongRunTrajectoryPreview(input: {
  totalWeeks: number;
  peakLongRunPoolMiles: number;
  fitnessPhase?: LongRunFitnessPhase;
  longRunPositions?: readonly RunTypePosition[];
  planStartDate?: Date | null;
}): {
  rows: LongRunTrajectoryRow[];
  peakWeekNumber: number | null;
  taperStartWeekNumber: number;
  poolMilesByCycle: number[];
  peakBlock: { startWeek: number; endWeek: number } | null;
} {
  const totalWeeks = Math.max(1, Math.floor(input.totalWeeks));
  const len = LONG_RUN_BLOCK_WEEKS;
  const cup = longRunCupSetter({
    totalWeeks,
    longRunCycleWeeks: len,
    peakLongRunPoolMiles: input.peakLongRunPoolMiles,
    fitnessPhase: input.fitnessPhase,
  });
  const peakWeekNumber = peakWeekNumberFromTotal(totalWeeks, len);
  const taperStartWeekNumber = taperStartWeekNumberFromTotal(totalWeeks, len);
  const peakBlock = peakBlockWeekRange({
    totalWeeks,
    nCycles: cup.nCycles,
    weeksInCycle: cup.weeksInCycle,
  });
  const positions = input.longRunPositions ?? [];
  const planStart = input.planStartDate ?? null;
  const rows: LongRunTrajectoryRow[] = [];

  for (let wn = 1; wn <= totalWeeks; wn++) {
    const cycleIdx = Math.min(cup.nCycles - 1, Math.floor((wn - 1) / len));
    const weeksInBlock = cup.weeksInCycle[cycleIdx] ?? len;
    const cyclePos = (wn - 1) % len;
    if (cyclePos >= weeksInBlock) continue;

    const macroPool = cup.poolMilesByCycle[cycleIdx] ?? 0;
    const weightNorm = weightNormInMacroBlock(positions, cyclePos, weeksInBlock);
    const miles = round1(macroPool * weightNorm);
    const isPeakBlock =
      peakBlock != null && wn >= peakBlock.startWeek && wn <= peakBlock.endWeek;
    const date =
      planStart != null && !Number.isNaN(planStart.getTime())
        ? ymdFromDate(saturdayOfTrainingWeek(planStart, wn))
        : null;
    rows.push({ weekNumber: wn, date, miles, isPeakBlock });
  }

  return {
    rows,
    peakWeekNumber,
    taperStartWeekNumber,
    poolMilesByCycle: cup.poolMilesByCycle,
    peakBlock,
  };
}

export function trajectoryRowsFromGenerated(input: {
  longRunByWeek: { weekNumber: number; miles: number }[];
  peakBlock: { startWeek: number; endWeek: number } | null;
  planStartDate?: Date | null;
}): LongRunTrajectoryRow[] {
  return input.longRunByWeek.map((row) => ({
    weekNumber: row.weekNumber,
    miles: row.miles,
    date:
      input.planStartDate && !Number.isNaN(input.planStartDate.getTime())
        ? ymdFromDate(saturdayOfTrainingWeek(input.planStartDate, row.weekNumber))
        : null,
    isPeakBlock:
      input.peakBlock != null &&
      row.weekNumber >= input.peakBlock.startWeek &&
      row.weekNumber <= input.peakBlock.endWeek,
  }));
}
