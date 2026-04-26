import { defaultTaperLongRunsForWeeks } from "@/lib/training/preset-volume-helpers";

/**
 * Long-run engine: 4 positions per week block — static, progressive, MP, static (cutback).
 * Distances are forward-counting from plan start. Last block can be taper; second-to-last pre-peak.
 */

export interface LongRunServiceConfig {
  totalWeeks: number;
  startBase: number;
  step: number;
  longRunMin: number;
  longRunMax: number;
  /** Cutback week as fraction of push miles (the dynamic/MP week). Default 0.65 */
  cutbackFraction?: number;
  /** Optional explicit taper long-run miles (furthest from race first). */
  taperLongRuns?: number[];
}

export interface LongRunEntry {
  weekIndex: number;
  cycleNum: number;
  cyclePos: number;
  isPrePeak: boolean;
  isTaper: boolean;
  /** Planned long run distance in miles for this week (0 = no long run that week) */
  distance: number;
}

function roundMi(n: number): number {
  return Math.max(0, Math.round(n * 10) / 10);
}

function buildTaperMiles4(longRunMax: number, override?: number[] | null): [number, number, number, number] {
  if (override && override.length >= 4) {
    const a = override.map((x) => (Number.isFinite(x) ? Math.max(0, x) : 0));
    return [a[0]!, a[1]!, a[2]!, a[3]!];
  }
  if (override && override.length > 0) {
    const t = override.map((x) => (Number.isFinite(x) ? Math.max(0, x) : 0));
    if (t.length === 3) {
      return [t[0]!, t[1]!, t[2]!, 0];
    }
    if (t.length === 1) {
      return [t[0]!, roundMi(longRunMax * 0.43), 0, 0];
    }
  }
  const d = defaultTaperLongRunsForWeeks(4);
  if (d.length >= 4) {
    return [d[0]!, d[1]!, d[2]!, d[3]!] as [number, number, number, number];
  }
  // Default descent from peak
  return [
    roundMi(longRunMax * 0.68),
    roundMi(longRunMax * 0.43),
    Math.max(0, roundMi(longRunMax * 0.18)),
    0,
  ];
}

/**
 * Produces one long-run distance per plan week, aligned with 4-position rotation.
 * `numSlots` = number of 4-week blocks (ceil(weeks/4)). Last slot = taper, second-to-last = pre-peak.
 */
export function generateLongRunSchedule(cfg: LongRunServiceConfig): LongRunEntry[] {
  const {
    totalWeeks,
    startBase,
    step,
    longRunMin,
    longRunMax,
    cutbackFraction = 0.65,
    taperLongRuns: taperOverride,
  } = cfg;

  const w = Math.max(1, Math.floor(totalWeeks));
  const numSlots = Math.max(1, Math.ceil(w / 4));
  const out: LongRunEntry[] = [];

  const taperMiles4 = buildTaperMiles4(
    longRunMax,
    Array.isArray(taperOverride) && taperOverride.length > 0
      ? (taperOverride as number[])
      : null
  );

  for (let weekIndex = 0; weekIndex < w; weekIndex++) {
    const cycleNum = Math.floor(weekIndex / 4);
    const cyclePos = weekIndex % 4;
    const isTaper = numSlots >= 2 && cycleNum === numSlots - 1;
    const isPrePeak = numSlots >= 3 && cycleNum === numSlots - 2;

    let distance = 0;

    if (isTaper) {
      distance = roundMi(taperMiles4[cyclePos] ?? 0);
    } else {
      const N = Math.min(
        longRunMax,
        Math.max(longRunMin, startBase + cycleNum * step)
      );
      const push = Math.min(longRunMax, N + step);
      if (isPrePeak) {
        if (cyclePos === 0 || cyclePos === 1) {
          distance = N;
        } else if (cyclePos === 2) {
          distance = longRunMax;
        } else {
          distance = Math.max(
            longRunMin,
            roundMi(push * cutbackFraction)
          );
        }
      } else {
        if (cyclePos === 0 || cyclePos === 1) {
          distance = N;
        } else if (cyclePos === 2) {
          distance = push;
        } else {
          distance = Math.max(
            longRunMin,
            roundMi(push * cutbackFraction)
          );
        }
      }
    }

    out.push({
      weekIndex,
      cycleNum,
      cyclePos,
      isPrePeak,
      isTaper,
      distance,
    });
  }

  return out;
}

/**
 * Merges preset / generator defaults into `LongRunServiceConfig` for a plan.
 */
export function longRunConfigFromPlanGen(
  totalWeeks: number,
  cfg?: {
    baseStartMiles?: number;
    ladderStep?: number;
    minLongMiles?: number;
    peakLongRunMiles?: number;
    cutbackFraction?: number | null;
    taperLongRuns?: number[];
  }
): LongRunServiceConfig {
  return {
    totalWeeks,
    startBase: cfg?.baseStartMiles ?? 12,
    step: cfg?.ladderStep ?? 2,
    longRunMin: cfg?.minLongMiles ?? 8,
    longRunMax: cfg?.peakLongRunMiles ?? 22,
    cutbackFraction:
      cfg?.cutbackFraction != null && Number.isFinite(cfg.cutbackFraction)
        ? cfg.cutbackFraction
        : undefined,
    taperLongRuns: cfg?.taperLongRuns,
  };
}
