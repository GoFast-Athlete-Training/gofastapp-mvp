import { getTrainingPaces } from "@/lib/workout-generator/pace-calculator";
import {
  adjusterForWorkoutType,
  type AthletePaceAdjuster,
  DEFAULT_ATHLETE_PACE_ADJUSTER,
} from "@/lib/training/athlete-pace-adjuster";
import type { WorkoutType } from "@prisma/client";

export type PaceResolutionContext = {
  fitnessAnchorSecPerMile: number;
  racePaceSecPerMile: number | null;
  /** Sec/mi nudge for the scheduled workout type (Easy / LongRun / Tempo / Intervals). */
  typeAdjusterSecPerMile: number;
  workoutType?: WorkoutType | string;
};

/** Approximate 10K race pace from current 5K fitness anchor (sec/mi). */
export function tenKAnchorFromFiveK(fiveKSecPerMile: number): number {
  return Math.round(fiveKSecPerMile + 15);
}

function resolveAnchorSecPerMile(
  anchor: "current5k" | "current10k" | "goalRacePace",
  ctx: Pick<PaceResolutionContext, "fitnessAnchorSecPerMile" | "racePaceSecPerMile">
): number {
  if (anchor === "current5k") return ctx.fitnessAnchorSecPerMile;
  if (anchor === "current10k") return tenKAnchorFromFiveK(ctx.fitnessAnchorSecPerMile);
  if (ctx.racePaceSecPerMile != null) return ctx.racePaceSecPerMile;
  return getTrainingPaces(ctx.fitnessAnchorSecPerMile).marathon;
}

/**
 * Resolve catalogue segment pace: anchor + catalogue offset + per-type athlete adjuster.
 * paceKey is ignored (legacy catalogue rows may still carry it).
 */
export function resolveCataloguePaceSecPerMile(params: {
  paceKey?: string | null;
  legacyOffsetSecPerMile?: number | null;
  /** MP-sim blocks use goal race pace + offset instead of 5K. */
  mpAnchorSecPerMile?: number | null;
  ctx: PaceResolutionContext;
}): number | null {
  const { legacyOffsetSecPerMile, mpAnchorSecPerMile, ctx } = params;
  const adj = ctx.typeAdjusterSecPerMile;
  const base =
    mpAnchorSecPerMile != null
      ? mpAnchorSecPerMile
      : ctx.fitnessAnchorSecPerMile;
  if (legacyOffsetSecPerMile != null && Number.isFinite(legacyOffsetSecPerMile)) {
    return Math.max(1, base + legacyOffsetSecPerMile + adj);
  }
  if (mpAnchorSecPerMile != null) {
    return Math.max(1, mpAnchorSecPerMile + adj);
  }
  return null;
}

export function buildPaceResolutionContext(params: {
  anchorSecondsPerMile: number;
  racePaceSecondsPerMile: number | null;
  workoutType: WorkoutType | string;
  paceAdjuster?: AthletePaceAdjuster | null;
}): PaceResolutionContext {
  const adjuster = params.paceAdjuster ?? DEFAULT_ATHLETE_PACE_ADJUSTER;
  return {
    fitnessAnchorSecPerMile: params.anchorSecondsPerMile,
    racePaceSecPerMile: params.racePaceSecondsPerMile,
    typeAdjusterSecPerMile: adjusterForWorkoutType(params.workoutType, adjuster),
    workoutType: params.workoutType,
  };
}

/** @deprecated preset paceProfile removed — use athlete pace adjuster columns. */
export function effectivePaceProfileForPreset(_params: {
  paceProfile: unknown;
  athletePersonaCapability?: string | null;
}): never {
  throw new Error("paceProfile is removed — use athlete pace adjuster + catalogue offsets");
}

/** @deprecated */
export function parsePaceProfileFromJson(_raw: unknown): null {
  return null;
}

export { resolveAnchorSecPerMile };
