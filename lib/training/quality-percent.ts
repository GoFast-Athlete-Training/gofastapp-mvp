import type { preset_workout_config, training_plan_preset } from "@prisma/client";

/** Max share of weekly miles that can go to quality (50%). */
export const QUALITY_PERCENT_MAX = 50;

/** Convert user-facing percent (0–50) to stored fraction (0–0.5). */
export function qualityPercentToFraction(percent: number): number {
  if (!Number.isFinite(percent)) return 0.22;
  const p = Math.max(0, Math.min(QUALITY_PERCENT_MAX, percent));
  return p / 100;
}

/** Stored fraction → display percent (whole number, 0–50). */
export function qualityFractionToPercent(fraction: number): number {
  if (!Number.isFinite(fraction)) return 22;
  const pct = Math.round(fraction * 100);
  return Math.max(0, Math.min(QUALITY_PERCENT_MAX, pct));
}

/**
 * Parse workout bolton JSON: prefer `qualityPercent` (0–50). Legacy `qualityFraction`
 * (0–1) still accepted for older clients.
 */
export function parseBoltonQualityToFraction(workout: Record<string, unknown>): number | null {
  if (typeof workout.qualityPercent === "number" && Number.isFinite(workout.qualityPercent)) {
    return qualityPercentToFraction(workout.qualityPercent);
  }
  if (typeof workout.qualityFraction === "number" && Number.isFinite(workout.qualityFraction)) {
    const f = workout.qualityFraction;
    if (f > 1) {
      return qualityPercentToFraction(f);
    }
    return Math.max(0, Math.min(0.5, f));
  }
  return null;
}

type PresetWithBoltons = training_plan_preset & {
  volumeConstraints: unknown;
  workoutConfig: preset_workout_config | null;
};

/** API shape: same preset row with `qualityPercent` (0–50) on workout bolton for clients. */
export function serializePlanPresetForApi(preset: PresetWithBoltons): PresetWithBoltons & {
  workoutConfig: (preset_workout_config & { qualityPercent: number }) | null;
} {
  const w = preset.workoutConfig;
  return {
    ...preset,
    workoutConfig: w
      ? {
          ...w,
          qualityPercent: qualityFractionToPercent(w.qualityFraction),
        }
      : null,
  };
}
