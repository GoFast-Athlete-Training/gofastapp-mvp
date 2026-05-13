/**
 * Macro-cycle layout for taper / peak-block detection.
 * `cycleLen` must match the preset’s long-run rotation block (weeks).
 */

/**
 * Number of contiguous macro blocks spanning totalWeeks.
 */
export function longRunBlockCountFromTotalWeeks(totalWeeks: number, cycleLen: number): number {
  const w = Math.max(1, Math.floor(totalWeeks));
  const len = Math.max(1, Math.floor(cycleLen));
  return Math.max(1, Math.ceil(w / len));
}

export type WeekCycleMeta = {
  /** 1-based macro block index starting at block 1 for week 1 */
  cycleSlot: number;
  /** 0..cycleLen-1 position inside the macro block */
  cyclePos: number;
  /** Total macro blocks (= ceil(totalWeeks/cycleLen)) */
  numSlots: number;
  isTaper: boolean;
  isPrePeak: boolean;
};

/**
 * Aligns calendar week indexes with the taper / pre-peak convention used by assign-workout-days.
 */
export function weekCycleMeta(params: {
  weekNumber: number;
  totalWeeks: number;
  cycleLen: number;
}): WeekCycleMeta {
  const cycleLen = Math.max(1, Math.floor(params.cycleLen));
  const totalWeeks = Math.max(1, Math.floor(params.totalWeeks));
  const numSlots = longRunBlockCountFromTotalWeeks(totalWeeks, cycleLen);
  const wi = Math.max(0, params.weekNumber - 1);
  const cycleNum0 = Math.floor(wi / cycleLen);
  const cycleSlot = cycleNum0 + 1;
  const cyclePos = wi % cycleLen;

  const isTaper = numSlots >= 2 && cycleNum0 === numSlots - 1;
  const isPrePeak = numSlots >= 3 && cycleNum0 === numSlots - 2;

  return {
    cycleSlot,
    cyclePos,
    numSlots,
    isTaper,
    isPrePeak,
  };
}

/** First calendar week index (1-based) of the taper macro block */
export function taperStartWeekNumberFromTotal(totalWeeks: number, cycleLen: number): number {
  const len = Math.max(1, Math.floor(cycleLen));
  const numSlots = longRunBlockCountFromTotalWeeks(totalWeeks, len);
  const taperSlot0 = numSlots - 1;
  return taperSlot0 * len + 1;
}

/** Best-effort peak week marker: midpoint of final build block immediately before taper */
export function peakWeekNumberFromTotal(totalWeeks: number, cycleLen: number): number | null {
  const len = Math.max(1, Math.floor(cycleLen));
  const meta = weekCycleMeta({ weekNumber: 1, totalWeeks, cycleLen: len });
  const numSlots = meta.numSlots;
  if (numSlots < 2) return null;
  const peakSlot = numSlots - 2;
  return peakSlot >= 0 ? peakSlot * len + Math.min(len, Math.floor(len / 2) + 1) : null;
}

/** Cap for longest single LR in a marathon-style block (~28% of peak weekly mileage) */
export function longRunCapMilesFromPeakWeekly(peakWeeklyMiles: number | null | undefined): number {
  const p =
    peakWeeklyMiles != null &&
    Number.isFinite(Number(peakWeeklyMiles)) &&
    Number(peakWeeklyMiles) > 0
      ? Number(peakWeeklyMiles)
      : null;
  if (p != null) {
    return Math.max(8, Math.round(p * 0.28 * 10) / 10);
  }
  return 22;
}
