/**
 * Derives per–macro-cycle long-run POOL totals (preset long-run pool anchors)
 * spanning the athlete's `totalWeeks × cycleLen` layout.
 *
 * Geometric cup: peak cycle index derives from total cycles N (~65% through), not a
 * fixed second-to-last slot. Ramp base→peak compounds with one coefficient; ramp
 * peak→taper compounds with another — gradual downshift instead of a cliff before taper.
 */

function round1(n: number): number {
  const x = Math.max(0, Number(n));
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10) / 10;
}

export type LongRunCupSetterInput = {
  totalWeeks: number;
  cycleLen: number;
  /** LR pool aggregate for first / base macro block (miles). */
  baseMiles: number;
  /** LR anchor for peak mileage (mile pool target at the geometric peak cycle). */
  peakMiles: number;
  /** LR pool aggregate target for taper (last macro cycle miles). */
  taperMiles: number;
};

export type LongRunCupSetterResult = {
  nCycles: number;
  /** LR pool totals per macro cycle index 0..N−1. */
  poolMilesByCycle: number[];
};

/**
 * Places base → geometric build → geometric step-down → taper across
 * `N = ⌈totalWeeks / cycleLen⌉` cycles.
 */
export function longRunCupSetter(input: LongRunCupSetterInput): LongRunCupSetterResult {
  const len = Math.max(1, Math.floor(input.cycleLen));
  const w = Math.max(1, Math.floor(input.totalWeeks));
  const N = Math.max(1, Math.ceil(w / len));

  let base = Math.max(0.1, Number(input.baseMiles));
  if (!Number.isFinite(base)) base = 1;

  let peak = Number(input.peakMiles);
  if (!Number.isFinite(peak) || peak < base) {
    peak = Math.max(base, base * 1.15);
  } else {
    peak = Math.max(base, peak);
  }

  let taperNum = Number(input.taperMiles);
  if (!Number.isFinite(taperNum) || taperNum < 0) {
    taperNum = peak * 0.85;
  }
  const taper = Math.max(0.1, Math.min(taperNum, peak));

  if (N === 1) {
    return { nCycles: 1, poolMilesByCycle: [round1(peak)] };
  }
  if (N === 2) {
    return { nCycles: 2, poolMilesByCycle: [round1(base), round1(taper)] };
  }

  const peakIdx = Math.max(1, Math.min(N - 2, Math.round((N - 1) * 0.65)));

  const upCoef = Math.pow(peak / base, 1 / peakIdx);
  const downSteps = N - 1 - peakIdx;
  const downCoef = Math.pow(taper / peak, 1 / downSteps);

  const pool = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    if (i <= peakIdx) {
      pool[i] = round1(base * Math.pow(upCoef, i));
    } else {
      pool[i] = round1(peak * Math.pow(downCoef, i - peakIdx));
    }
  }

  return { nCycles: N, poolMilesByCycle: pool };
}
