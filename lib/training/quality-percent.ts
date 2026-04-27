import type { preset_workout_config, training_plan_preset } from "@prisma/client";

type PresetWithBoltons = training_plan_preset & {
  volumeConstraints: unknown;
  workoutConfig: preset_workout_config | null;
};

/** Normalizes preset shape for API JSON (no derived workout fields; catalogue drives quality volume). */
export function serializePlanPresetForApi(preset: PresetWithBoltons): PresetWithBoltons {
  return { ...preset };
}
