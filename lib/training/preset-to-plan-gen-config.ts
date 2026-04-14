import type { preset_volume_constraints, preset_workout_config } from "@prisma/client";
import type { PlanGenConfig } from "@/lib/training/generate-plan";

/** Merge volume + workout boltons into the flat shape the generator expects. */
export function presetBoltonsToPlanGenConfig(
  volume: preset_volume_constraints,
  workout: preset_workout_config
): PlanGenConfig {
  return {
    taperWeeks: volume.taperWeeks,
    peakWeeks: volume.peakWeeks,
    taperLongRunAnchors: volume.taperLongRunAnchors as Record<string, number>,
    peakLongRunMiles: volume.peakLongRunMiles,
    cutbackWeekModulo: volume.cutbackWeekModulo,
    weeklyMileageMultiplier: volume.weeklyMileageMultiplier,
    taperMileageReduction: volume.taperMileageReduction,
    longRunCapFraction: volume.longRunCapFraction,
    minWeeklyMiles: volume.minWeeklyMiles,
    minLongMiles: volume.minLongMiles,
    minEasyPerDayMiles: volume.minEasyPerDayMiles,
    minEasyWeekMiles: volume.minEasyWeekMiles,
    tempoStartMiles: workout.tempoStartMiles,
    intervalStartMiles: workout.intervalStartMiles,
    minTempoMiles: workout.minTempoMiles,
    minIntervalMiles: workout.minIntervalMiles,
    tempoIdealDow: workout.tempoIdealDow,
    intervalIdealDow: workout.intervalIdealDow,
    longRunDefaultDow: workout.longRunDefaultDow,
  };
}
