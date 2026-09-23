/**
 * Preset core meta — five numbers staff and athletes confirm.
 * Column names on training_plan_preset are unchanged; see docs/PRESET_MILES_CANON.md.
 */

import type { WeeklyWorkoutComposition } from "@/lib/training/preset-strategy";

export type PresetCoreMeta = {
  longRunPeakMiles: number | null;
  weeklyVolumePeakMiles: number;
  weeklyAverageMiles: number;
  totalRunsPerWeek: number;
  totalQualitySessionsPerWeek: number;
};

export type PresetCoreSource = {
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  coachPlanOverview: unknown;
  /** Legacy 4-week pool — not the long-run peak when it looks like a block total (>35). */
  peakLongRunPoolMiles?: number | null;
};

const DEFAULT_COMPOSITION: WeeklyWorkoutComposition = {
  easy: 3,
  tempo: 1,
  intervals: 1,
  longRun: 1,
  cadenceWeeks: 1,
};

/** Stub until plan generate defines the real curve. */
export function calculateWeeklyAverageFromVolumePeak(weeklyVolumePeakMiles: number): number {
  const peak = Math.max(1, Math.round(weeklyVolumePeakMiles));
  return Math.round(peak * 0.88);
}

function readComposition(raw: unknown): WeeklyWorkoutComposition {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_COMPOSITION };
  }
  const o = raw as Record<string, unknown>;
  const wc =
    o.weeklyWorkoutComposition &&
    typeof o.weeklyWorkoutComposition === "object" &&
    !Array.isArray(o.weeklyWorkoutComposition)
      ? (o.weeklyWorkoutComposition as Record<string, unknown>)
      : {};
  const num = (v: unknown, fb: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : fb;
  return {
    easy: num(wc.easy, DEFAULT_COMPOSITION.easy),
    tempo: num(wc.tempo, DEFAULT_COMPOSITION.tempo),
    intervals: num(wc.intervals, DEFAULT_COMPOSITION.intervals),
    longRun: num(wc.longRun, DEFAULT_COMPOSITION.longRun),
    cadenceWeeks: Math.max(1, num(wc.cadenceWeeks, DEFAULT_COMPOSITION.cadenceWeeks)),
  };
}

function readLongRunPeakFromOverview(raw: unknown): number | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const lr = o.longRunStructure;
  if (lr == null || typeof lr !== "object" || Array.isArray(lr)) return null;
  const peak = Number((lr as Record<string, unknown>).peakLongRunMiles);
  if (!Number.isFinite(peak) || peak <= 0) return null;
  return Math.round(peak * 10) / 10;
}

function legacyPoolLooksLikeSingleRun(pool: number | null | undefined): number | null {
  const p = Number(pool);
  if (!Number.isFinite(p) || p <= 0 || p > 35) return null;
  return Math.round(p * 10) / 10;
}

export function weeklyVolumePeakFromPreset(input: Pick<PresetCoreSource, "minWeeklyMiles" | "maxWeeklyMiles">): number {
  const max = input.maxWeeklyMiles;
  if (max != null && Number.isFinite(max) && max > 0) return Math.round(max);
  return Math.max(1, Math.round(input.minWeeklyMiles));
}

export function presetCoreFromPreset(input: PresetCoreSource): PresetCoreMeta {
  const composition = readComposition(input.coachPlanOverview);
  const weeklyVolumePeakMiles = weeklyVolumePeakFromPreset(input);
  const weeklyAverageMiles = calculateWeeklyAverageFromVolumePeak(weeklyVolumePeakMiles);

  const longRunPeakMiles =
    readLongRunPeakFromOverview(input.coachPlanOverview) ??
    legacyPoolLooksLikeSingleRun(input.peakLongRunPoolMiles);

  const totalRunsPerWeek =
    composition.easy + composition.tempo + composition.intervals + composition.longRun;
  const totalQualitySessionsPerWeek = composition.tempo + composition.intervals;

  return {
    longRunPeakMiles,
    weeklyVolumePeakMiles,
    weeklyAverageMiles,
    totalRunsPerWeek,
    totalQualitySessionsPerWeek,
  };
}

/** Merge core edits into coachPlanOverview JSON for PATCH. */
export function mergeCoachPlanOverviewForCore(
  existing: unknown,
  patch: {
    longRunPeakMiles?: number | null;
    weeklyVolumePeakMiles?: number;
    totalRunsPerWeek?: number;
    totalQualitySessionsPerWeek?: number;
  },
): Record<string, unknown> {
  const base: Record<string, unknown> =
    existing != null && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : { summary: "Build preset" };

  if (!base.summary || typeof base.summary !== "string") {
    base.summary = "Build preset";
  }

  const composition = readComposition(base);
  if (patch.totalQualitySessionsPerWeek != null) {
    const q = Math.max(0, Math.round(patch.totalQualitySessionsPerWeek));
    const tempo = Math.min(composition.tempo, q);
    composition.tempo = tempo;
    composition.intervals = Math.max(0, q - tempo);
  }
  if (patch.totalRunsPerWeek != null) {
    const total = Math.max(
      composition.tempo + composition.intervals + composition.longRun,
      Math.round(patch.totalRunsPerWeek),
    );
    composition.easy = Math.max(
      0,
      total - composition.tempo - composition.intervals - composition.longRun,
    );
  }
  base.weeklyWorkoutComposition = composition;

  const wv =
    base.weeklyVolume && typeof base.weeklyVolume === "object" && !Array.isArray(base.weeklyVolume)
      ? { ...(base.weeklyVolume as Record<string, unknown>) }
      : {};
  if (patch.weeklyVolumePeakMiles != null) {
    wv.max = Math.round(patch.weeklyVolumePeakMiles);
  }
  base.weeklyVolume = wv;

  if (patch.longRunPeakMiles != null) {
    const lr =
      base.longRunStructure &&
      typeof base.longRunStructure === "object" &&
      !Array.isArray(base.longRunStructure)
        ? { ...(base.longRunStructure as Record<string, unknown>) }
        : {};
    if (patch.longRunPeakMiles <= 0) {
      delete lr.peakLongRunMiles;
    } else {
      lr.peakLongRunMiles = Math.round(patch.longRunPeakMiles * 10) / 10;
    }
    base.longRunStructure = lr;
  }

  return base;
}
