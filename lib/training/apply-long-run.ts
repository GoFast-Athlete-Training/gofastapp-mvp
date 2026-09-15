/**
 * Service 2: assign long-run miles from preset position weights × macro-cycle pool share.
 * Long runs are sacred — pool math is the answer, nothing trims it.
 *
 * Macro cycle = `longRunCycleWeeks` consecutive calendar weeks (always 4 in product).
 * The cup gives total LR miles for that block; this file splits it across those weeks.
 */

import { LONG_RUN_BLOCK_WEEKS } from "@/lib/training/long-run-block-weeks";
import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import {
  longRunCupSetter,
  type LongRunFitnessPhase,
} from "@/lib/training/long-run-cup-setter";
import type { RunTypePosition } from "@/lib/training/run-type-config-shared";
import {
  defaultTaperLongRunsForWeeks,
  isTaperVolumeWeek,
  TAPER_CALENDAR_WEEKS,
  TAPER_LR_TEMPLATE_PEAK_MILES,
} from "@/lib/training/preset-volume-helpers";

export type ApplyLongRunInput = {
  planSchedule: PlanWeekSchedule[];
  totalWeeks: number;
  longRunCycleWeeks?: number;
  peakLongRunPoolMiles: number;
  fitnessPhase?: LongRunFitnessPhase;
  /** @deprecated ignored — peak-only cup service */
  baseLongRunPoolMiles?: number;
  /** @deprecated ignored — peak-only cup service */
  taperLongRunPoolMiles?: number;
  /** Sum of preset distributionWeights need not equal 1; we normalize inside the macro block */
  longRunPositions: readonly RunTypePosition[];
};

function round1(n: number): number {
  return Math.max(0, Math.round(n * 10) / 10);
}

function sortedPos(positions: readonly RunTypePosition[]): RunTypePosition[] {
  return [...positions].sort((a, b) => a.cyclePosition - b.cyclePosition);
}

/**
 * Per-week share of the macro-cycle long-run pool. Weights renormalize over the
 * actual calendar weeks in this block (1–4), not always 4.
 */
function weightNormInMacroBlock(
  positions: readonly RunTypePosition[],
  cyclePos: number,
  weeksInThisCycle: number
): { catalogueWorkoutId: string | null; weightNorm: number } {
  const rows = sortedPos(positions);
  const len = Math.max(1, Math.floor(weeksInThisCycle));
  if (rows.length === 0) {
    return {
      catalogueWorkoutId: null,
      weightNorm: 1 / len,
    };
  }
  let blockWeightSum = 0;
  for (let k = 0; k < len; k++) {
    const row = rows[k % rows.length];
    blockWeightSum += Math.max(0, Number(row.distributionWeight) || 0);
  }
  const r = rows[cyclePos % rows.length];
  const wi = Math.max(0, Number(r.distributionWeight) || 0);
  const norm = blockWeightSum > 0 ? wi / blockWeightSum : 1 / len;
  return {
    catalogueWorkoutId: r.catalogueWorkoutId ?? null,
    weightNorm: norm,
  };
}

/** Mutates LR rows in-place; fills miles + catalogue IDs when preset rows exist */
export function applyLongRunSchedule(input: ApplyLongRunInput): void {
  const {
    planSchedule,
    totalWeeks,
    longRunCycleWeeks: cycleWeeksIn,
    peakLongRunPoolMiles,
    fitnessPhase,
    longRunPositions,
  } = input;
  const len = Math.max(1, Math.floor(cycleWeeksIn ?? LONG_RUN_BLOCK_WEEKS));
  const { poolMilesByCycle, nCycles, weeksInCycle } = longRunCupSetter({
    totalWeeks,
    longRunCycleWeeks: len,
    peakLongRunPoolMiles,
    fitnessPhase,
  });

  let buildPeakLrMiles = 0;
  for (const week of planSchedule) {
    const wn = week.weekNumber;
    if (isTaperVolumeWeek(wn, totalWeeks)) continue;
    const cycleIdx = Math.min(nCycles - 1, Math.floor((wn - 1) / len));
    const weeksInBlock = weeksInCycle[cycleIdx] ?? len;
    const cyclePos = (wn - 1) % len;
    if (cyclePos >= weeksInBlock) continue;
    const macroPool = poolMilesByCycle[cycleIdx] ?? 0;
    const { weightNorm } = weightNormInMacroBlock(longRunPositions, cyclePos, weeksInBlock);
    buildPeakLrMiles = Math.max(buildPeakLrMiles, round1(macroPool * weightNorm));
  }

  const taperDefaults = defaultTaperLongRunsForWeeks(TAPER_CALENDAR_WEEKS);
  const taperScale =
    buildPeakLrMiles > 0
      ? buildPeakLrMiles / TAPER_LR_TEMPLATE_PEAK_MILES
      : 1;

  for (const week of planSchedule) {
    const wn = week.weekNumber;
    const cycleIdx = Math.min(nCycles - 1, Math.floor((wn - 1) / len));
    const weeksInBlock = weeksInCycle[cycleIdx] ?? len;
    const cyclePos = (wn - 1) % len;
    if (cyclePos >= weeksInBlock) continue;

    let lrMi: number;
    let catalogueWorkoutId: string | null;
    if (isTaperVolumeWeek(wn, totalWeeks)) {
      const taperIdx = wn - (totalWeeks - TAPER_CALENDAR_WEEKS + 1);
      const templateMi = taperDefaults[taperIdx] ?? taperDefaults[taperDefaults.length - 1] ?? 8;
      lrMi = round1(templateMi * taperScale);
      catalogueWorkoutId = null;
    } else {
      const macroPool = poolMilesByCycle[cycleIdx] ?? 0;
      const weighted = weightNormInMacroBlock(longRunPositions, cyclePos, weeksInBlock);
      catalogueWorkoutId = weighted.catalogueWorkoutId;
      lrMi = round1(macroPool * weighted.weightNorm);
    }

    for (const d of week.days) {
      if (d.workoutType === "Race") continue;
      if (d.workoutType !== "LongRun") continue;
      d.miles = lrMi;
      if (catalogueWorkoutId) d.catalogueWorkoutId = catalogueWorkoutId;
      const rowCount = sortedPos(longRunPositions).length;
      d.planCycleIndex = cyclePos % (rowCount > 0 ? rowCount : 4);
      break;
    }
  }
}
