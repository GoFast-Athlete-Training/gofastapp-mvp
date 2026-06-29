import type {
  AthletePersonaCapability,
  AthletePersonaDedication,
  FitnessDelta,
  Prisma,
  ProgressionAggressiveness,
  TrainingPlanGoalKind,
  TrainingPlanGoalType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildGoalSlug,
  buildPersonaSlug,
  normalizeSlug,
} from "@/lib/training/plan-entity-slugs";
import { goalTypeToPrismaKind } from "@/lib/training/goal-type-map";
import type { TrainingPlanGoalType as GoalTypeContract } from "@/lib/training/preset-realignment-types";

export type PersonaUpsertInput = {
  slug?: string | null;
  title: string;
  capability?: AthletePersonaCapability | null;
  dedication?: AthletePersonaDedication | null;
  personaGoalLabel?: string | null;
  intentSummary?: string | null;
  workoutFrequencyCap?: number | null;
  runningHistory?: string | null;
  runningHistorySummary?: string | null;
  currentCapability?: string | null;
  currentCapabilitySummary?: string | null;
  injuryAssessment?: string | null;
  injuryAssessmentSummary?: string | null;
  dedicationText?: string | null;
  dedicationSummary?: string | null;
  abilityToTrain?: string | null;
  abilityToTrainSummary?: string | null;
  estimated5kTimeSeconds?: number | null;
  estimated5kPerformanceSummary?: string | null;
  estimated5kPerformanceRationale?: string | null;
  athletePersonaSummary?: string | null;
};

export type GoalUpsertInput = {
  slug?: string | null;
  personaId: string;
  targetDistanceLabel?: string | null;
  objectiveOfPlan?: string | null;
  planDurationWeeks: number;
  timeHorizonLabel?: string | null;
  goalKind?: TrainingPlanGoalKind | null;
  goalType?: TrainingPlanGoalType | GoalTypeContract | null;
  coachIntent?: string | null;
  fitnessDelta?: FitnessDelta | null;
  progressionAggressiveness?: ProgressionAggressiveness | null;
  intensityReasoning?: string | null;
};

export async function findPersonaBySlug(slug: string) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  return prisma.training_plan_persona.findUnique({ where: { slug: normalized } });
}

export async function findGoalBySlug(slug: string) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  return prisma.training_plan_goal.findUnique({
    where: { slug: normalized },
    include: { persona: true },
  });
}

export async function upsertPersonaBySlug(input: PersonaUpsertInput & { personaSlug?: string }) {
  const slug =
    normalizeSlug(input.slug ?? input.personaSlug ?? "") ||
    buildPersonaSlug({
      capability: input.capability,
      targetDistanceLabel: null,
      goalKind: null,
    });

  const data: Prisma.training_plan_personaUpsertArgs["create"] = {
    slug,
    title: input.title.trim(),
    capability: input.capability ?? null,
    dedication: input.dedication ?? null,
    personaGoalLabel: input.personaGoalLabel?.trim() || null,
    intentSummary: input.intentSummary?.trim() || input.athletePersonaSummary?.trim() || null,
    athletePersonaSummary: input.athletePersonaSummary?.trim() || input.intentSummary?.trim() || null,
    workoutFrequencyCap:
      input.workoutFrequencyCap != null && Number.isFinite(input.workoutFrequencyCap)
        ? Math.max(1, Math.round(input.workoutFrequencyCap))
        : null,
    runningHistory: input.runningHistory?.trim() || null,
    runningHistorySummary: input.runningHistorySummary?.trim() || null,
    currentCapability: input.currentCapability?.trim() || null,
    currentCapabilitySummary: input.currentCapabilitySummary?.trim() || null,
    injuryAssessment: input.injuryAssessment?.trim() || null,
    injuryAssessmentSummary: input.injuryAssessmentSummary?.trim() || null,
    dedicationText: input.dedicationText?.trim() || null,
    dedicationSummary: input.dedicationSummary?.trim() || null,
    abilityToTrain: input.abilityToTrain?.trim() || null,
    abilityToTrainSummary: input.abilityToTrainSummary?.trim() || null,
    estimated5kTimeSeconds:
      input.estimated5kTimeSeconds != null && Number.isFinite(input.estimated5kTimeSeconds)
        ? Math.max(0, Math.round(input.estimated5kTimeSeconds))
        : null,
    estimated5kPerformanceSummary: input.estimated5kPerformanceSummary?.trim() || null,
    estimated5kPerformanceRationale: input.estimated5kPerformanceRationale?.trim() || null,
  };

  return prisma.training_plan_persona.upsert({
    where: { slug },
    create: data,
    update: {
      title: data.title,
      ...(input.capability !== undefined ? { capability: input.capability } : {}),
      ...(input.dedication !== undefined ? { dedication: input.dedication } : {}),
      ...(input.personaGoalLabel !== undefined
        ? { personaGoalLabel: input.personaGoalLabel?.trim() || null }
        : {}),
      ...(input.intentSummary !== undefined
        ? { intentSummary: input.intentSummary?.trim() || null }
        : {}),
      ...(input.workoutFrequencyCap !== undefined
        ? { workoutFrequencyCap: data.workoutFrequencyCap }
        : {}),
    },
  });
}

