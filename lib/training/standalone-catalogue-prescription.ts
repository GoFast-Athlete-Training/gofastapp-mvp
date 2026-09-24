/**
 * Catalogue prescription for standalone workouts — same anchors as plan materialization.
 */

import type { workout_catalogue } from "@prisma/client";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { prescribe, type WorkoutStep } from "./prescription";
import { resolveGoalRacePace } from "./goal-pace-calculator";
import {
  parseAthletePaceAdjuster,
  type AthletePaceAdjusterRow,
} from "./athlete-pace-adjuster";

export type PrescriptionAthleteContext = {
  fiveKPace: string | null;
  goalRacePace: number | null;
} & AthletePaceAdjusterRow;

export type PrescriptionGoalContext = {
  goalTime: string | null;
  dbGoalRacePaceSecPerMile: number | null;
  goalDistance: string | null;
  distanceMeters: number | null;
  distanceLabel: string | null;
};

export type PrescriptionAnchors =
  | {
      anchorSecPerMile: number;
      goalRacePaceSecPerMile: number | null;
    }
  | { needsFiveKPace: true };

export function resolvePrescriptionAnchors(
  athlete: PrescriptionAthleteContext,
  goal: PrescriptionGoalContext | null
): PrescriptionAnchors {
  const fiveK = athlete.fiveKPace?.trim();
  if (!fiveK) {
    return { needsFiveKPace: true };
  }
  let anchorSecPerMile: number;
  try {
    anchorSecPerMile = parsePaceToSecondsPerMile(fiveK);
  } catch {
    return { needsFiveKPace: true };
  }

  const goalRacePaceSecPerMile = goal
    ? resolveGoalRacePace({
        goalTime: goal.goalTime,
        dbGoalRacePaceSecPerMile: goal.dbGoalRacePaceSecPerMile,
        athleteSnapGoalRacePace: athlete.goalRacePace,
        distanceMeters: goal.distanceMeters,
        distanceLabel: goal.distanceLabel,
        goalDistance: goal.goalDistance,
      }).goalPaceSecPerMile
    : null;

  return { anchorSecPerMile, goalRacePaceSecPerMile };
}

export function prescribeCatalogueEntry(params: {
  entry: workout_catalogue;
  scheduleMiles: number;
  athlete: PrescriptionAthleteContext;
  goal: PrescriptionGoalContext | null;
  planCycleIndex?: number | null;
}): { steps: WorkoutStep[]; goalRacePaceSecPerMile: number | null } {
  const anchors = resolvePrescriptionAnchors(params.athlete, params.goal);
  if ("needsFiveKPace" in anchors) {
    throw new Error("Athlete.fiveKPace is missing; set 5K pace on your profile.");
  }

  const paceAdjuster = parseAthletePaceAdjuster(params.athlete);

  return {
    steps: prescribe({
      entry: params.entry,
      scheduleMiles: params.scheduleMiles,
      anchorSecondsPerMile: anchors.anchorSecPerMile,
      racePaceSecondsPerMile: anchors.goalRacePaceSecPerMile,
      planCycleIndex: params.planCycleIndex ?? null,
      easyWorkPaceOffsetOverrideSecPerMile: null,
      paceAdjuster,
    }),
    goalRacePaceSecPerMile: anchors.goalRacePaceSecPerMile,
  };
}

export function goalContextFromPrimaryGoal(
  primary: {
    goalTime?: string | null;
    goalRacePace?: number | null;
    distance?: string | null;
    athlete_race?: {
      distanceMeters?: number | null;
      distanceLabel?: string | null;
      goalDistance?: string | null;
      goalTime?: string | null;
      goalRacePace?: number | null;
    } | null;
  } | null
): PrescriptionGoalContext | null {
  if (!primary) return null;
  const ar = primary.athlete_race;
  return {
    goalTime: ar?.goalTime?.trim() || primary.goalTime?.trim() || null,
    dbGoalRacePaceSecPerMile: ar?.goalRacePace ?? primary.goalRacePace ?? null,
    goalDistance: ar?.goalDistance?.trim() || primary.distance?.trim() || null,
    distanceMeters: ar?.distanceMeters ?? null,
    distanceLabel: ar?.distanceLabel ?? null,
  };
}

export function athleteContextFromRow(athlete: {
  fiveKPace?: string | null;
  goalRacePace?: number | null;
  paceAdjusterEasySecPerMile?: number | null;
  paceAdjusterLongRunSecPerMile?: number | null;
  paceAdjusterThresholdSecPerMile?: number | null;
  paceAdjusterIntervalSecPerMile?: number | null;
}): PrescriptionAthleteContext {
  return {
    fiveKPace: athlete.fiveKPace ?? null,
    goalRacePace: athlete.goalRacePace ?? null,
    paceAdjusterEasySecPerMile: athlete.paceAdjusterEasySecPerMile,
    paceAdjusterLongRunSecPerMile: athlete.paceAdjusterLongRunSecPerMile,
    paceAdjusterThresholdSecPerMile: athlete.paceAdjusterThresholdSecPerMile,
    paceAdjusterIntervalSecPerMile: athlete.paceAdjusterIntervalSecPerMile,
  };
}
