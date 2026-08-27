/**
 * Shared Prisma preset payload → generator boltons mapping.
 */

import { WorkoutType, Prisma, type training_plan_preset } from "@prisma/client";
import { runTypeConfigPositionsToInputs, type RunTypeConfigInput } from "@/lib/training/run-type-config-shared";
import {
  athletePresetRotationInclude,
  catalogueSelectForGeneration,
  positionsInclude,
} from "@/lib/training/preset-positions-include";

export { catalogueSelectForGeneration, positionsInclude };

export interface PlanGenConfig {
  minWeeklyMiles?: number | null;
  peakLongRunPoolMiles?: number | null;
  baseLongRunPoolMiles?: number | null;
  taperLongRunPoolMiles?: number | null;
  maxWeeklyMiles?: number | null;
  tempoIdealDow?: number | null;
  intervalIdealDow?: number | null;
  longRunDefaultDow?: number | null;
}

export function presetToPlanGenConfig(
  preset: Pick<
    training_plan_preset,
    | "minWeeklyMiles"
    | "maxWeeklyMiles"
    | "baseLongRunPoolMiles"
    | "peakLongRunPoolMiles"
    | "taperLongRunPoolMiles"
    | "tempoIdealDow"
    | "intervalIdealDow"
    | "longRunDefaultDow"
  >
): PlanGenConfig {
  return {
    minWeeklyMiles: preset.minWeeklyMiles,
    baseLongRunPoolMiles: preset.baseLongRunPoolMiles,
    peakLongRunPoolMiles: preset.peakLongRunPoolMiles,
    taperLongRunPoolMiles: preset.taperLongRunPoolMiles,
    maxWeeklyMiles: preset.maxWeeklyMiles,
    tempoIdealDow: preset.tempoIdealDow,
    intervalIdealDow: preset.intervalIdealDow,
    longRunDefaultDow: preset.longRunDefaultDow,
  };
}

export const trainingPlanPresetInclude = {
  longRunConfig: { include: { positions: positionsInclude } },
  intervalsConfig: { include: { positions: positionsInclude } },
  tempoConfig: { include: { positions: positionsInclude } },
  easyConfig: { include: { positions: positionsInclude } },
} as const;

export type LoadedPresetInclude = NonNullable<
  Prisma.training_plan_presetGetPayload<{
    include: typeof trainingPlanPresetInclude;
  }>
>;

export const athletePresetInclude = athletePresetRotationInclude;

export type LoadedAthletePresetInclude = NonNullable<
  Prisma.athlete_presetsGetPayload<{
    include: typeof athletePresetInclude;
  }>
>;

/** Rotation configs + strategy JSON fields — shared shape for catalog and athlete blueprints. */
export type RotationBlueprintSource = LoadedPresetInclude & {
  coachPlanOverview?: unknown;
  easyRunConfig?: unknown;
  workoutStructure?: unknown;
  slug?: string;
  title?: string;
};

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
  preset: Pick<
    RotationBlueprintSource,
    "longRunConfig" | "intervalsConfig" | "tempoConfig" | "easyConfig"
  >
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
  for (const p of preset.easyConfig?.positions ?? []) {
    if (p.catalogueWorkoutId) ids.push(p.catalogueWorkoutId);
  }
  return [...new Set(ids)];
}
