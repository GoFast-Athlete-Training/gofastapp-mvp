/**
 * Derives per–macro-cycle long-run POOL totals spanning totalWeeks × longRunCycleWeeks.
 */

import { LONG_RUN_BLOCK_WEEKS } from "@/lib/training/long-run-block-weeks";

function round1(n: number): number {
  const x = Math.max(0, Number(n));
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10) / 10;
}

export type LongRunCupSetterInput = {
  totalWeeks: number;
  longRunCycleWeeks?: number;
  baseLongRunPoolMiles: number;
  peakLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
};

export type LongRunCupSetterResult = {
  nCycles: number;
  poolMilesByCycle: number[];
};

export function longRunCupSetter(input: LongRunCupSetterInput): LongRunCupSetterResult {
  const len = Math.max(1, Math.floor(input.longRunCycleWeeks ?? LONG_RUN_BLOCK_WEEKS));
  const w = Math.max(1, Math.floor(input.totalWeeks));
  const N = Math.max(1, Math.ceil(w / len));

  let base = Math.max(0.1, Number(input.baseLongRunPoolMiles));
  if (!Number.isFinite(base)) base = 1;

  let peak = Number(input.peakLongRunPoolMiles);
  if (!Number.isFinite(peak) || peak < base) {
    peak = Math.max(base, base * 1.15);
  } else {
    peak = Math.max(base, peak);
  }

  let taperNum = Number(input.taperLongRunPoolMiles);
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
