/**
 * Training hydrate snapshot — goal race, predictor facts, plan mileage, light adaptive readout.
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { metersToMiles } from "@/lib/pace-utils";
import { loadPlanMileageSnapshot, type PlanMileageSnapshot } from "@/lib/training/plan-mileage-metrics";
import { evaluateLightAdaptive, type LightAdaptiveEvaluation } from "@/lib/training/light-adaptive-service";
import {
  differenceToGoal,
  formatSecPerMile,
  parseGoalTimeToSeconds,
  parsePaceStringToSecPerMile,
  projectRaceFromFiveKSecPerMile,
  raceDistanceMilesFromRegistry,
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
  differenceToGoal: ReturnType<typeof differenceToGoal>;
  planMiles: PlanMileageSnapshot | null;
  lightAdaptive: LightAdaptiveEvaluation | null;
};

async function getActiveGoalWithRace(athleteId: string) {
  return prisma.athleteGoal.findFirst({
    where: { athleteId, status: "ACTIVE" },
    orderBy: { targetByDate: "asc" },
    include: {
      race_registry: {
        select: {
          id: true,
          name: true,
          raceDate: true,
          distanceLabel: true,
          distanceMeters: true,
        },
      },
    },
  });
}

export async function loadTrainingHydrateSnapshot(
  athleteId: string
): Promise<TrainingHydrateSnapshot> {
  const [athlete, plan, goal] = await Promise.all([
    prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { fiveKPace: true },
    }),
    prisma.training_plans.findFirst({
      where: { athleteId, lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
      orderBy: { updatedAt: "desc" },
      include: {
        race_registry: {
          select: {
            id: true,
            name: true,
            raceDate: true,
            distanceLabel: true,
            distanceMeters: true,
          },
        },
        athlete_goal: {
          select: {
            id: true,
            goalTime: true,
            goalRacePace: true,
            goalPace5K: true,
            race_registry: {
              select: {
                id: true,
                name: true,
                raceDate: true,
                distanceLabel: true,
                distanceMeters: true,
              },
            },
          },
        },
      },
    }),
    getActiveGoalWithRace(athleteId),
  ]);

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
    differenceToGoal: differenceToGoal({
      goalFinishSec: null,
      projectedFinishSec: null,
      goalPaceSecPerMile: null,
      projectedPaceSecPerMile: null,
    }),
    planMiles: null,
    lightAdaptive: null,
  };

  if (!plan) {
    const raceReg = goal?.race_registry ?? null;
    const distanceMiles = raceDistanceMilesFromRegistry(raceReg?.distanceMeters ?? null);
    const current5k =
      athlete?.fiveKPace?.trim() || null;
    const current5kSecPerMile = parsePaceStringToSecPerMile(current5k);
    const goalFinishTime = goal?.goalTime?.trim() || null;
    const goalPaceSecPerMile = goal?.goalRacePace ?? null;
    const projection =
      current5kSecPerMile != null && distanceMiles != null
        ? projectRaceFromFiveKSecPerMile(current5kSecPerMile, distanceMiles)
        : null;

    return {
      ...empty,
      goalRace: raceReg
        ? {
            name: raceReg.name ?? null,
            raceDate: raceReg.raceDate?.toISOString() ?? null,
            distanceLabel: raceReg.distanceLabel ?? null,
            distanceMiles,
            raceRegistryId: raceReg.id ?? null,
          }
        : null,
      goalFinishTime,
      goalPaceSecPerMile,
      goalPace: formatSecPerMile(goalPaceSecPerMile),
      goalPace5KSecPerMile: goal?.goalPace5K ?? null,
      current5k,
      current5kSecPerMile,
      currentRacePace: projection?.projectedPace ?? null,
      currentRacePaceSecPerMile: projection?.projectedPaceSecPerMile ?? null,
      currentProjectedFinish: projection?.projectedFinish ?? null,
      currentProjectedFinishSec: projection?.projectedFinishSec ?? null,
      differenceToGoal: differenceToGoal({
        goalFinishSec: parseGoalTimeToSeconds(goalFinishTime),
        projectedFinishSec: projection?.projectedFinishSec ?? null,
        goalPaceSecPerMile,
        projectedPaceSecPerMile: projection?.projectedPaceSecPerMile ?? null,
      }),
    };
  }

  const linkedGoal = plan.athlete_goal ?? goal;
  const race =
    plan.race_registry ??
    linkedGoal?.race_registry ??
    goal?.race_registry ??
    null;

  const distanceMiles =
    raceDistanceMilesFromRegistry(race?.distanceMeters ?? null) ??
    (race?.distanceMeters != null ? metersToMiles(Number(race.distanceMeters)) : null);

  const goalFinishTime =
    linkedGoal?.goalTime?.trim() ||
    plan.goalRaceTime?.trim() ||
    null;

  let goalPaceSecPerMile: number | null = linkedGoal?.goalRacePace ?? null;
  if (goalPaceSecPerMile == null && plan.goalRacePace?.trim()) {
    goalPaceSecPerMile = parsePaceStringToSecPerMile(plan.goalRacePace);
  }

  const current5k =
    athlete?.fiveKPace?.trim() ||
    plan.currentFiveKPace?.trim() ||
    null;
  const current5kSecPerMile = parsePaceStringToSecPerMile(current5k);

  const projection =
    current5kSecPerMile != null && distanceMiles != null
      ? projectRaceFromFiveKSecPerMile(current5kSecPerMile, distanceMiles)
      : null;

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
    goalPace5KSecPerMile: linkedGoal?.goalPace5K ?? null,
    current5k,
    current5kSecPerMile,
    currentRacePace: projection?.projectedPace ?? null,
    currentRacePaceSecPerMile: projection?.projectedPaceSecPerMile ?? null,
    currentProjectedFinish: projection?.projectedFinish ?? null,
    currentProjectedFinishSec: projection?.projectedFinishSec ?? null,
    differenceToGoal: differenceToGoal({
      goalFinishSec: parseGoalTimeToSeconds(goalFinishTime),
      projectedFinishSec: projection?.projectedFinishSec ?? null,
      goalPaceSecPerMile,
      projectedPaceSecPerMile: projection?.projectedPaceSecPerMile ?? null,
    }),
    planMiles,
    lightAdaptive,
  };
}
