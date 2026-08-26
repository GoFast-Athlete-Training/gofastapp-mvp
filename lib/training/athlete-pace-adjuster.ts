import type { WorkoutType } from "@prisma/client";

/** Per-run-type sec/mi nudge on top of catalogue offset + 5K anchor. Negative = faster. */
export type AthletePaceAdjuster = {
  easy: number;
  longRun: number;
  threshold: number;
  interval: number;
};

export const DEFAULT_ATHLETE_PACE_ADJUSTER: AthletePaceAdjuster = {
  easy: -10,
  longRun: -20,
  threshold: -20,
  interval: -10,
};

export type AthletePaceAdjusterRow = {
  paceAdjusterEasySecPerMile?: number | null;
  paceAdjusterLongRunSecPerMile?: number | null;
  paceAdjusterThresholdSecPerMile?: number | null;
  paceAdjusterIntervalSecPerMile?: number | null;
};

export function parseAthletePaceAdjuster(row: AthletePaceAdjusterRow | null | undefined): AthletePaceAdjuster {
  const d = DEFAULT_ATHLETE_PACE_ADJUSTER;
  if (!row) return { ...d };
  const num = (v: unknown, fallback: number) => {
    if (v == null || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  };
  return {
    easy: num(row.paceAdjusterEasySecPerMile, d.easy),
    longRun: num(row.paceAdjusterLongRunSecPerMile, d.longRun),
    threshold: num(row.paceAdjusterThresholdSecPerMile, d.threshold),
    interval: num(row.paceAdjusterIntervalSecPerMile, d.interval),
  };
}

export function adjusterForWorkoutType(
  workoutType: WorkoutType | string,
  adjuster: AthletePaceAdjuster
): number {
  switch (workoutType) {
    case "Easy":
      return adjuster.easy;
    case "LongRun":
      return adjuster.longRun;
    case "Tempo":
      return adjuster.threshold;
    case "Intervals":
      return adjuster.interval;
    default:
      return 0;
  }
}

export function parseAdjusterPatch(body: Record<string, unknown>): AthletePaceAdjuster | null {
  const raw = body.paceAdjuster;
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const num = (v: unknown, fallback: number) => {
      if (v == null || v === "") return fallback;
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : fallback;
    };
    return {
      easy: num(o.easy, DEFAULT_ATHLETE_PACE_ADJUSTER.easy),
      longRun: num(o.longRun, DEFAULT_ATHLETE_PACE_ADJUSTER.longRun),
      threshold: num(o.threshold, DEFAULT_ATHLETE_PACE_ADJUSTER.threshold),
      interval: num(o.interval, DEFAULT_ATHLETE_PACE_ADJUSTER.interval),
    };
  }
  const keys = ["easy", "longRun", "threshold", "interval"] as const;
  const hasAny = keys.some((k) => k in body);
  if (!hasAny) return null;
  const num = (v: unknown, fallback: number) => {
    if (v == null || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  };
  return {
    easy: num(body.easy, DEFAULT_ATHLETE_PACE_ADJUSTER.easy),
    longRun: num(body.longRun, DEFAULT_ATHLETE_PACE_ADJUSTER.longRun),
    threshold: num(body.threshold, DEFAULT_ATHLETE_PACE_ADJUSTER.threshold),
    interval: num(body.interval, DEFAULT_ATHLETE_PACE_ADJUSTER.interval),
  };
}

export function adjusterToAthleteColumns(adj: AthletePaceAdjuster): {
  paceAdjusterEasySecPerMile: number;
  paceAdjusterLongRunSecPerMile: number;
  paceAdjusterThresholdSecPerMile: number;
  paceAdjusterIntervalSecPerMile: number;
} {
  return {
    paceAdjusterEasySecPerMile: adj.easy,
    paceAdjusterLongRunSecPerMile: adj.longRun,
    paceAdjusterThresholdSecPerMile: adj.threshold,
    paceAdjusterIntervalSecPerMile: adj.interval,
  };
}
