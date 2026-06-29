import type {
  training_plan_goal,
  training_plan_persona,
  training_plan_preset,
  TrainingPlanGoalType,
} from "@prisma/client";
import { prismaKindToGoalType } from "@/lib/training/goal-type-map";

export type PlanPersonaApi = {
  id: string;
  slug: string;
  title: string;
  capability: training_plan_persona["capability"];
  dedication: training_plan_persona["dedication"];
  personaGoalLabel: string | null;
  athletePersonaGoal: string | null;
  workoutFrequencyCap: number | null;
  intentSummary: string | null;
  athletePersonaSummary: string | null;
  runningHistory: string | null;
  runningHistorySummary: string | null;
  currentCapability: string | null;
  currentCapabilitySummary: string | null;
  injuryAssessment: string | null;
  injuryAssessmentSummary: string | null;
  dedicationText: string | null;
  dedicationSummary: string | null;
  abilityToTrain: string | null;
  abilityToTrainSummary: string | null;
  estimated5kTimeSeconds: number | null;
  estimated5kPerformanceSummary: string | null;
  estimated5kPerformanceRationale: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlanGoalApi = {
  id: string;
  slug: string;
  personaId: string;
  targetDistanceLabel: string | null;
  objectiveOfPlan: string | null;
  planDurationWeeks: number;
  timeHorizonLabel: string | null;
  fitnessDelta: training_plan_goal["fitnessDelta"];
  progressionAggressiveness: training_plan_goal["progressionAggressiveness"];
  intensityReasoning: string | null;
  goalKind: training_plan_goal["goalKind"];
  goalType: TrainingPlanGoalType | null;
  coachIntent: string | null;
  createdAt: string;
  updatedAt: string;
  persona?: PlanPersonaApi | null;
};

export function serializePlanPersona(row: training_plan_persona): PlanPersonaApi {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    capability: row.capability,
    dedication: row.dedication,
    personaGoalLabel: row.personaGoalLabel,
    athletePersonaGoal: row.personaGoalLabel,
    workoutFrequencyCap: row.workoutFrequencyCap,
    intentSummary: row.intentSummary,
    athletePersonaSummary: row.athletePersonaSummary ?? row.intentSummary,
    runningHistory: row.runningHistory,
    runningHistorySummary: row.runningHistorySummary,
    currentCapability: row.currentCapability,
    currentCapabilitySummary: row.currentCapabilitySummary,
    injuryAssessment: row.injuryAssessment,
    injuryAssessmentSummary: row.injuryAssessmentSummary,
    dedicationText: row.dedicationText,
    dedicationSummary: row.dedicationSummary,
    abilityToTrain: row.abilityToTrain,
    abilityToTrainSummary: row.abilityToTrainSummary,
    estimated5kTimeSeconds: row.estimated5kTimeSeconds,
    estimated5kPerformanceSummary: row.estimated5kPerformanceSummary,
    estimated5kPerformanceRationale: row.estimated5kPerformanceRationale,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializePlanGoal(
  row: training_plan_goal & { persona?: training_plan_persona | null }
): PlanGoalApi {
  return {
    id: row.id,
    slug: row.slug,
    personaId: row.personaId,
    targetDistanceLabel: row.targetDistanceLabel,
    objectiveOfPlan: row.objectiveOfPlan,
    planDurationWeeks: row.planDurationWeeks,
    timeHorizonLabel: row.timeHorizonLabel,
    fitnessDelta: row.fitnessDelta,
    progressionAggressiveness: row.progressionAggressiveness,
    intensityReasoning: row.intensityReasoning,
    goalKind: row.goalKind,
    goalType: prismaKindToGoalType(row.goalKind, row.goalType),
    coachIntent: row.coachIntent,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    persona: row.persona ? serializePlanPersona(row.persona) : undefined,
  };
}

export type PresetWithEntities = training_plan_preset & {
  persona?: training_plan_persona | null;
  goal?: (training_plan_goal & { persona?: training_plan_persona | null }) | null;
};

export function attachEntityFields<T extends Record<string, unknown>>(
  preset: T,
  entities: { persona?: training_plan_persona | null; goal?: training_plan_goal | null }
): T & {
  persona?: PlanPersonaApi | null;
  goal?: PlanGoalApi | null;
  paceOffsetProfile: unknown;
} {
  return {
    ...preset,
    paceOffsetProfile: preset.paceProfile ?? null,
    persona: entities.persona ? serializePlanPersona(entities.persona) : null,
    goal: entities.goal ? serializePlanGoal(entities.goal) : null,
  };
}
