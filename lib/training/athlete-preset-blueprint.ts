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

export function athletePresetBuildStepLabel(step: AthletePresetBuildStep): string {
  switch (step) {
    case "core":
      return "Stopped at: confirm cups";
    case "workouts":
      return "Stopped at: weekly workouts";
    case "rotations":
      return "Stopped at: rotations";
    case "pace":
      return "Stopped at: pace profile";
    case "complete":
      return "Ready to use";
  }
}

function cupsConfirmedFromOverview(coachPlanOverview: unknown): boolean {
  if (coachPlanOverview == null || typeof coachPlanOverview !== "object" || Array.isArray(coachPlanOverview)) {
    return false;
  }
  return (coachPlanOverview as Record<string, unknown>).cupsConfirmed === true;
}

export type AthletePresetRowForStep = {
  baseLongRunPoolMiles: number;
  peakLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
  workoutStructure: unknown;
  coachPlanOverview: unknown;
  longRunConfigId: string | null;
  easyConfigId: string | null;
  paceProfile: unknown;
};

export function athletePresetBuildStep(row: AthletePresetRowForStep): AthletePresetBuildStep {
  if (!row.workoutStructure) {
    return cupsConfirmedFromOverview(row.coachPlanOverview) ? "workouts" : "core";
  }
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
  baseLongRunPoolMiles: number;
  peakLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
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
    baseLongRunPoolMiles: row.baseLongRunPoolMiles,
    peakLongRunPoolMiles: row.peakLongRunPoolMiles,
    taperLongRunPoolMiles: row.taperLongRunPoolMiles,
    workoutStructure: row.workoutStructure,
    coachPlanOverview: row.coachPlanOverview,
    longRunConfigId: row.longRunConfigId,
    easyConfigId: row.easyConfigId,
    paceProfile: row.paceProfile,
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
    paceProfile: row.paceProfile,
    easyRunConfig: row.easyRunConfig,
    longRunConfigId: row.longRunConfigId,
    easyConfigId: row.easyConfigId,
    tempoConfigId: row.tempoConfigId,
    intervalsConfigId: row.intervalsConfigId,
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
