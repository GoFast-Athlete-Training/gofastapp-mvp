/**
 * Swim plan preset volume, taxonomy, and validation helpers.
 * Standalone from run `training_plan_preset` — triathlon presets will compose swim/bike/run later.
 */

import type { SwimWorkoutType } from "@prisma/client";

export const SWIM_WORKOUT_TYPES = [
  "EnduranceSwim",
  "ThresholdSwim",
  "PowerSwim",
  "LongSwim",
] as const satisfies readonly SwimWorkoutType[];

export type SwimWorkoutTypeKey = (typeof SWIM_WORKOUT_TYPES)[number];

/** Default: recommended weekly meters = goal distance × 4 */
export const DEFAULT_SWIM_RECOMMENDATION_MULTIPLIER = 4;

export const DEFAULT_MIN_WEEKLY_METERS = 4000;
export const DEFAULT_TAPER_WEEKS = 2;
export const DEFAULT_TAPER_VOLUME_MULTIPLIER = 0.5;
export const DEFAULT_LONG_SWIM_SHARE_OF_WEEK = 0.28;

export type SwimWeeklyProgressionPattern = {
  /** Per-week multipliers within one cycle (length should match preset cycleLen). */
  weekMultipliers: number[];
};

export type SwimPresetVolumeInput = {
  goalSwimDistanceMeters?: number | null;
  recommendationMultiplier?: number | null;
  recommendedWeeklyMeters?: number | null;
  minWeeklyMeters?: number | null;
  maxWeeklyMeters?: number | null;
};

export type SwimPresetVolumeNormalization = {
  recommendedWeeklyMeters: number | null;
  minWeeklyMeters: number;
  maxWeeklyMeters: number | null;
  warnings: string[];
};

export type SwimWorkoutStructure = {
  /** How many of each swim type per typical week. */
  weeklyCounts: Partial<Record<SwimWorkoutTypeKey, number>>;
  /** Weeks between repeating the same catalogue slot when counts > 1. */
  cadenceWeeks?: number;
};

export function isSwimWorkoutType(value: unknown): value is SwimWorkoutTypeKey {
  return (
    typeof value === "string" &&
    (SWIM_WORKOUT_TYPES as readonly string[]).includes(value)
  );
}

export function computeRecommendedWeeklyMeters(
  goalSwimDistanceMeters: number,
  recommendationMultiplier: number = DEFAULT_SWIM_RECOMMENDATION_MULTIPLIER
): number {
  if (!Number.isFinite(goalSwimDistanceMeters) || goalSwimDistanceMeters <= 0) {
    throw new Error("goalSwimDistanceMeters must be a positive number");
  }
  if (!Number.isFinite(recommendationMultiplier) || recommendationMultiplier <= 0) {
    throw new Error("recommendationMultiplier must be a positive number");
  }
  return Math.round(goalSwimDistanceMeters * recommendationMultiplier);
}

/**
 * Athlete target belongs on generated swim plan — validates against preset bounds.
 */
export function validateTargetWeeklyMeters(
  targetWeeklyMeters: number,
  minWeeklyMeters: number,
  maxWeeklyMeters: number | null
): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(targetWeeklyMeters) || targetWeeklyMeters <= 0) {
    return { ok: false, error: "targetWeeklyMeters must be a positive number" };
  }
  if (targetWeeklyMeters < minWeeklyMeters) {
    return {
      ok: false,
      error: `targetWeeklyMeters (${targetWeeklyMeters}) is below preset minimum (${minWeeklyMeters})`,
    };
  }
  if (maxWeeklyMeters != null && targetWeeklyMeters > maxWeeklyMeters) {
    return {
      ok: false,
      error: `targetWeeklyMeters (${targetWeeklyMeters}) exceeds preset maximum (${maxWeeklyMeters})`,
    };
  }
  return { ok: true };
}

export function deriveLongSwimMeters(params: {
  weeklyMeters: number;
  longSwimShareOfWeek?: number | null;
  longSwimMinMeters?: number | null;
  longSwimMaxMeters?: number | null;
}): number {
  const share = params.longSwimShareOfWeek ?? DEFAULT_LONG_SWIM_SHARE_OF_WEEK;
  let meters = Math.round(params.weeklyMeters * share);
  if (params.longSwimMinMeters != null) {
    meters = Math.max(meters, params.longSwimMinMeters);
  }
  if (params.longSwimMaxMeters != null) {
    meters = Math.min(meters, params.longSwimMaxMeters);
  }
  return meters;
}

