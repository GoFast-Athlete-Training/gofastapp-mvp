import type { preset_volume_constraints, preset_workout_config } from "@prisma/client";
import type { PlanGenConfig } from "@/lib/training/generate-plan";

/** Merge volume + workout boltons into the flat shape the generator expects. */
export function presetBoltonsToPlanGenConfig(
  volume: preset_volume_constraints,
  workout: preset_workout_config
): PlanGenConfig {
  const taperRuns = Array.isArray(volume.taperLongRuns)
    ? (volume.taperLongRuns as unknown[]).map((x) => Number(x))
    : undefined;

  return {
    taperWeeks: volume.taperWeeks,
    peakWeeks: volume.peakWeeks,
    taperLongRuns: taperRuns?.every((n) => Number.isFinite(n)) ? taperRuns : undefined,
    baseStartMiles: volume.baseStartMiles,
    ladderStep: volume.ladderStep,
    ladderCycleLen: volume.ladderCycleLen,
    peakEntryMiles: volume.peakEntryMiles,
    peakLongRunMiles: volume.peakLongRunMiles,
    cutbackWeekModulo: volume.cutbackWeekModulo,
    weeklyMileageMultiplier: volume.weeklyMileageMultiplier,
    taperMileageReduction: volume.taperMileageReduction,
    longRunCapFraction: volume.longRunCapFraction,
    cutbackFraction:
      volume.cutbackFraction != null && Number.isFinite(Number(volume.cutbackFraction))
        ? Number(volume.cutbackFraction)
        : undefined,
    minWeeklyMiles: volume.minWeeklyMiles,
    minLongMiles: volume.minLongMiles,
    minEasyPerDayMiles: volume.minEasyPerDayMiles,
    minEasyWeekMiles: volume.minEasyWeekMiles,
    qualityFraction: workout.qualityFraction,
    qualitySessions: workout.qualitySessions,
    qualityOnLongRun: workout.qualityOnLongRun,
    tempoIdealDow: workout.tempoIdealDow,
    intervalIdealDow: workout.intervalIdealDow,
    longRunDefaultDow: workout.longRunDefaultDow,
  };
}
