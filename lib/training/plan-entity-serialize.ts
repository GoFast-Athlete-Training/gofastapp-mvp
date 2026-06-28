import type {
  training_plan_goal,
  training_plan_persona,
  training_plan_preset,
} from "@prisma/client";

export type PlanPersonaApi = {
  id: string;
  slug: string;
  title: string;
  capability: training_plan_persona["capability"];
  dedication: training_plan_persona["dedication"];
  personaGoalLabel: string | null;
  workoutFrequencyCap: number | null;
  intentSummary: string | null;
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
    workoutFrequencyCap: row.workoutFrequencyCap,
    intentSummary: row.intentSummary,
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
): T & { persona?: PlanPersonaApi | null; goal?: PlanGoalApi | null } {
  return {
    ...preset,
    persona: entities.persona ? serializePlanPersona(entities.persona) : null,
    goal: entities.goal ? serializePlanGoal(entities.goal) : null,
  };
}
