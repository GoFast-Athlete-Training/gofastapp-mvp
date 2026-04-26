import type { WorkoutType } from "@prisma/client";
import { defaultTaperLongRunsForWeeks } from "@/lib/training/preset-volume-helpers";

/**
 * Long-run engine: 4 positions per week block — static, progressive, MP, static (cutback).
 * Distances are forward-counting from plan start. Last block can be taper; second-to-last pre-peak.
 * Each week entry includes `catalogueSlug` for deterministic catalogue row lookup (`pickLongRunCatalogueBySlug`).
 */

export const LR_SLUGS = {
  static: "long-run-static",
  progressive: "long-run-progressive",
  mp: "long-run-mp",
} as const;

export type CatalogueRowWithSlug = {
  id: string;
  workoutType: WorkoutType;
  slug: string | null;
};

function slugForCyclePos(cyclePos: number): string | null {
  if (cyclePos === 0 || cyclePos === 3) return LR_SLUGS.static;
  if (cyclePos === 1) return LR_SLUGS.progressive;
  if (cyclePos === 2) return LR_SLUGS.mp;
  return null;
}

/**
 * Picks a long-run catalogue row by `slug` for the 4-position rotation. Returns null if missing.
 */
export function pickLongRunCatalogueBySlug(
  cyclePos: number,
  rows: readonly CatalogueRowWithSlug[]
): CatalogueRowWithSlug | null {
  const target = slugForCyclePos(cyclePos);
  if (!target) return null;
  return (
    rows.find((w) => w.workoutType === "LongRun" && w.slug === target) ?? null
  );
}

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
  /** Canonical catalogue `slug` for this position (e.g. long-run-mp for cyclePos 2). */
  catalogueSlug: string | null;
}

function roundMi(n: number): number {
  return Math.max(0, Math.round(n * 10) / 10);
}

/**
 * How many 4-week blocks the long-run engine allocates for a plan length.
 * `numSlots` in `generateLongRunSchedule` (last block = taper, second-to-last = pre-peak when slots ≥ 3).
 */
export function longRunBlockCountFromTotalWeeks(totalWeeks: number): number {
  const w = Math.max(1, Math.floor(totalWeeks));
  return Math.max(1, Math.ceil(w / 4));
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
  const numSlots = longRunBlockCountFromTotalWeeks(w);
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
    const catalogueSlug = slugForCyclePos(cyclePos);

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
      catalogueSlug,
    });
  }

  return out;
}

/** Maps peak-cycle pool (sum of long-run miles in the peak block) to a long-run cap for the step engine. */
function longRunMaxFromCyclePeakPool(cyclePeakPool: number | undefined | null): number {
  if (cyclePeakPool != null && Number.isFinite(cyclePeakPool) && Number(cyclePeakPool) > 0) {
    return Math.max(8, Math.round(Number(cyclePeakPool) * 0.28 * 10) / 10);
  }
  return 22;
}

/**
 * Merges preset / generator defaults into `LongRunServiceConfig` for a plan.
 * `cyclePeakPool` anchors max distance; internal taper still uses the last 4-week block in the LRE.
 */
export function longRunConfigFromPlanGen(
  totalWeeks: number,
  cfg?: { minLongMiles?: number; cyclePeakPool?: number | null }
): LongRunServiceConfig {
  const minL = cfg?.minLongMiles ?? 8;
  const startBase = Math.max(8, minL);
  return {
    totalWeeks,
    startBase,
    step: 2,
    longRunMin: minL,
    longRunMax: longRunMaxFromCyclePeakPool(cfg?.cyclePeakPool),
  };
}