export async function upsertGoalBySlug(
  input: GoalUpsertInput & { goalSlug?: string; personaSlug?: string }
) {
  const weeks = Math.max(1, Math.round(input.planDurationWeeks));
  let slug = normalizeSlug(input.slug ?? input.goalSlug ?? "");
  if (!slug && input.personaSlug) {
    slug = buildGoalSlug(input.personaSlug, weeks);
  }
  if (!slug) {
    throw new Error("goal slug is required");
  }

  const goalType =
    input.goalType ??
    (input.goalKind === "RACE"
      ? "RACE"
      : input.goalKind === "TRAINING_BLOCK"
        ? "GENERAL_FITNESS"
        : null);

  const data: Prisma.training_plan_goalUpsertArgs["create"] = {
    slug,
    personaId: input.personaId,
    targetDistanceLabel: input.targetDistanceLabel?.trim() || null,
    objectiveOfPlan: input.objectiveOfPlan?.trim() || null,
    planDurationWeeks: weeks,
    timeHorizonLabel: input.timeHorizonLabel?.trim() || null,
    goalKind: input.goalKind ?? goalTypeToPrismaKind(goalType as GoalTypeContract),
    goalType: goalType as TrainingPlanGoalType | null,
    coachIntent: input.coachIntent?.trim() || null,
    fitnessDelta: input.fitnessDelta ?? null,
    progressionAggressiveness: input.progressionAggressiveness ?? null,
    intensityReasoning: input.intensityReasoning?.trim() || null,
  };

  return prisma.training_plan_goal.upsert({
    where: { slug },
    create: data,
    update: {
      personaId: input.personaId,
      targetDistanceLabel: data.targetDistanceLabel,
      objectiveOfPlan: data.objectiveOfPlan,
      planDurationWeeks: weeks,
      timeHorizonLabel: data.timeHorizonLabel,
      goalKind: data.goalKind,
      goalType: data.goalType,
      coachIntent: data.coachIntent,
      ...(input.fitnessDelta !== undefined ? { fitnessDelta: input.fitnessDelta } : {}),
      ...(input.progressionAggressiveness !== undefined
        ? { progressionAggressiveness: input.progressionAggressiveness }
        : {}),
      ...(input.intensityReasoning !== undefined
        ? { intensityReasoning: data.intensityReasoning }
        : {}),
    },
  });
}

