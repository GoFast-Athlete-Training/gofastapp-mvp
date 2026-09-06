/**
 * Resolve catalogue work pace from Athlete anchor fields + offset.
 * paceAnchor: fiveKPace | goalRacePace (legacy currentBuildup / mpSimulation accepted).
 */

import {
  isGoalRacePaceAnchor,
  normalizePaceAnchorCanonical,
  type PaceAnchorCanonical,
} from "@/lib/training/goal-pace-calculator";
import { getTrainingPaces } from "@/lib/workout-generator/pace-calculator";

export type SetPaceTargetsInput = {
  paceAnchor: string | null | undefined;
  fitnessAnchorSecPerMile: number;
  goalRacePaceSecPerMile: number | null;
  workPaceOffsetSecPerMile?: number | null;
  /** Legacy catalogue column — used only when paceAnchor is goal-race and work offset null. */
  mpPaceOffsetSecPerMile?: number | null;
};

/** Canonical anchor enum for persistence / UI. */
export { normalizePaceAnchorCanonical, type PaceAnchorCanonical };

/** Goal-MP / race-pace work always resolves to numeric sec/mi (never OPEN). */
export function resolveGoalRaceWorkPaceSecPerMile(params: SetPaceTargetsInput): number | null {
  if (!isGoalRacePaceAnchor(params.paceAnchor)) return null;
  const racePace = params.goalRacePaceSecPerMile;
  if (racePace == null) return null;
  const off =
    params.workPaceOffsetSecPerMile ?? params.mpPaceOffsetSecPerMile ?? null;
  return off != null ? Math.max(1, racePace + off) : racePace;
}

/** Fitness-anchored work pace (5K-derived zones + offset). */
export function resolveFitnessWorkPaceSecPerMile(params: SetPaceTargetsInput): number | null {
  const off = params.workPaceOffsetSecPerMile;
  if (off == null) return null;
  return Math.max(1, params.fitnessAnchorSecPerMile + off);
}

/** Primary work-block pace for catalogue row. */
export function setPaceTargetSecPerMile(params: SetPaceTargetsInput): number | null {
  const goal = resolveGoalRaceWorkPaceSecPerMile(params);
  if (goal != null) return goal;

  const fitness = resolveFitnessWorkPaceSecPerMile(params);
  if (fitness != null) return fitness;

  if (isGoalRacePaceAnchor(params.paceAnchor)) {
    const paces = getTrainingPaces(params.fitnessAnchorSecPerMile);
    const off = params.mpPaceOffsetSecPerMile;
    return off != null ? Math.max(1, paces.marathon + off) : paces.marathon;
  }

  return null;
}
