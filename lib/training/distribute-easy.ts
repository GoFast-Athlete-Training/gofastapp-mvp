/**
 * Pass 4c: race miles, standard easy miles per slot (from preset), trim when week
 * exceeds target + buffer, and fill easy days toward weeklyMileageTarget when below
 * target (pre-taper weeks only).
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

/** Mutates planSchedule in-place */
export function distributeEasyMiles(input: DistributeEasyInput): void {
  const {
    easyRunConfig: cfg,
    typicalWeekPreferredCount: prefCountRaw,
    taperStartWeekNumber,
  } = input;
  const typicalWeekPreferredCount = Math.max(1, Math.floor(prefCountRaw));

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
    const shouldFillTowardTarget =
      taperStartWeekNumber == null ||
      !Number.isFinite(Number(taperStartWeekNumber)) ||
      weekNum < Number(taperStartWeekNumber);

    for (const d of week.days.filter((x) => x.workoutType === "Race")) {
      d.miles = round2(Math.max(input.raceDistanceMiles, 0));
    }

    if (week.days.length > 0 && week.days.every((d) => d.workoutType === "Race")) {
      continue;
    }

    const easySlots = week.days.filter((d) => d.workoutType === "Easy");
    if (easySlots.length === 0) continue;

    for (const ep of easySlots) {
      const row = ep.catalogueWorkoutId
        ? input.catalogueRowsById.get(ep.catalogueWorkoutId)
        : undefined;
      const milesPerEasy = round2(
        estimateCatalogueWorkoutMiles(row ?? null, "Easy", cfg.standardMiles) * w1Scale
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

    if (shouldFillTowardTarget) {
      const increment = 0.25;
      let safety = 0;
      while (weekSum() < fillTarget - 0.05 && safety++ < 2000) {
        let progressed = false;
        for (const d of easySlots) {
          if (weekSum() >= fillTarget - 0.05) break;
          d.miles = round2(d.miles + increment);
          progressed = true;
        }
        if (!progressed) break;
      }
    }
  }
}