export async function resolvePersonaAndGoalFromBody(body: Record<string, unknown>): Promise<{
  personaId: string;
  goalId: string;
  personaSlug: string;
  goalSlug: string;
} | null> {
  const personaIdDirect = typeof body.personaId === "string" ? body.personaId.trim() : "";
  const goalIdDirect = typeof body.goalId === "string" ? body.goalId.trim() : "";
  if (personaIdDirect && goalIdDirect) {
    const [persona, goal] = await Promise.all([
      prisma.training_plan_persona.findUnique({ where: { id: personaIdDirect } }),
      prisma.training_plan_goal.findUnique({ where: { id: goalIdDirect } }),
    ]);
    if (!persona || !goal) {
      throw new Error("Invalid personaId or goalId");
    }
    return {
      personaId: persona.id,
      goalId: goal.id,
      personaSlug: persona.slug,
      goalSlug: goal.slug,
    };
  }

  const personaSlugRaw =
    typeof body.personaSlug === "string" ? body.personaSlug.trim() : "";
  const goalSlugRaw = typeof body.goalSlug === "string" ? body.goalSlug.trim() : "";
  const title =
    typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Training preset";

  const planDurationWeeks =
    typeof body.planDurationWeeks === "number" && Number.isFinite(body.planDurationWeeks)
      ? Math.max(1, Math.round(body.planDurationWeeks))
      : typeof body.planDurationWeeks === "string" && body.planDurationWeeks.trim()
        ? Math.max(1, Math.round(Number(body.planDurationWeeks)))
        : 12;

  const capability =
    typeof body.athletePersonaCapability === "string"
      ? (body.athletePersonaCapability.trim().toUpperCase() as AthletePersonaCapability)
      : null;

  const dedication =
    typeof body.athletePersonaDedication === "string"
      ? (body.athletePersonaDedication.trim().toUpperCase() as AthletePersonaDedication)
      : null;

  const targetDistanceLabel =
    typeof body.targetDistanceLabel === "string" ? body.targetDistanceLabel.trim() : null;

  const personaSlug =
    normalizeSlug(personaSlugRaw) ||
    buildPersonaSlug({
      capability,
      targetDistanceLabel,
      goalKind:
        body.goalKind === "TRAINING_BLOCK" || body.goalKind === "trainingBlock"
          ? "TRAINING_BLOCK"
          : "RACE",
    });

  const goalSlug =
    normalizeSlug(goalSlugRaw) || buildGoalSlug(personaSlug, planDurationWeeks);

  const persona = await upsertPersonaBySlug({
    slug: personaSlug,
    title,
    capability,
    dedication,
    personaGoalLabel:
      typeof body.athletePersonaGoal === "string" ? body.athletePersonaGoal : null,
    intentSummary: typeof body.intentSummary === "string" ? body.intentSummary : null,
  });

  const goalKindRaw = body.goalKind;
  const goalKind: TrainingPlanGoalKind | null =
    goalKindRaw === "TRAINING_BLOCK" || goalKindRaw === "trainingBlock"
      ? "TRAINING_BLOCK"
      : goalKindRaw === "RACE" || goalKindRaw === "race"
        ? "RACE"
        : null;

  const goal = await upsertGoalBySlug({
    slug: goalSlug,
    personaId: persona.id,
    personaSlug,
    targetDistanceLabel,
    objectiveOfPlan:
      typeof body.objectiveOfPlan === "string" ? body.objectiveOfPlan : null,
    planDurationWeeks,
    timeHorizonLabel:
      typeof body.timeHorizonLabel === "string" ? body.timeHorizonLabel : `${planDurationWeeks} weeks`,
    goalKind,
    coachIntent: typeof body.coachIntent === "string" ? body.coachIntent : null,
    fitnessDelta:
      typeof body.fitnessDelta === "string"
        ? (body.fitnessDelta.toUpperCase() as FitnessDelta)
        : null,
    progressionAggressiveness:
      typeof body.progressionAggressiveness === "string"
        ? (body.progressionAggressiveness.toUpperCase() as ProgressionAggressiveness)
        : null,
    intensityReasoning:
      typeof body.intensityReasoning === "string" ? body.intensityReasoning : null,
  });

  return {
    personaId: persona.id,
    goalId: goal.id,
    personaSlug: persona.slug,
    goalSlug: goal.slug,
  };
}
