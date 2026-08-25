/**
 * The three computes — canonical volume engine surface.
 * OpenAI proposes cups; code derives pattern + Saturday split.
 */

import { LONG_RUN_BLOCK_WEEKS } from "@/lib/training/long-run-block-weeks";
import { longRunCupSetter } from "@/lib/training/long-run-cup-setter";
import {
  peakWeekNumberFromTotal,
  taperStartWeekNumberFromTotal,
} from "@/lib/training/cycle-blocks";
import { calendarTrainingWeekCount } from "@/lib/training/plan-utils";
import type { RunTypePosition } from "@/lib/training/run-type-config-shared";

export type CoreVolumeCups = {
  baseMiles: number;
  peakMiles: number;
  taperMiles: number;
};

/** (1) Peak-block long-run pool — the main number (maps to peakMiles column). */
export function computePeakLrPoolMax(peakLrPoolMax: number): number {
  const p = Number(peakLrPoolMax);
  if (!Number.isFinite(p) || p <= 0) {
    throw new Error("peakLrPoolMax must be a positive number");
  }
  return Math.round(p * 10) / 10;
}

/** (2) Cup shape across macro blocks from plan weeks (always 4-week blocks). */
export function computePeakPoolPattern(input: {
  totalWeeks: number;
  baseMiles: number;
  peakMiles: number;
  taperMiles: number;
}) {
  return longRunCupSetter({
    totalWeeks: input.totalWeeks,
    longRunCycleWeeks: LONG_RUN_BLOCK_WEEKS,
    baseMiles: input.baseMiles,
    peakMiles: input.peakMiles,
    taperMiles: input.taperMiles,
  });
}

function sortedPos(positions: readonly RunTypePosition[]): RunTypePosition[] {
  return [...positions].sort((a, b) => a.cyclePosition - b.cyclePosition);
}

function weightNormInBlock(
  positions: readonly RunTypePosition[],
  cyclePos: number
): number {
  const rows = sortedPos(positions);
  const len = LONG_RUN_BLOCK_WEEKS;
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
  longRunPositions: readonly RunTypePosition[] = []
): number[] {
  const pool = Math.max(0, Number(blockPoolMiles));
  const miles: number[] = [];
  for (let cyclePos = 0; cyclePos < LONG_RUN_BLOCK_WEEKS; cyclePos++) {
    const norm = weightNormInBlock(longRunPositions, cyclePos);
    miles.push(Math.round(pool * norm * 10) / 10);
  }
  return miles;
}

export type CoreVolumeCalendarPreview = {
  totalWeeks: number;
  totalCycles: number;
  poolMilesByCycle: number[];
  peakWeekNumber: number | null;
  taperStartWeekNumber: number;
  longRunCycleWeeks: number;
};

export function computeCoreVolumeCalendarPreview(input: {
  planStartDate: Date;
  raceDate: Date;
  baseMiles: number;
  peakMiles: number;
  taperMiles: number;
}): CoreVolumeCalendarPreview {
  const totalWeeks = calendarTrainingWeekCount(input.planStartDate, input.raceDate);
  const cup = computePeakPoolPattern({
    totalWeeks,
    baseMiles: input.baseMiles,
    peakMiles: input.peakMiles,
    taperMiles: input.taperMiles,
  });
  return {
    totalWeeks,
    totalCycles: cup.nCycles,
    poolMilesByCycle: cup.poolMilesByCycle,
    peakWeekNumber: peakWeekNumberFromTotal(totalWeeks, LONG_RUN_BLOCK_WEEKS),
    taperStartWeekNumber: taperStartWeekNumberFromTotal(totalWeeks, LONG_RUN_BLOCK_WEEKS),
    longRunCycleWeeks: LONG_RUN_BLOCK_WEEKS,
  };
}

export function normalizeCoreVolumeCups(raw: {
  baseLrPool?: number;
  peakLrPoolMax?: number;
  taperLrPool?: number;
}): CoreVolumeCups {
  const peak = computePeakLrPoolMax(raw.peakLrPoolMax ?? 55);
  let base = Number(raw.baseLrPool);
  if (!Number.isFinite(base) || base <= 0) base = Math.max(25, Math.round(peak * 0.65));
  base = Math.min(base, peak);
  let taper = Number(raw.taperLrPool);
  if (!Number.isFinite(taper) || taper <= 0) taper = Math.max(20, Math.round(peak * 0.85));
  taper = Math.min(taper, peak);
  return {
    baseMiles: Math.round(base * 10) / 10,
    peakMiles: peak,
    taperMiles: Math.round(taper * 10) / 10,
  };
}
