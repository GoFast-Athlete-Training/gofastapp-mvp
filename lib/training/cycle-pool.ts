/**
 * Cycle-pool: per–training-cycle long-run "pool" miles from explicit peak/taper anchors
 * and a stored build coefficient (geometric build toward peak), split across
 * long_run_config positions by distribution weights.
 */

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type GenerateCyclePoolTotalsInput = {
  totalWeeks: number;
  cycleLen?: number;
  /** Long-run pool in the peak block (cycle N-1, 0-based: index N-2 in pool array for N cycles). */
  peakMiles: number;
  /** Long-run pool in the taper block (last cycle N). */
  taperMiles: number;
  /** Per-cycle growth when walking backward from peak (pool[i] = pool[i+1] / buildCoef). */
  buildCoef: number;
  /** 1-based keys: override multiplier for step from pool index `key-1` to `key-2` (see loop). */
  multiplierOverrides?: Record<number, number>;
};

/**
 * @param numBuildSteps — number of build steps (multiplications) from `baseMiles` to `peakMiles` used for UI: peak ≈ base * buildCoef^numBuildSteps
 */
export function computeBuildCoef(
  baseMiles: number,
  peakMiles: number,
  numBuildSteps: number
): number {
  const b = Number(baseMiles);
  const p = Number(peakMiles);
  const s = Math.max(1, Math.floor(numBuildSteps));
  if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(p) || p <= 0) {
    return 1.12;
  }
  return p / b > 0 ? Math.pow(p / b, 1 / s) : 1.12;
}

/**
 * 1-based cycle indices 1..N. pool[N-1] = peak, pool[N] = taper; backward fill through build.
 */
export function generateCyclePoolTotals(
  input: GenerateCyclePoolTotalsInput
): {
  nCycles: number;
  /** one entry per training cycle, index 0 = cycle 1 */
  poolMilesByCycle: number[];
} {
  const { totalWeeks, peakMiles, taperMiles, buildCoef, multiplierOverrides = {} } = input;
  const cycleLen = Math.max(1, input.cycleLen ?? 4);
  const w = Math.max(1, Math.floor(totalWeeks));
  const N = Math.max(1, Math.ceil(w / cycleLen));
  const peak = Number(peakMiles);
  const tap = Number(taperMiles);
  if (!Number.isFinite(peak) || peak < 0) {
    return { nCycles: N, poolMilesByCycle: Array(N).fill(0) };
  }
  const b = Number.isFinite(buildCoef) && buildCoef > 0 ? buildCoef : 1.12;
  const taperPool = Number.isFinite(tap) && tap >= 0 ? tap : peak * 0.85;

  if (N === 1) {
    return { nCycles: 1, poolMilesByCycle: [round1(peak)] };
  }

  const value: number[] = new Array(N + 1).fill(0);
  value[N - 1] = peak;
  value[N] = taperPool;

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
