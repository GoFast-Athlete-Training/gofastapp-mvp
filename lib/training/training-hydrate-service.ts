/**
 * Training hydrate snapshot — goal race, predictor facts, plan mileage, light adaptive readout.
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { metersToMiles } from "@/lib/pace-utils";
import { goalAthleteRaceSelect } from "@/lib/goal-race-display";
import { loadPlanMileageSnapshot, type PlanMileageSnapshot } from "@/lib/training/plan-mileage-metrics";
import { evaluateLightAdaptive, type LightAdaptiveEvaluation } from "@/lib/training/light-adaptive-service";
import { resolveGoalRacePace } from "@/lib/training/goal-pace-calculator";
import {
  computeRaceReadiness,
  differenceToGoal as computeDifferenceToGoal,
  formatSecPerMile,
  parseGoalTimeToSeconds,
  parsePaceStringToSecPerMile,
  raceDistanceMilesFromRegistry,
  type GoFastLongRunCapability,
  type RaceReadinessPrediction,
} from "@/lib/training/race-projection";

export type TrainingHydrateGoalRace = {
  name: string | null;
  raceDate: string | null;
  distanceLabel: string | null;
  distanceMiles: number | null;
  raceRegistryId: string | null;
};

export type TrainingHydrateSnapshot = {
  hasActivePlan: boolean;
  planId: string | null;
  goalRace: TrainingHydrateGoalRace | null;
  goalFinishTime: string | null;
  goalPaceSecPerMile: number | null;
  goalPace: string | null;
  goalPace5KSecPerMile: number | null;
  current5k: string | null;
  current5kSecPerMile: number | null;
  currentRacePace: string | null;
  currentRacePaceSecPerMile: number | null;
  currentProjectedFinish: string | null;
  currentProjectedFinishSec: number | null;
  differenceToGoal: ReturnType<typeof computeDifferenceToGoal>;
  raceReadiness: RaceReadinessPrediction;
  planMiles: PlanMileageSnapshot | null;
  lightAdaptive: LightAdaptiveEvaluation | null;
};

type RaceHydrateSource = {
  id: string;
  name: string;
  raceDate: Date;
  distanceLabel: string | null;
  distanceMeters: number | null;
};

function athleteRaceToHydrateSource(
  row: {
    raceRegistryId: string;
    name: string;
    raceDate: Date;
    distanceLabel: string | null;
    distanceMeters: number | null;
  } | null | undefined
): RaceHydrateSource | null {
  if (!row) return null;
  return {
    id: row.raceRegistryId,
    name: row.name,
    raceDate: row.raceDate,
    distanceLabel: row.distanceLabel,
    distanceMeters: row.distanceMeters,
  };
}

async function getActiveGoalWithRace(athleteId: string) {
  return prisma.athleteGoal.findFirst({
    where: { athleteId, status: "ACTIVE" },
    orderBy: { targetByDate: "asc" },
    include: {
      athlete_race: { select: goalAthleteRaceSelect },
    },
  });
}

function buildHydratePredictorFields(params: {
  current5kSecPerMile: number | null;
  goalFinishTime: string | null;
  goalPaceSecPerMile: number | null;
  goalPace5KSecPerMile: number | null;
  distanceMiles: number | null;
  gofastLongRunCapability: GoFastLongRunCapability;
}) {
  const {
    current5kSecPerMile,
    goalFinishTime,
    goalPaceSecPerMile,
    goalPace5KSecPerMile,
    distanceMiles,
    gofastLongRunCapability,
  } = params;

  const raceReadiness = computeRaceReadiness({
    current5kSecPerMile,
    goalFinishSec: parseGoalTimeToSeconds(goalFinishTime),
    goalPaceSecPerMile,
    goalPace5KSecPerMile,
    eventMiles: distanceMiles,
    evidence: null,
    gofastLongRunCapability,
  });

  const currentProjectedFinish = raceReadiness.estimatedFinish;
  const currentProjectedFinishSec = raceReadiness.estimatedFinishSec;
  const currentRacePace = raceReadiness.estimatedPace;
  const currentRacePaceSecPerMile = raceReadiness.estimatedPaceSecPerMile;

  const goalDifference = computeDifferenceToGoal({
    goalFinishSec: parseGoalTimeToSeconds(goalFinishTime),
    projectedFinishSec: currentProjectedFinishSec,
    goalPaceSecPerMile,
    projectedPaceSecPerMile: currentRacePaceSecPerMile,
  });

  return {
    raceReadiness,
    currentProjectedFinish,
    currentProjectedFinishSec,
    currentRacePace,
    currentRacePaceSecPerMile,
    differenceToGoal: {
      finishDeltaSec: raceReadiness.finishDeltaSec ?? goalDifference.finishDeltaSec,
      finishDeltaLabel: raceReadiness.gapLabel ?? goalDifference.finishDeltaLabel,
      paceDeltaSecPerMile: raceReadiness.fitnessGapSecPerMile ?? goalDifference.paceDeltaSecPerMile,
      paceDeltaLabel: raceReadiness.fitnessGapLabel ?? goalDifference.paceDeltaLabel,
      onTrack: raceReadiness.onTrack ?? goalDifference.onTrack,
    },
  };
}

export async function loadTrainingHydrateSnapshot(
  athleteId: string
): Promise<TrainingHydrateSnapshot> {
  const [athlete, plan, goal] = await Promise.all([
    prisma.athlete.findUnique({
      where: { id: athleteId },
      select: {
        fiveKPace: true,
        longRunCapabilityMiles: true,
        longRunCapabilityPaceSecPerMile: true,
        longRunCapabilityDate: true,
      },
    }),
    prisma.training_plans.findFirst({
      where: { athleteId, lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
      orderBy: { updatedAt: "desc" },
      include: {
        athlete_race: { select: goalAthleteRaceSelect },
        athlete_goal: {
          select: {
            id: true,
            goalTime: true,
            goalRacePace: true,
            goalPace5K: true,
            distance: true,
            athlete_race: { select: goalAthleteRaceSelect },
          },
        },
      },
    }),
    getActiveGoalWithRace(athleteId),
  ]);

  const emptyRaceReadiness = computeRaceReadiness({
    current5kSecPerMile: null,
    goalFinishSec: null,
    goalPaceSecPerMile: null,
    goalPace5KSecPerMile: null,
    eventMiles: null,
    evidence: null,
  });

  const empty: TrainingHydrateSnapshot = {
    hasActivePlan: false,
    planId: null,
    goalRace: null,
    goalFinishTime: null,
    goalPaceSecPerMile: null,
    goalPace: null,
    goalPace5KSecPerMile: null,
    current5k: null,
    current5kSecPerMile: null,
    currentRacePace: null,
    currentRacePaceSecPerMile: null,
    currentProjectedFinish: null,
    currentProjectedFinishSec: null,
    differenceToGoal: computeDifferenceToGoal({
      goalFinishSec: null,
      projectedFinishSec: null,
      goalPaceSecPerMile: null,
      projectedPaceSecPerMile: null,
    }),
    raceReadiness: emptyRaceReadiness,
    planMiles: null,
    lightAdaptive: null,
  };

  const gofastLongRunCapability: GoFastLongRunCapability = {
    miles: athlete?.longRunCapabilityMiles ?? null,
    paceSecPerMile: athlete?.longRunCapabilityPaceSecPerMile ?? null,
  };

  if (!plan) {
    const race = athleteRaceToHydrateSource(goal?.athlete_race);
    const distanceMiles = raceDistanceMilesFromRegistry(race?.distanceMeters ?? null);
    const current5k = athlete?.fiveKPace?.trim() || null;
    const current5kSecPerMile = parsePaceStringToSecPerMile(current5k);
    const goalFinishTime = goal?.goalTime?.trim() || null;
    const resolvedGoalPace = resolveGoalRacePace({
      goalTime: goalFinishTime,
      dbGoalRacePaceSecPerMile: goal?.goalRacePace ?? null,
      distanceMeters: race?.distanceMeters ?? null,
      distanceLabel: race?.distanceLabel ?? null,
      goalDistance: goal?.distance ?? null,
    });
    const goalPaceSecPerMile = resolvedGoalPace.goalPaceSecPerMile;
    const goalPace5KSecPerMile = goal?.goalPace5K ?? null;
    const predictor = buildHydratePredictorFields({
      current5kSecPerMile,
      goalFinishTime,
      goalPaceSecPerMile,
      goalPace5KSecPerMile,
      distanceMiles,
      gofastLongRunCapability,
    });

    return {
      ...empty,
      goalRace: race
        ? {
            name: race.name ?? null,
            raceDate: race.raceDate?.toISOString() ?? null,
            distanceLabel: race.distanceLabel ?? null,
            distanceMiles,
            raceRegistryId: race.id ?? null,
          }
        : null,
      goalFinishTime,
      goalPaceSecPerMile,
      goalPace: formatSecPerMile(goalPaceSecPerMile),
      goalPace5KSecPerMile,
      current5k,
      current5kSecPerMile,
      currentRacePace: predictor.currentRacePace,
      currentRacePaceSecPerMile: predictor.currentRacePaceSecPerMile,
      currentProjectedFinish: predictor.currentProjectedFinish,
      currentProjectedFinishSec: predictor.currentProjectedFinishSec,
      differenceToGoal: predictor.differenceToGoal,
      raceReadiness: predictor.raceReadiness,
    };
  }

  const linkedGoal = plan.athlete_goal ?? goal;
  const race =
    athleteRaceToHydrateSource(plan.athlete_race) ??
    athleteRaceToHydrateSource(linkedGoal?.athlete_race) ??
    athleteRaceToHydrateSource(goal?.athlete_race) ??
    null;

  const distanceMiles =
    raceDistanceMilesFromRegistry(race?.distanceMeters ?? null) ??
    (race?.distanceMeters != null ? metersToMiles(Number(race.distanceMeters)) : null);

  const goalFinishTime =
    linkedGoal?.goalTime?.trim() ||
    plan.goalRaceTime?.trim() ||
    null;

  const resolvedGoalPace = resolveGoalRacePace({
    goalTime: goalFinishTime,
    dbGoalRacePaceSecPerMile: linkedGoal?.goalRacePace ?? null,
    planGoalRacePace: plan.goalRacePace,
    distanceMeters: race?.distanceMeters ?? null,
    distanceLabel: race?.distanceLabel ?? null,
    goalDistance: linkedGoal?.distance ?? null,
  });
  const goalPaceSecPerMile = resolvedGoalPace.goalPaceSecPerMile;

  const current5k =
    athlete?.fiveKPace?.trim() ||
    plan.currentFiveKPace?.trim() ||
    null;
  const current5kSecPerMile = parsePaceStringToSecPerMile(current5k);
  const goalPace5KSecPerMile = linkedGoal?.goalPace5K ?? null;

  const predictor = buildHydratePredictorFields({
    current5kSecPerMile,
    goalFinishTime,
    goalPaceSecPerMile,
    goalPace5KSecPerMile,
    distanceMiles,
    gofastLongRunCapability,
  });

  const planMiles = await loadPlanMileageSnapshot({
    planId: plan.id,
    athleteId,
    planStartDate: plan.startDate,
    planSchedule: plan.planSchedule,
    storedTotalWeeks: plan.totalWeeks,
    raceDate: race?.raceDate ?? null,
    raceName: race?.name ?? null,
    raceDistanceMiles: distanceMiles,
  });

  const lightAdaptive = await evaluateLightAdaptive({
    athleteId,
    planId: plan.id,
  });

  return {
    hasActivePlan: true,
    planId: plan.id,
    goalRace: race
      ? {
          name: race.name ?? null,
          raceDate: race.raceDate?.toISOString() ?? null,
          distanceLabel: race.distanceLabel ?? null,
          distanceMiles,
          raceRegistryId: race.id ?? null,
        }
      : null,
    goalFinishTime,
    goalPaceSecPerMile,
    goalPace: formatSecPerMile(goalPaceSecPerMile),
    goalPace5KSecPerMile,
    current5k,
    current5kSecPerMile,
    currentRacePace: predictor.currentRacePace,
    currentRacePaceSecPerMile: predictor.currentRacePaceSecPerMile,
    currentProjectedFinish: predictor.currentProjectedFinish,
    currentProjectedFinishSec: predictor.currentProjectedFinishSec,
    differenceToGoal: predictor.differenceToGoal,
    raceReadiness: predictor.raceReadiness,
    planMiles,
    lightAdaptive,
  };
}
