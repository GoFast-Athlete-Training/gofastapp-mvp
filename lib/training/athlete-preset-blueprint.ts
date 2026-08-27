/**
 * Athlete-owned preset blueprint helpers — build step, completion, serialization.
 */

import type { Prisma } from "@prisma/client";
import { athletePresetInclude, type LoadedAthletePresetInclude, type LoadedPresetInclude } from "@/lib/training/plan-generate-presets-loader";
import { resolveAthletePresetRotations } from "@/lib/training/apply-athlete-rotation-order";
import { builderProgressFromOverview } from "@/lib/training/athlete-preset-builder-progress";

export type AthletePresetBuildStep =
  | "core"
  | "longRun"
  | "easy"
  | "tempo"
  | "interval"
  | "adjuster"
  | "complete";

export function athletePresetBuildStepLabel(step: AthletePresetBuildStep): string {
  switch (step) {
    case "core":
      return "Stopped at: foundation";
    case "longRun":
      return "Stopped at: long run";
    case "easy":
      return "Stopped at: easy";
    case "tempo":
      return "Stopped at: tempo";
    case "interval":
      return "Stopped at: interval";
    case "adjuster":
      return "Stopped at: pace adjuster";
    case "complete":
      return "Ready to use";
  }
}

export type AthletePresetRowForStep = {
  workoutStructure: unknown;
  coachPlanOverview: unknown;
  longRunConfigId: string | null;
  easyConfigId: string | null;
  tempoConfigId: string | null;
  intervalsConfigId: string | null;
};

export function athletePresetBuildStep(row: AthletePresetRowForStep): AthletePresetBuildStep {
  const progress = builderProgressFromOverview(row.coachPlanOverview);
  if (!progress.cupsConfirmed) return "core";
  if (!row.workoutStructure || !row.longRunConfigId || !row.easyConfigId) return "longRun";
  if (!progress.longRunConfirmed) return "longRun";
  if (!progress.tempoConfirmed) return "tempo";
  if (!progress.intervalConfirmed) return "interval";
  if (!progress.adjusterConfirmed) return "adjuster";
  return "complete";
}

export function isAthletePresetBlueprintComplete(row: AthletePresetRowForStep): boolean {
  return athletePresetBuildStep(row) === "complete";
}

export function serializeAthletePresetForApi(row: {
  id: string;
  title: string;
  description: string | null;
  objectiveOfPlan: string | null;
  fitnessPhase: string;
  progressionAggressiveness: string | null;
  trainingHistory: string | null;
  sourcePresetId: string | null;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  baseLongRunPoolMiles: number;
  peakLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
  tempoIdealDow: number;
  intervalIdealDow: number;
  longRunDefaultDow: number;
  workoutStructure: unknown;
  coachPlanOverview: unknown;
  easyRunConfig: unknown;
  longRunConfigId: string | null;
  easyConfigId: string | null;
  tempoConfigId: string | null;
  intervalsConfigId: string | null;
  longRunConfig?: LoadedAthletePresetInclude["longRunConfig"];
  easyConfig?: LoadedAthletePresetInclude["easyConfig"];
  tempoConfig?: LoadedPresetInclude["tempoConfig"];
  intervalsConfig?: LoadedPresetInclude["intervalsConfig"];
  longRunOrders?: Array<{ cyclePosition: number; longRunConfigPositionId: string }>;
  easyOrders?: Array<{ cyclePosition: number; easyConfigPositionId: string }>;
  athleteTempoConfig?: LoadedAthletePresetInclude["athleteTempoConfig"];
  athleteIntervalsConfig?: LoadedAthletePresetInclude["athleteIntervalsConfig"];
  createdAt: Date;
  updatedAt: Date;
}) {
  const resolved = resolveAthletePresetRotations(
    row as LoadedAthletePresetInclude & {
      longRunOrders?: Array<{ cyclePosition: number; longRunConfigPositionId: string }>;
      easyOrders?: Array<{ cyclePosition: number; easyConfigPositionId: string }>;
      athleteTempoConfig?: LoadedAthletePresetInclude["athleteTempoConfig"];
      athleteIntervalsConfig?: LoadedAthletePresetInclude["athleteIntervalsConfig"];
    }
  );
  const stepRow: AthletePresetRowForStep = {
    workoutStructure: row.workoutStructure,
    coachPlanOverview: row.coachPlanOverview,
    longRunConfigId: row.longRunConfigId,
    easyConfigId: row.easyConfigId,
    tempoConfigId: row.tempoConfigId,
    intervalsConfigId: row.intervalsConfigId,
  };
  const buildStep = athletePresetBuildStep(stepRow);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    objectiveOfPlan: row.objectiveOfPlan,
    fitnessPhase: row.fitnessPhase,
    progressionAggressiveness: row.progressionAggressiveness,
    trainingHistory: row.trainingHistory,
    sourcePresetId: row.sourcePresetId,
    minWeeklyMiles: row.minWeeklyMiles,
    maxWeeklyMiles: row.maxWeeklyMiles,
    baseLongRunPoolMiles: row.baseLongRunPoolMiles,
    peakLongRunPoolMiles: row.peakLongRunPoolMiles,
    taperLongRunPoolMiles: row.taperLongRunPoolMiles,
    tempoIdealDow: row.tempoIdealDow,
    intervalIdealDow: row.intervalIdealDow,
    longRunDefaultDow: row.longRunDefaultDow,
    workoutStructure: row.workoutStructure,
    coachPlanOverview: row.coachPlanOverview,
    easyRunConfig: row.easyRunConfig,
    longRunConfigId: row.longRunConfigId,
    easyConfigId: row.easyConfigId,
    tempoConfigId: row.tempoConfigId,
    intervalsConfigId: row.intervalsConfigId,
    longRunConfig: resolved.longRunConfig,
    easyConfig: resolved.easyConfig,
    tempoConfig: resolved.tempoConfig,
    intervalsConfig: resolved.intervalsConfig,
    buildStep,
    buildStepLabel: athletePresetBuildStepLabel(buildStep),
    isComplete: isAthletePresetBlueprintComplete(stepRow),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Map athlete preset + includes into rotation source shape used by plan generate. */
export function athletePresetAsRotationSource(
  row: LoadedAthletePresetInclude
): LoadedAthletePresetInclude & {
  coachPlanOverview: Prisma.JsonValue;
  easyRunConfig: Prisma.JsonValue;
  workoutStructure: Prisma.JsonValue;
  slug: string;
} {
  const resolved = resolveAthletePresetRotations(row);
  return {
    ...row,
    ...resolved,
    slug: `athlete-${row.id}`,
    coachPlanOverview: row.coachPlanOverview ?? null,
    easyRunConfig: row.easyRunConfig ?? null,
    workoutStructure: row.workoutStructure ?? null,
  };
}

export { athletePresetInclude };
