import type { WorkoutType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RunTypePositionInput } from "@/lib/training/run-type-config-parser";

export const EASY_RUN_NOT_CONFIGURED =
  "This plan has no Easy Run configured. Contact your administrator.";

export const PRESET_EASY_NOT_CONFIGURED =
  "This plan config has no Easy Run assigned. Add an Easy catalogue workout before saving.";

export const PRESET_LONG_RUN_NOT_CONFIGURED =
  "This plan config has no long run assigned. Add a long-run catalogue workout before saving.";

export const PRESET_TEMPO_NOT_CONFIGURED =
  "This plan config has no tempo rotation assigned. Add tempo catalogue workouts before saving.";

export const PRESET_INTERVALS_NOT_CONFIGURED =
  "This plan config has no interval rotation assigned. Add interval catalogue workouts before saving.";

export const EASY_CONFIG_REQUIRES_CATALOGUE =
  "Easy config requires a catalogue workout before saving.";

export function rotationMissingCatalogueWorkout(
  positions: readonly { catalogueWorkoutId: string | null }[]
): boolean {
  if (positions.length === 0) return true;
  return !positions.some((p) => Boolean(p.catalogueWorkoutId?.trim()));
}

export function assertAllPositionsHaveCatalogue(
  rows: RunTypePositionInput[],
  configLabel: string
): { ok: true } | { ok: false; error: string } {
  if (rows.length === 0) {
    return {
      ok: false,
      error: `${configLabel} requires at least one rotation slot with a catalogue workout.`,
    };
  }
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i]?.catalogueWorkoutId?.trim()) {
      return {
        ok: false,
        error: `${configLabel} requires a catalogue workout in every slot before saving (slot ${i + 1} is empty).`,
      };
    }
  }
  return { ok: true };
}

export async function validateRunTypePositionsForSave(params: {
  rows: RunTypePositionInput[];
  configLabel: string;
  expectedWorkoutType: WorkoutType;
  emptySlotMessage?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const slotCheck = assertAllPositionsHaveCatalogue(params.rows, params.configLabel);
  if (!slotCheck.ok) {
    return {
      ok: false,
      error: params.emptySlotMessage ?? slotCheck.error,
    };
  }

  const ids = params.rows.map((r) => r.catalogueWorkoutId!.trim());
  const uniqueIds = [...new Set(ids)];
  const found = await prisma.workout_catalogue.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, workoutType: true },
  });
  if (found.length !== uniqueIds.length) {
    return {
      ok: false,
      error: "One or more catalogueWorkoutId values are invalid",
    };
  }
  for (const row of found) {
    if (row.workoutType !== params.expectedWorkoutType) {
      return {
        ok: false,
        error: `Catalogue workout must be type ${params.expectedWorkoutType}.`,
      };
    }
  }
  return { ok: true };
}

type AttachedConfig = {
  name: string;
  positions: readonly { catalogueWorkoutId: string | null }[];
} | null;

export function validateAttachedPresetConfig(params: {
  config: AttachedConfig;
  configLabel: string;
  missingMessage: string;
}): { ok: true } | { ok: false; error: string } {
  const { config, configLabel, missingMessage } = params;
  if (!config) return { ok: true };
  if (rotationMissingCatalogueWorkout(config.positions)) {
    const detail =
      config.positions.length === 0
        ? `${configLabel} has no rotation slots.`
        : `${configLabel} "${config.name}" has empty catalogue slots.`;
    return { ok: false, error: `${missingMessage} ${detail}` };
  }
  return { ok: true };
}

export function validatePresetRotationConfigs(preset: {
  easyConfig: AttachedConfig;
  longRunConfig: AttachedConfig;
  tempoConfig: AttachedConfig;
  intervalsConfig: AttachedConfig;
}): { ok: true } | { ok: false; error: string } {
  const checks = [
    {
      config: preset.easyConfig,
      configLabel: "Easy config",
      missingMessage: PRESET_EASY_NOT_CONFIGURED,
    },
    {
      config: preset.longRunConfig,
      configLabel: "Long run config",
      missingMessage: PRESET_LONG_RUN_NOT_CONFIGURED,
    },
    {
      config: preset.tempoConfig,
      configLabel: "Tempo config",
      missingMessage: PRESET_TEMPO_NOT_CONFIGURED,
    },
    {
      config: preset.intervalsConfig,
      configLabel: "Intervals config",
      missingMessage: PRESET_INTERVALS_NOT_CONFIGURED,
    },
  ] as const;

  for (const check of checks) {
    const result = validateAttachedPresetConfig(check);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export function assertScheduleEasyDaysHaveCatalogue(
  schedule: readonly { days: readonly { workoutType: string; catalogueWorkoutId?: string | null }[] }[]
): void {
  for (const week of schedule) {
    for (const day of week.days) {
      if (day.workoutType === "Easy" && !day.catalogueWorkoutId?.trim()) {
        throw new Error(EASY_RUN_NOT_CONFIGURED);
      }
    }
  }
}