export function parseWeeklyProgressionPattern(
  raw: unknown
): SwimWeeklyProgressionPattern | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.weekMultipliers)) return null;
  const weekMultipliers = o.weekMultipliers.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0
  );
  if (weekMultipliers.length === 0) return null;
  return { weekMultipliers };
}

export function weeklyMetersForCycleWeek(
  baseWeeklyMeters: number,
  cycleWeekIndex: number,
  pattern: SwimWeeklyProgressionPattern | null
): number {
  if (!pattern || pattern.weekMultipliers.length === 0) {
    return baseWeeklyMeters;
  }
  const multiplier =
    pattern.weekMultipliers[cycleWeekIndex % pattern.weekMultipliers.length] ?? 1;
  return Math.round(baseWeeklyMeters * multiplier);
}

export function taperWeeklyMeters(
  normalWeeklyMeters: number,
  taperVolumeMultiplier: number = DEFAULT_TAPER_VOLUME_MULTIPLIER
): number {
  if (!Number.isFinite(taperVolumeMultiplier) || taperVolumeMultiplier <= 0) {
    throw new Error("taperVolumeMultiplier must be a positive number");
  }
  return Math.round(normalWeeklyMeters * taperVolumeMultiplier);
}

/**
 * Normalize swim preset volume fields and emit non-fatal warnings (staff save / API).
 */
export function normalizeSwimPresetVolume(
  input: SwimPresetVolumeInput
): SwimPresetVolumeNormalization {
  const warnings: string[] = [];
  const multiplier =
    input.recommendationMultiplier ?? DEFAULT_SWIM_RECOMMENDATION_MULTIPLIER;
  const minWeeklyMeters = Math.max(
    0,
    Math.round(input.minWeeklyMeters ?? DEFAULT_MIN_WEEKLY_METERS)
  );
  let maxWeeklyMeters =
    input.maxWeeklyMeters != null ? Math.round(input.maxWeeklyMeters) : null;

  let recommendedWeeklyMeters: number | null =
    input.recommendedWeeklyMeters != null
      ? Math.round(input.recommendedWeeklyMeters)
      : null;

  if (input.goalSwimDistanceMeters != null && input.goalSwimDistanceMeters > 0) {
    const computed = computeRecommendedWeeklyMeters(
      input.goalSwimDistanceMeters,
      multiplier
    );
    if (recommendedWeeklyMeters == null) {
      recommendedWeeklyMeters = computed;
    } else if (recommendedWeeklyMeters !== computed) {
      warnings.push(
        `recommendedWeeklyMeters (${recommendedWeeklyMeters}) differs from goal × multiplier (${computed}); keeping explicit value`
      );
    }
  }

  if (recommendedWeeklyMeters != null && recommendedWeeklyMeters < minWeeklyMeters) {
    warnings.push(
      `recommendedWeeklyMeters (${recommendedWeeklyMeters}) is below minWeeklyMeters (${minWeeklyMeters})`
    );
  }

  if (maxWeeklyMeters != null && maxWeeklyMeters < minWeeklyMeters) {
    warnings.push(
      `maxWeeklyMeters (${maxWeeklyMeters}) is below minWeeklyMeters (${minWeeklyMeters}); clearing max`
    );
    maxWeeklyMeters = null;
  }

  if (
    recommendedWeeklyMeters != null &&
    maxWeeklyMeters != null &&
    recommendedWeeklyMeters > maxWeeklyMeters
  ) {
    warnings.push(
      `recommendedWeeklyMeters (${recommendedWeeklyMeters}) exceeds maxWeeklyMeters (${maxWeeklyMeters})`
    );
  }

  return {
    recommendedWeeklyMeters,
    minWeeklyMeters,
    maxWeeklyMeters,
    warnings,
  };
}

export function parseSwimWorkoutStructure(raw: unknown): SwimWorkoutStructure | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.weeklyCounts || typeof o.weeklyCounts !== "object") return null;

  const weeklyCounts: Partial<Record<SwimWorkoutTypeKey, number>> = {};
  for (const [key, value] of Object.entries(o.weeklyCounts)) {
    if (!isSwimWorkoutType(key)) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
    weeklyCounts[key] = Math.round(value);
  }

  const cadenceWeeks =
    typeof o.cadenceWeeks === "number" && o.cadenceWeeks > 0
      ? Math.round(o.cadenceWeeks)
      : undefined;

  return { weeklyCounts, cadenceWeeks };
}

// TODO(phase-2): seed swim_workout_catalogue rows and four-week rotation configs per preset family.
// TODO(phase-2): wire long-swim generation from weekly totals + catalogue LongSwim entries.
// TODO(phase-2): triathlon_plan_preset composition — reference swim_plan_preset id + bike/run preset ids.
