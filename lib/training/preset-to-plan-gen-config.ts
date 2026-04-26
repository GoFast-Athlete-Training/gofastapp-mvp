import type { preset_volume_constraints, preset_workout_config } from "@prisma/client";
import type { PlanGenConfig } from "@/lib/training/generate-plan-from-configs";

/** Merge volume + workout boltons into the flat shape the generator expects. */
export function presetBoltonsToPlanGenConfig(
  volume: preset_volume_constraints,
  workout: preset_workout_config
): PlanGenConfig {
  return {
    cycleLen: volume.cycleLen,
    minWeeklyMiles: volume.minWeeklyMiles,
    minLongMiles: volume.minLongMiles,
    minEasyPerDayMiles: volume.minEasyPerDayMiles,
    cyclePeakPool: volume.cyclePeakPool,
    cyclePoolBuildCoef: volume.cyclePoolBuildCoef,
    cyclePoolTaperCoef: volume.cyclePoolTaperCoef,
    qualityFraction: workout.qualityFraction,
    qualitySessions: workout.qualitySessions,
    qualityOnLongRun: workout.qualityOnLongRun,
    tempoIdealDow: workout.tempoIdealDow,
    intervalIdealDow: workout.intervalIdealDow,
    longRunDefaultDow: workout.longRunDefaultDow,
  };
}
