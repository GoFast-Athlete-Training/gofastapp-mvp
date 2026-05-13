/**
 * Shared Prisma preset payload → generator boltons mapping.
 */

import { WorkoutType, Prisma, type training_plan_preset } from "@prisma/client";
import { runTypeConfigPositionsToInputs, type RunTypeConfigInput } from "@/lib/training/run-type-config-shared";

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

export function presetToPlanGenConfig(
  preset: Pick<
    training_plan_preset,
    | "cycleLen"
    | "minWeeklyMiles"
    | "maxWeeklyMiles"
    | "baseMiles"
    | "peakMiles"
    | "taperMiles"
    | "tempoIdealDow"
    | "intervalIdealDow"
    | "longRunDefaultDow"
  >
): PlanGenConfig {
  return {
    cycleLen: preset.cycleLen,
    minWeeklyMiles: preset.minWeeklyMiles,
    baseMiles: preset.baseMiles,
    peakMiles: preset.peakMiles,
    taperMiles: preset.taperMiles,
    maxWeeklyMiles: preset.maxWeeklyMiles,
    tempoIdealDow: preset.tempoIdealDow,
    intervalIdealDow: preset.intervalIdealDow,
    longRunDefaultDow: preset.longRunDefaultDow,
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
