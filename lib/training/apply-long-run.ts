/**
 * Service 2: assign long-run miles from preset position weights × macro-cycle pool share.
 */

import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import { generateCyclePoolTotals } from "@/lib/training/cycle-pool";
import type { RunTypePosition } from "@/lib/training/run-type-config-shared";
import { weekCycleMeta } from "@/lib/training/cycle-blocks";

const DEFAULT_LONG_SHARE = 0.28;

export type ApplyLongRunInput = {
  planSchedule: PlanWeekSchedule[];
  totalWeeks: number;
  cycleLen: number;
  baseMiles: number;
  peakMiles: number;
  taperMiles: number;
  /** Sum of preset distributionWeights need not equal 1; we normalize inside the macro block */
  longRunPositions: readonly RunTypePosition[];
  calculatedLongRunMax: number;
  minLongMi?: number;
  /** Fraction of macro weekly pool allocated to LR before weight split */
  longRunWeeklyShare?: number;
};

function round1(n: number): number {
  return Math.max(0, Math.round(n * 10) / 10);
}

function sortedPos(positions: readonly RunTypePosition[]): RunTypePosition[] {
  return [...positions].sort((a, b) => a.cyclePosition - b.cyclePosition);
}

function weightNormRow(
  positions: readonly RunTypePosition[],
  cyclePos: number
): { catalogueWorkoutId: string | null; weightNorm: number } {
  const rows = sortedPos(positions);
  if (rows.length === 0) {
    return {
      catalogueWorkoutId: null,
      weightNorm: 1,
    };
  }
  const r = rows[cyclePos % rows.length];
  const wsum = rows.reduce((s, p) => s + Math.max(0, Number(p.distributionWeight) || 0), 0);
  const wi = Math.max(0, Number(r.distributionWeight) || 0);
  const norm = wsum > 0 ? wi / wsum : 1 / rows.length;
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
    cycleLen,
    baseMiles,
    peakMiles,
    taperMiles,
    longRunPositions,
    calculatedLongRunMax,
  } = input;
  const lrShare =
    input.longRunWeeklyShare != null && Number.isFinite(input.longRunWeeklyShare)
      ? Math.min(1, Math.max(0.05, input.longRunWeeklyShare))
      : DEFAULT_LONG_SHARE;
  const minL = Math.max(0, input.minLongMi ?? 8);
  const len = Math.max(1, Math.floor(cycleLen));
  const { poolMilesByCycle, nCycles } = generateCyclePoolTotals({
    totalWeeks,
    cycleLen: len,
    baseMiles,
    peakMiles,
    taperMiles,
  });

  for (const week of planSchedule) {
    const wn = week.weekNumber;
    const { cyclePos } = weekCycleMeta({ weekNumber: wn, totalWeeks, cycleLen: len });
    const cycleIdx = Math.min(nCycles - 1, Math.floor((wn - 1) / len));
    const macroPool = poolMilesByCycle[cycleIdx] ?? 0;
    const macroWeekly = macroPool / len;
    const { weightNorm, catalogueWorkoutId } = weightNormRow(longRunPositions, cyclePos);
    let lrMi = macroWeekly * lrShare * weightNorm;
    lrMi = Math.max(minL, Math.min(calculatedLongRunMax, lrMi));
    lrMi = round1(lrMi);

    for (const d of week.days) {
      if (d.workoutType !== "LongRun") continue;
      d.miles = lrMi;
      if (catalogueWorkoutId) d.catalogueWorkoutId = catalogueWorkoutId;
      const rowCount = sortedPos(longRunPositions).length;
      d.planCycleIndex = cyclePos % (rowCount > 0 ? rowCount : 4);
      break;
    }
  }
}
