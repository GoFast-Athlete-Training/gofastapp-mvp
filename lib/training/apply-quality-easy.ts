/**
 * Service 3: fill Intervals / Tempo miles from catalogue estimates; Easy absorbs remainder vs weekly cap.
 */

import type { WorkoutType } from "@prisma/client";
import type { workout_catalogue } from "@prisma/client";
import { generateCyclePoolTotals } from "@/lib/training/cycle-pool";
import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";

export type CatalogueMileEstimateInput = Pick<
  workout_catalogue,
  | "workoutType"
  | "segmentPaceDist"
  | "warmupMiles"
  | "cooldownMiles"
  | "workBaseMiles"
  | "workBaseReps"
  | "workBaseRepMeters"
>;

const FALLBACK_INTERVAL_MI = 5;
const FALLBACK_TEMPO_MI = 6;

function sumSegmentDistMiles(segmentPaceDist: unknown): number | null {
  if (!Array.isArray(segmentPaceDist)) return null;
  let m = 0;
  for (const seg of segmentPaceDist) {
    if (seg && typeof seg === "object" && "distanceMeters" in seg) {
      const dm = Number((seg as { distanceMeters?: unknown }).distanceMeters);
      if (Number.isFinite(dm)) m += dm / 1609.34;
    }
  }
  return m > 0 ? m : null;
}

export function estimateCatalogueWorkoutMiles(
  row: CatalogueMileEstimateInput | null | undefined,
  workoutTypeFallback: Extract<WorkoutType, "Intervals" | "Tempo">
): number {
  if (!row) {
    return workoutTypeFallback === "Tempo"
      ? FALLBACK_TEMPO_MI
      : FALLBACK_INTERVAL_MI;
  }
  const fromSeg = sumSegmentDistMiles(row.segmentPaceDist);
  if (fromSeg != null) {
    return Math.max(
      workoutTypeFallback === "Tempo" ? 3 : 2,
      Math.round(fromSeg * 10) / 10
    );
  }
  const wu = Number(row.warmupMiles);
  const cd = Number(row.cooldownMiles);
  const warmup = Number.isFinite(wu) ? wu : 0;
  const cooldown = Number.isFinite(cd) ? cd : 0;
  const wbMi = Number(row.workBaseMiles);
  if (Number.isFinite(wbMi) && wbMi > 0) {
    return Math.max(3, Math.round((warmup + cooldown + wbMi) * 10) / 10);
  }
  const reps = row.workBaseReps;
  const repM = row.workBaseRepMeters;
  if (
    reps != null &&
    repM != null &&
    Number.isFinite(reps) &&
    reps > 0 &&
    Number.isFinite(repM) &&
    repM > 0
  ) {
    const workMi = (reps * repM) / 1609.34;
    return Math.max(3, Math.round((warmup + cooldown + workMi) * 10) / 10);
  }
  return row.workoutType === "Tempo"
    ? FALLBACK_TEMPO_MI
    : FALLBACK_INTERVAL_MI;
}

