/**
 * Peak-only long-run cup service.
 * The cup is the 4-Saturday peak block pool. Partial cycles scale by weeks/4.
 * BASE fitnessPhase ramps gently into peak; PEAK starts at full peak pool.
 */

import { LONG_RUN_BLOCK_WEEKS } from "@/lib/training/long-run-block-weeks";

const TAPER_CALENDAR_WEEKS = 2;
const BASE_RAMP_START = 0.88;

function round1(n: number): number {
  const x = Math.max(0, Number(n));
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10) / 10;
}

export type LongRunFitnessPhase = "BASE" | "PEAK";

export type LongRunCupSetterInput = {
  totalWeeks: number;
  longRunCycleWeeks?: number;
  peakLongRunPoolMiles: number;
  fitnessPhase?: LongRunFitnessPhase;
  /** @deprecated ignored — derived from peak for storage only */
  baseLongRunPoolMiles?: number;
  /** @deprecated ignored — derived from peak for storage only */
  taperLongRunPoolMiles?: number;
};

export type LongRunCupSetterResult = {
  nCycles: number;
  poolMilesByCycle: number[];
  /** Calendar weeks in each macro block (1–4) — drives rotation weight normalization */
  weeksInCycle: number[];
  /** Display/storage helpers derived from peak — not generation drivers */
  derivedBaseLongRunPoolMiles: number;
  derivedTaperLongRunPoolMiles: number;
};

export function deriveLongRunPoolTripletFromPeak(peakLongRunPoolMiles: number): {
  baseLongRunPoolMiles: number;
  peakLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
} {
  const peak = round1(peakLongRunPoolMiles);
  return {
    peakLongRunPoolMiles: peak,
    baseLongRunPoolMiles: round1(peak * BASE_RAMP_START),
    taperLongRunPoolMiles: round1(peak * (TAPER_CALENDAR_WEEKS / LONG_RUN_BLOCK_WEEKS)),
  };
}

function weeksInMacroBlock(
  cycleIdx: number,
  totalWeeks: number,
  blockWeeks: number
): number {
  const startWeek = cycleIdx * blockWeeks + 1;
  if (startWeek > totalWeeks) return 0;
  return Math.min(blockWeeks, totalWeeks - cycleIdx * blockWeeks);
}

function taperStartWeek(totalWeeks: number): number {
  const w = Math.max(1, Math.floor(totalWeeks));
  return Math.max(1, w - TAPER_CALENDAR_WEEKS + 1);
}

function cycleEndWeek(cycleIdx: number, blockWeeks: number): number {
  return (cycleIdx + 1) * blockWeeks;
}

function rampMultiplier(
  cycleIdx: number,
  buildCycleCount: number,
  fitnessPhase: LongRunFitnessPhase
): number {
  if (fitnessPhase === "PEAK" || buildCycleCount <= 1) return 1;
  const t = cycleIdx / Math.max(1, buildCycleCount - 1);
  return BASE_RAMP_START + (1 - BASE_RAMP_START) * t;
}

export function longRunCupSetter(input: LongRunCupSetterInput): LongRunCupSetterResult {
  const blockWeeks = Math.max(1, Math.floor(input.longRunCycleWeeks ?? LONG_RUN_BLOCK_WEEKS));
  const totalWeeks = Math.max(1, Math.floor(input.totalWeeks));
  const peakRaw = Number(input.peakLongRunPoolMiles);
  if (!Number.isFinite(peakRaw) || peakRaw <= 0) {
    throw new Error("peakLongRunPoolMiles must be a positive number");
  }
  const peak = round1(peakRaw);
  const fitnessPhase: LongRunFitnessPhase =
    input.fitnessPhase === "PEAK" ? "PEAK" : "BASE";

  const nCycles = Math.max(1, Math.ceil(totalWeeks / blockWeeks));
  const taperFrom = taperStartWeek(totalWeeks);

  const buildCycleIndices: number[] = [];
  for (let i = 0; i < nCycles; i++) {
    const cycleStart = i * blockWeeks + 1;
    const cycleEnd = Math.min(totalWeeks, cycleEndWeek(i, blockWeeks));
    if (cycleEnd < taperFrom) buildCycleIndices.push(i);
  }
  const buildCycleCount = Math.max(1, buildCycleIndices.length);

  const poolMilesByCycle: number[] = [];
  const weeksInCycle: number[] = [];

  for (let cycleIdx = 0; cycleIdx < nCycles; cycleIdx++) {
    const weeks = weeksInMacroBlock(cycleIdx, totalWeeks, blockWeeks);
    weeksInCycle.push(weeks);
    let pool = peak * (weeks / blockWeeks);

    const cycleEnd = Math.min(totalWeeks, cycleEndWeek(cycleIdx, blockWeeks));
    const isBuildCycle = cycleEnd < taperFrom;
    if (isBuildCycle) {
      const buildIdx = buildCycleIndices.indexOf(cycleIdx);
      const rampIdx = buildIdx >= 0 ? buildIdx : 0;
      pool *= rampMultiplier(rampIdx, buildCycleCount, fitnessPhase);
    }

    poolMilesByCycle.push(round1(pool));
  }

  const derived = deriveLongRunPoolTripletFromPeak(peak);

  return {
    nCycles,
    poolMilesByCycle,
    weeksInCycle,
    derivedBaseLongRunPoolMiles: derived.baseLongRunPoolMiles,
    derivedTaperLongRunPoolMiles: derived.taperLongRunPoolMiles,
  };
}
