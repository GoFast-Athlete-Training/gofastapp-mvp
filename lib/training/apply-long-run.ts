/**
 * Service 2: assign long-run miles from preset position weights × macro-cycle pool share.
 * Long runs are sacred — pool math is the answer, nothing trims it.
 */

import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import { longRunCupSetter } from "@/lib/training/long-run-cup-setter";
import type { RunTypePosition } from "@/lib/training/run-type-config-shared";
import { weekCycleMeta } from "@/lib/training/cycle-blocks";

export type ApplyLongRunInput = {
  planSchedule: PlanWeekSchedule[];
  totalWeeks: number;
  cycleLen: number;
  baseMiles: number;
  peakMiles: number;
  taperMiles: number;
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
 * Per-week share of the macro-cycle long-run pool. Weights must renormalize over the
 * `cycleLen` weeks in the block so that Σ (pool × norm_k) === pool (rotation can have more
 * slots than cycleLen — previously we divided by full rotation sum and under-filled the pool).
 */
function weightNormInMacroBlock(
  positions: readonly RunTypePosition[],
  cyclePos: number,
  cycleLen: number
): { catalogueWorkoutId: string | null; weightNorm: number } {
  const rows = sortedPos(positions);
  const len = Math.max(1, Math.floor(cycleLen));
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
  const norm =
    blockWeightSum > 0 ? wi / blockWeightSum : 1 / len;
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
  } = input;
  const len = Math.max(1, Math.floor(cycleLen));
  const { poolMilesByCycle, nCycles } = longRunCupSetter({
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
    const { weightNorm, catalogueWorkoutId } = weightNormInMacroBlock(
      longRunPositions,
      cyclePos,
      len
    );
    // Pool × weight IS the long run — no cap, no ramp.
    const lrMi = round1(macroPool * weightNorm);

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
