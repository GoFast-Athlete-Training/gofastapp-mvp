/**
 * Shared Prisma preset payload → generator boltons mapping.
 */

import { WorkoutType, Prisma } from "@prisma/client";
import { runTypeConfigPositionsToInputs, type RunTypeConfigInput } from "@/lib/training/run-type-config-shared";

export type PlanGenPresetBoltonsInput = {
  volumeConstraints: {
    cycleLen?: number | null;
    minWeeklyMiles?: number | null;
    baseMiles?: number | null;
    peakMiles?: number | null;
    taperMiles?: number | null;
    maxWeeklyMiles?: number | null;
  };
  workoutConfig: {
    tempoIdealDow?: number | null;
    intervalIdealDow?: number | null;
    longRunDefaultDow?: number | null;
  };
};

export interface PlanGenConfig {
  cycleLen?: number | null;
  minWeeklyMiles?: number | null;
  peakMiles?: number | null;
  baseMiles?: number | null;
  taperMiles?: number | null;
  maxWeeklyMiles?: number | null;
  tempoIdealDow?: number | null;
  intervalIdealDow?: number | null;
  longRunDefaultDow?: number | null;
}

export function presetBoltonsToPlanGenConfig(
  preset: PlanGenPresetBoltonsInput
): PlanGenConfig {
  const volume = preset.volumeConstraints;
  const workout = preset.workoutConfig;
  return {
    cycleLen: volume.cycleLen ?? undefined,
    minWeeklyMiles: volume.minWeeklyMiles ?? undefined,
    baseMiles: volume.baseMiles ?? undefined,
    peakMiles: volume.peakMiles ?? undefined,
    taperMiles: volume.taperMiles ?? undefined,
    maxWeeklyMiles: volume.maxWeeklyMiles ?? undefined,
    tempoIdealDow: workout.tempoIdealDow ?? undefined,
    intervalIdealDow: workout.intervalIdealDow ?? undefined,
    longRunDefaultDow: workout.longRunDefaultDow ?? undefined,
  };
}

export const catalogueSelectForGeneration = {
  id: true,
  name: true,
  workoutType: true,
  slug: true,
  paceAnchor: true,
  segmentPaceDist: true,
  warmupMiles: true,
  cooldownMiles: true,
  workBaseMiles: true,
  workBaseReps: true,
  workBaseRepMeters: true,
} as const;

export const positionsInclude = {
  orderBy: { cyclePosition: "asc" as const },
  include: {
    workout_catalogue: {
      select: catalogueSelectForGeneration,
    },
  },
} as const;

export const trainingPlanPresetInclude = {
  volumeConstraints: true,
  workoutConfig: true,
  longRunConfig: { include: { positions: positionsInclude } },
  intervalsConfig: { include: { positions: positionsInclude } },
  tempoConfig: { include: { positions: positionsInclude } },
} as const;

export type LoadedPresetInclude = NonNullable<
  Prisma.training_plan_presetGetPayload<{
    include: typeof trainingPlanPresetInclude;
  }>
>;

export type CatalogueGenerationRowSelection =
  Prisma.workout_catalogueGetPayload<{ select: typeof catalogueSelectForGeneration }>;

export function mapPositionRow(p: {
  cyclePosition: number;
  catalogueWorkoutId: string | null;
  distributionWeight: number;
}) {
  return {
    cyclePosition: p.cyclePosition,
    catalogueWorkoutId: p.catalogueWorkoutId,
    distributionWeight: p.distributionWeight,
  };
}

export function runTypeInputsFromPreset(preset: {
  longRunConfig: LoadedPresetInclude["longRunConfig"];
  intervalsConfig: LoadedPresetInclude["intervalsConfig"];
  tempoConfig: LoadedPresetInclude["tempoConfig"];
}): RunTypeConfigInput[] {
  const out: RunTypeConfigInput[] = [];
  if (preset.longRunConfig?.positions?.length) {
    out.push(
      ...runTypeConfigPositionsToInputs(
        WorkoutType.LongRun,
        preset.longRunConfig.positions.map(mapPositionRow)
      )
    );
  }
  if (preset.intervalsConfig?.positions?.length) {
    out.push(
      ...runTypeConfigPositionsToInputs(
        WorkoutType.Intervals,
        preset.intervalsConfig.positions.map(mapPositionRow)
      )
    );
  }
  if (preset.tempoConfig?.positions?.length) {
    out.push(
      ...runTypeConfigPositionsToInputs(
        WorkoutType.Tempo,
        preset.tempoConfig.positions.map(mapPositionRow)
      )
    );
  }
  return out;
}

export function catalogueIdsFromPreset(
  preset: LoadedPresetInclude
): string[] {
  const ids: string[] = [];
  for (const p of preset.longRunConfig?.positions ?? []) {
    if (p.catalogueWorkoutId) ids.push(p.catalogueWorkoutId);
  }
  for (const p of preset.intervalsConfig?.positions ?? []) {
    if (p.catalogueWorkoutId) ids.push(p.catalogueWorkoutId);
  }
  for (const p of preset.tempoConfig?.positions ?? []) {
    if (p.catalogueWorkoutId) ids.push(p.catalogueWorkoutId);
  }
  return [...new Set(ids)];
}
