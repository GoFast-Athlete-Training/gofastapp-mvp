/**
 * Deterministic segment rows for plan-backed workouts: catalogue expansion or
 * template + getTrainingPaces, anchored on training_plans.currentFiveKPace only
 * (keep in sync with Athlete.fiveKPace via generate / plan-lifecycle).
 * Intervals/Tempo: segments built lazily in workout detail (algo-workout-segments).
 */

import type { WorkoutType, workout_catalogue } from "@prisma/client";
import {
  getTrainingPaces,
  parsePaceToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import {
  descriptorsToApiSegments,
  getTemplateSegments,
  type ApiSegment,
} from "@/lib/workout-generator/templates";
import { catalogueEntryToApiSegments } from "@/lib/training/catalogue-to-segments";
import { resolveRacePaceSecondsPerMileForPlan } from "@/lib/training/goal-pace-calculator";

function isIntervalsOrTempo(t: WorkoutType): boolean {
  return t === "Intervals" || t === "Tempo";
}

/** Parses plan snapshot string (e.g. "7:30") to anchor sec/mile for zone math. */
export function anchorSecondsPerMileFromPlanPace(
  currentFiveKPace: string | null
): number {
  const raw = currentFiveKPace?.trim();
  if (!raw) {
    throw new Error(
      "training_plans.currentFiveKPace is required; set it from Athlete.fiveKPace when generating or updating the plan."
    );
  }
  return parsePaceToSecondsPerMile(raw);
}

/**
 * Expand one scheduled token into Garmin-compatible API segments (Easy/LongRun; catalogue when present).
 */
export function buildPlanWorkoutApiSegments(params: {
  workoutType: WorkoutType;
  miles: number;
  currentFiveKPace: string | null;
  catalogueEntry: workout_catalogue | null;
  goalRacePace?: string | null;
  goalRaceTime?: string | null;
  raceDistanceMiles?: number | null;
  planCycleIndex?: number | null;
}): ApiSegment[] {
  const {
    workoutType,
    miles,
    currentFiveKPace,
    catalogueEntry,
    goalRacePace,
    goalRaceTime,
    raceDistanceMiles,
    planCycleIndex,
  } = params;
  if (isIntervalsOrTempo(workoutType)) {
    return [];
  }
  const anchorSecPerMile = anchorSecondsPerMileFromPlanPace(currentFiveKPace);
  const paces = getTrainingPaces(anchorSecPerMile);
  const racePaceSec = resolveRacePaceSecondsPerMileForPlan({
    goalRacePace: goalRacePace ?? null,
    goalRaceTime: goalRaceTime ?? null,
    raceDistanceMiles: raceDistanceMiles ?? null,
  });
  if (catalogueEntry != null) {
    return catalogueEntryToApiSegments({
      entry: catalogueEntry,
      scheduleMiles: miles,
      anchorSecondsPerMile: anchorSecPerMile,
      racePaceSecondsPerMile: racePaceSec,
      planCycleIndex: planCycleIndex ?? null,
    });
  }
  return descriptorsToApiSegments(
    getTemplateSegments(workoutType, miles, paces),
    paces
  );
}
