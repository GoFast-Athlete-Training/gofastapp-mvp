/**
 * Cycle-pool: per-cycle long-run "pool" miles derived from peak + build/taper coefficients,
 * then split across run_type_config positions by distribution weights.
 */

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type GenerateCyclePoolTotalsInput = {
  totalWeeks: number;
  cycleLen?: number;
  /** Miles in the long-run peak block (1-based cycle N-1). */
  longRunPeakPool: number;
  buildCoef: number;
  taperCoef: number;
  /** 1-based keys: multiplier used when walking from cycle `key` to `key-1` (see loop). */
  multiplierOverrides?: Record<number, number>;
};

/**
 * 1-based cycle indices 1..N. Anchors: pool[N-1] = peak, pool[N] = peak * taperCoef; backward fill.
 */
export function generateCyclePoolTotals(input: GenerateCyclePoolTotalsInput): {
  nCycles: number;
  /** one entry per training cycle, index 0 = cycle 1 */
  poolMilesByCycle: number[];
} {
  const { totalWeeks, longRunPeakPool, buildCoef, taperCoef, multiplierOverrides = {} } = input;
  const cycleLen = Math.max(1, input.cycleLen ?? 4);
  const w = Math.max(1, Math.floor(totalWeeks));
  const N = Math.max(1, Math.ceil(w / cycleLen));
  const peak = Number(longRunPeakPool);
  if (!Number.isFinite(peak) || peak < 0) {
    return { nCycles: N, poolMilesByCycle: Array(N).fill(0) };
  }
  const b = Number.isFinite(buildCoef) && buildCoef > 0 ? buildCoef : 1.12;
  const t = Number.isFinite(taperCoef) && taperCoef > 0 ? taperCoef : 0.85;

  if (N === 1) {
    // Single cycle: use taper pool as the only value (or peak — arbitrary; use peak)
    return { nCycles: 1, poolMilesByCycle: [round1(peak)] };
  }

  // 1-based array length N+1, index 0 unused
  const value: number[] = new Array(N + 1).fill(0);
  value[N - 1] = peak;
  value[N] = peak * t;

  for (let i = N - 2; i >= 1; i--) {
    const m = multiplierOverrides[i + 1] ?? b;
    const coef = Number.isFinite(m) && m > 0 ? m : b;
    value[i] = value[i + 1] / coef;
  }

  const poolMilesByCycle = new Array(N);
  for (let c = 1; c <= N; c++) {
    poolMilesByCycle[c - 1] = round1(value[c] ?? 0);
  }
  return { nCycles: N, poolMilesByCycle };
}

export type RunTypeWeightRow = {
  cyclePosition: number;
  /** Optional label; if omitted, consumers may use catalogue name or a slot index. */
  name?: string;
  distributionWeight: number;
  catalogueWorkoutId?: string | null;
};

export type PoolPositionMiles = {
  cyclePosition: number;
  name: string;
  miles: number;
  distributionWeight: number;
  catalogueWorkoutId: string | null;
};

/**
 * Splits a cycle pool across positions. Weights are proportional; they need not sum to 1.0.
 */
export function distributePoolToPositions(
  cyclePool: number,
  positions: readonly RunTypeWeightRow[]
): PoolPositionMiles[] {
  const pool = Math.max(0, Number(cyclePool));
  if (!Number.isFinite(pool)) {
    return [];
  }
  const rows = [...positions].sort((a, b) => a.cyclePosition - b.cyclePosition);
  const wsum = rows.reduce(
    (s, r) => s + (Number.isFinite(r.distributionWeight) ? Math.max(0, r.distributionWeight) : 0),
    0
  );
  if (rows.length === 0) return [];
  if (wsum <= 0) {
    return rows.map((r) => ({
      cyclePosition: r.cyclePosition,
      name: r.name?.trim() || `Slot ${r.cyclePosition}`,
      miles: 0,
      distributionWeight: r.distributionWeight,
      catalogueWorkoutId: r.catalogueWorkoutId ?? null,
    }));
  }
  return rows.map((r) => {
    const w = Number.isFinite(r.distributionWeight) ? Math.max(0, r.distributionWeight) : 0;
    const share = w / wsum;
    return {
      cyclePosition: r.cyclePosition,
      name: r.name?.trim() || `Slot ${r.cyclePosition}`,
      miles: round1(pool * share),
      distributionWeight: r.distributionWeight,
      catalogueWorkoutId: r.catalogueWorkoutId ?? null,
    };
  });
}
