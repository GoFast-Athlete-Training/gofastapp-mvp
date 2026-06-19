/**
 * Pass 4c: race miles, standard easy miles per slot (from preset), trim when week
 * exceeds target + buffer, and fill easy days toward weeklyMileageTarget when below
 * target (pre-taper weeks only). Easy days never exceed `easyRunConfig.maxMiles`.
 */

import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import type { EasyRunConfigResolved } from "@/lib/training/easy-run-config";
import {
  estimateCatalogueWorkoutMiles,
  type CatalogueMileEstimateInput,
} from "@/lib/training/catalogue-mile-estimate";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Matches week-summary deload heuristic: >12% drop vs prior week total. */
export const DELOAD_WEEK_VOLUME_RATIO = 0.88;

export type DistributeEasyInput = {
  planSchedule: PlanWeekSchedule[];
  weeklyMileageTarget: number;
  minWeeklyMiles: number;
  maxWeeklyMiles?: number | null;
  raceDistanceMiles: number;
  easyRunConfig: EasyRunConfigResolved;
  catalogueRowsById: Map<string, CatalogueMileEstimateInput>;
  /** Preferred training days count (typical full week); used to scale week-1 standard miles. */
  typicalWeekPreferredCount: number;
  /** Weeks at or after this number skip fill-toward-target (taper/race). */
  taperStartWeekNumber?: number | null;
};

type EasySlot = { miles: number };

/** Remaining headroom across easy slots before per-day max is hit. */
export function easyFillCapacityMiles(
  easySlots: readonly EasySlot[],
  maxMiles: number
): number {
  return round2(
    easySlots.reduce((s, d) => s + Math.max(0, maxMiles - d.miles), 0)
  );
}

export function isDeloadStyleWeek(params: {
  weekTotalMiles: number;
  previousWeekTotalMiles: number | null;
}): boolean {
  const prev = params.previousWeekTotalMiles;
  if (prev == null || prev <= 0 || params.weekTotalMiles <= 0) return false;
  return params.weekTotalMiles < prev * DELOAD_WEEK_VOLUME_RATIO;
}

function capEasyMiles(miles: number, cfg: EasyRunConfigResolved): number {
  return round2(Math.min(cfg.maxMiles, Math.max(0, miles)));
}

/** Mutates planSchedule in-place */
export function distributeEasyMiles(input: DistributeEasyInput): void {
  const {
    easyRunConfig: cfg,
    typicalWeekPreferredCount: prefCountRaw,
    taperStartWeekNumber,
  } = input;
  const typicalWeekPreferredCount = Math.max(1, Math.floor(prefCountRaw));

  let previousWeekTotalMiles: number | null = null;

  for (const week of input.planSchedule) {
    const weekNum = week.weekNumber;
    const w1Scale =
      weekNum === 1
        ? Math.min(1, week.days.length / typicalWeekPreferredCount)
        : 1;

    let weeklyCap = Math.max(
      input.minWeeklyMiles,
      Math.min(100, input.weeklyMileageTarget)
    );
    if (input.maxWeeklyMiles != null && Number.isFinite(input.maxWeeklyMiles)) {
      weeklyCap = Math.min(weeklyCap, Number(input.maxWeeklyMiles));
    }
    weeklyCap = round2(weeklyCap * w1Scale);

    const trimThreshold =
      Math.min(100, weeklyCap + cfg.weeklyTargetBufferMiles) + 0.05;
    const fillTarget = weeklyCap;
    const beforeTaper =
      taperStartWeekNumber == null ||
      !Number.isFinite(Number(taperStartWeekNumber)) ||
      weekNum < Number(taperStartWeekNumber);

    for (const d of week.days.filter((x) => x.workoutType === "Race")) {
      d.miles = round2(Math.max(input.raceDistanceMiles, 0));
    }

    if (week.days.length > 0 && week.days.every((d) => d.workoutType === "Race")) {
      previousWeekTotalMiles = week.days.reduce((s, d) => s + d.miles, 0);
      continue;
    }

    const easySlots = week.days.filter((d) => d.workoutType === "Easy");
    if (easySlots.length === 0) {
      previousWeekTotalMiles = week.days.reduce((s, d) => s + d.miles, 0);
      continue;
    }

    for (const ep of easySlots) {
      const row = ep.catalogueWorkoutId
        ? input.catalogueRowsById.get(ep.catalogueWorkoutId)
        : undefined;
      const milesPerEasy = capEasyMiles(
        estimateCatalogueWorkoutMiles(row ?? null, "Easy", cfg.standardMiles) * w1Scale,
        cfg
      );
      ep.miles = milesPerEasy > 0 ? milesPerEasy : 0;
    }

    const weekSum = (): number => week.days.reduce((s, d) => s + d.miles, 0);

    while (weekSum() > trimThreshold) {
      let hit = false;
      for (let i = easySlots.length - 1; i >= 0 && weekSum() > trimThreshold; i--) {
        const d = easySlots[i]!;
        const room = d.miles - cfg.minMiles;
        if (room <= 0) continue;
        const over = weekSum() - trimThreshold;
        const shave = Math.min(room, over);
        d.miles = round2(d.miles - shave);
        hit = true;
      }
      if (!hit) break;
    }

    const deloadWeek = isDeloadStyleWeek({
      weekTotalMiles: weekSum(),
      previousWeekTotalMiles,
    });
    const shouldFillTowardTarget = beforeTaper && !deloadWeek;

    if (shouldFillTowardTarget) {
      const increment = 0.25;
      let safety = 0;
      while (weekSum() < fillTarget - 0.05 && safety++ < 2000) {
        let progressed = false;
        for (const d of easySlots) {
          if (weekSum() >= fillTarget - 0.05) break;
          const room = cfg.maxMiles - d.miles;
          if (room <= 0) continue;
          const add = Math.min(increment, room);
          d.miles = round2(d.miles + add);
          progressed = true;
        }
        if (!progressed) break;
      }
    }

    previousWeekTotalMiles = weekSum();
  }
}