function weeklyMileageCeilingFromCyclePool(params: {
  weekNumber: number;
  cycleLen: number;
  totalWeeks: number;
  baseMiles?: number | null;
  peakMiles?: number | null;
  taperMiles?: number | null;
}): number | null {
  const { weekNumber, cycleLen, totalWeeks } = params;
  const base = params.baseMiles;
  const peak = params.peakMiles;
  const taper = params.taperMiles;
  if (
    base == null ||
    peak == null ||
    taper == null ||
    !Number.isFinite(Number(base)) ||
    !Number.isFinite(Number(peak)) ||
    !Number.isFinite(Number(taper))
  ) {
    return null;
  }
  const len = Math.max(1, Math.floor(cycleLen));
  const { poolMilesByCycle, nCycles } = generateCyclePoolTotals({
    totalWeeks,
    cycleLen: len,
    baseMiles: Number(base),
    peakMiles: Number(peak),
    taperMiles: Number(taper),
  });
  if (nCycles < 1) return null;
  const cycleIdx = Math.min(nCycles - 1, Math.floor((weekNumber - 1) / len));
  const pool = poolMilesByCycle[cycleIdx];
  if (pool == null || !Number.isFinite(pool) || pool <= 0) return null;
  const perWeekSuggested = pool / len;
  return Math.max(
    20,
    Math.min(perWeekSuggested, 100, Math.round(perWeekSuggested * 10) / 10)
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ApplyQualityEasyInput = {
  planSchedule: PlanWeekSchedule[];
  totalWeeks: number;
  weeklyMileageTarget: number;
  minWeeklyMiles: number;
  cycleLen: number;
  baseMiles?: number | null;
  peakMiles?: number | null;
  taperMiles?: number | null;
  maxWeeklyMiles?: number | null;
  raceDistanceMiles: number;
  catalogueRowsById: Map<string, CatalogueMileEstimateInput>;
  minEasyPerDayMiles?: number;
  minTempoMiles?: number;
  minIntervalMiles?: number;
};

/** Mutates planSchedule in-place */
export function applyQualityAndEasySchedule(input: ApplyQualityEasyInput): void {
  const minEasyPerDay =
    input.minEasyPerDayMiles != null && Number.isFinite(input.minEasyPerDayMiles)
      ? Math.max(0, input.minEasyPerDayMiles)
      : 3;
  const minTempo =
    input.minTempoMiles != null && Number.isFinite(input.minTempoMiles)
      ? input.minTempoMiles!
      : 3;
  const minInterval =
    input.minIntervalMiles != null && Number.isFinite(input.minIntervalMiles)
      ? input.minIntervalMiles!
      : 3;

  for (const week of input.planSchedule) {
    let weeklyCap = Math.max(
      input.minWeeklyMiles,
      Math.min(100, input.weeklyMileageTarget)
    );
    if (input.maxWeeklyMiles != null && Number.isFinite(input.maxWeeklyMiles)) {
      weeklyCap = Math.min(weeklyCap, Number(input.maxWeeklyMiles));
    }
    const poolCap = weeklyMileageCeilingFromCyclePool({
      weekNumber: week.weekNumber,
      cycleLen: input.cycleLen,
      totalWeeks: input.totalWeeks,
      baseMiles: input.baseMiles,
      peakMiles: input.peakMiles,
      taperMiles: input.taperMiles,
    });
    if (poolCap != null) weeklyCap = Math.min(weeklyCap, poolCap);

    /** Race mileage */
    for (const d of week.days.filter((x) => x.workoutType === "Race")) {
      d.miles = round2(Math.max(input.raceDistanceMiles, 0));
    }

    /** If this week exists only as a race taper surface, bail after race miles set */
    if (week.days.length > 0 && week.days.every((d) => d.workoutType === "Race")) {
      continue;
    }

    /** Apply catalogue-derived miles to tempo / intervals */
    for (const d of week.days.filter((x) => x.workoutType === "Tempo")) {
      const id = d.catalogueWorkoutId;
      const row = id ? input.catalogueRowsById.get(id) : undefined;
      d.miles = estimateCatalogueWorkoutMiles(row ?? null, "Tempo");
    }
    for (const d of week.days.filter((x) => x.workoutType === "Intervals")) {
      const id = d.catalogueWorkoutId;
      const row = id ? input.catalogueRowsById.get(id) : undefined;
      d.miles = estimateCatalogueWorkoutMiles(row ?? null, "Intervals");
    }

    const lrSlots = week.days.filter((d) => d.workoutType === "LongRun");
    const tempoSlots = week.days.filter((d) => d.workoutType === "Tempo");
    const intervalSlots = week.days.filter((d) => d.workoutType === "Intervals");
    const easySlots = week.days.filter((d) => d.workoutType === "Easy");

    const sumL = () => lrSlots.reduce((s, d) => s + d.miles, 0);
    const sumT = () => tempoSlots.reduce((s, d) => s + d.miles, 0);
    const sumI = () => intervalSlots.reduce((s, d) => s + d.miles, 0);

    /** Shrink LR if quality + LR exceed cap before easy split */
    if (sumL() + sumT() + sumI() > weeklyCap) {
      const tgt = Math.max(0, weeklyCap - sumT() - sumI());
      if (lrSlots.length > 0) {
        const per = round2(Math.max(4, tgt / lrSlots.length));
        for (const d of lrSlots) d.miles = per;
      }
    }

    /** Simpler weekly sum */
    const weekSum = (): number => week.days.reduce((s, d) => s + d.miles, 0);

    let over = weekSum() - weeklyCap;

    const trimTempoIntervals = (): void => {
      over = weekSum() - weeklyCap;
      if (over <= 0.05) return;
      if (intervalSlots.length) {
        for (let idx = intervalSlots.length - 1; idx >= 0 && over > 0.05; idx--) {
          const d = intervalSlots[idx]!;
          const room = d.miles - minInterval;
          if (room <= 0) continue;
          const shave = Math.min(room, over);
          d.miles = round2(d.miles - shave);
          over -= shave;
        }
      }
      if (tempoSlots.length) {
        for (let idx = tempoSlots.length - 1; idx >= 0 && over > 0.05; idx--) {
          const d = tempoSlots[idx]!;
          const room = d.miles - minTempo;
          if (room <= 0) continue;
          const shave = Math.min(room, over);
          d.miles = round2(d.miles - shave);
          over -= shave;
        }
      }
    };

    /** Last resort LR trim */
    if (weekSum() > weeklyCap + 0.05 && lrSlots.length) {
      for (let guard = 0; guard < 5 && weekSum() > weeklyCap + 0.05; guard++) {
        over = weekSum() - weeklyCap;
        let moved = false;
        if (lrSlots.length) {
          for (let idx = lrSlots.length - 1; idx >= 0 && over > 0.05; idx--) {
            const d = lrSlots[idx]!;
            const room = d.miles - 8;
            if (room <= 0) continue;
            const shave = Math.min(room, over);
            d.miles = round2(d.miles - shave);
            over -= shave;
            moved = true;
          }
        }
        if (!moved) break;
      }
    }

    trimTempoIntervals();

    const easyBudget = Math.max(0, weeklyCap - weekSum());

    if (easyBudget > 0 && easySlots.length > 0) {
      const baseShare =
        Math.floor((easyBudget / easySlots.length) * 100) / 100;
      for (let i = 0; i < easySlots.length; i++) {
        const ep = easySlots[i]!;
        const m =
          i === easySlots.length - 1
            ? round2(easyBudget - baseShare * (easySlots.length - 1))
            : baseShare;
        ep.miles = m < 0.25 ? 0 : m;
      }
      const drift = weeklyCap - weekSum();
      if (Math.abs(drift) > 0.05 && easySlots[easySlots.length - 1]) {
        const last = easySlots[easySlots.length - 1]!;
        last.miles = Math.max(minEasyPerDay, round2(last.miles + drift));
      }
    }

    /** Shave easy overs */
    while (weekSum() > weeklyCap + 0.05) {
      const over2 = weekSum() - weeklyCap;
      let hit = false;
      for (
        let i = easySlots.length - 1;
        i >= 0 && weekSum() > weeklyCap + 0.05;
        i--
      ) {
        const d = easySlots[i]!;
        const room = d.miles - minEasyPerDay;
        if (room <= 0) continue;
        const shave = Math.min(room, weekSum() - weeklyCap);
        d.miles = round2(d.miles - shave);
        hit = true;
      }
      if (!hit) break;
    }
  }
}
