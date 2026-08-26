/**
 * Athlete-owned preset blueprint helpers — build step, completion, serialization.
 */

import type { Prisma } from "@prisma/client";
import { athletePresetInclude, type LoadedAthletePresetInclude } from "@/lib/training/plan-generate-presets-loader";

export type AthletePresetBuildStep =
  | "core"
  | "workouts"
  | "rotations"
  | "pace"
  | "complete";

export type AthletePresetRowForStep = {
  baseMiles: number;
  peakMiles: number;
  taperMiles: number;
  workoutStructure: unknown;
  longRunConfigId: string | null;
  easyConfigId: string | null;
  paceProfile: unknown;
};

export function athletePresetBuildStep(row: AthletePresetRowForStep): AthletePresetBuildStep {
  if (!row.workoutStructure) return "core";
  if (!row.longRunConfigId || !row.easyConfigId) return "rotations";
  if (!row.paceProfile) return "pace";
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
  baseMiles: number;
  peakMiles: number;
  taperMiles: number;
  tempoIdealDow: number;
  intervalIdealDow: number;
  longRunDefaultDow: number;
  workoutStructure: unknown;
  coachPlanOverview: unknown;
  paceProfile: unknown;
  easyRunConfig: unknown;
  longRunConfigId: string | null;
  easyConfigId: string | null;
  tempoConfigId: string | null;
  intervalsConfigId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const stepRow: AthletePresetRowForStep = {
    baseMiles: row.baseMiles,
    peakMiles: row.peakMiles,
    taperMiles: row.taperMiles,
    workoutStructure: row.workoutStructure,
    longRunConfigId: row.longRunConfigId,
    easyConfigId: row.easyConfigId,
    paceProfile: row.paceProfile,
  };
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
    baseMiles: row.baseMiles,
    peakMiles: row.peakMiles,
    taperMiles: row.taperMiles,
    tempoIdealDow: row.tempoIdealDow,
    intervalIdealDow: row.intervalIdealDow,
    longRunDefaultDow: row.longRunDefaultDow,
    workoutStructure: row.workoutStructure,
    coachPlanOverview: row.coachPlanOverview,
    paceProfile: row.paceProfile,
    easyRunConfig: row.easyRunConfig,
    longRunConfigId: row.longRunConfigId,
    easyConfigId: row.easyConfigId,
    tempoConfigId: row.tempoConfigId,
    intervalsConfigId: row.intervalsConfigId,
    buildStep: athletePresetBuildStep(stepRow),
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
  paceProfile: Prisma.JsonValue;
  easyRunConfig: Prisma.JsonValue;
  workoutStructure: Prisma.JsonValue;
  slug: string;
} {
  return {
    ...row,
    slug: `athlete-${row.id}`,
    coachPlanOverview: row.coachPlanOverview ?? null,
    paceProfile: row.paceProfile ?? null,
    easyRunConfig: row.easyRunConfig ?? null,
    workoutStructure: row.workoutStructure ?? null,
  };
}

export { athletePresetInclude };
