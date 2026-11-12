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
  /** Preset-wide sec/mi added after the catalogue offset. Negative is faster. Default 0. */
  presetNudgeSecPerMile: number;
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
 * Resolve catalogue segment pace: anchor + catalogue offset + preset nudge + per-type athlete adjuster.
 */
export function resolveCataloguePaceSecPerMile(params: {
  paceKey?: string | null;
  legacyOffsetSecPerMile?: number | null;
  mpAnchorSecPerMile?: number | null;
  ctx: PaceResolutionContext;
}): number | null {
  const { legacyOffsetSecPerMile, mpAnchorSecPerMile, ctx } = params;
  const adj = ctx.typeAdjusterSecPerMile;
  const presetNudge =
    ctx.presetNudgeSecPerMile != null && Number.isFinite(ctx.presetNudgeSecPerMile)
      ? ctx.presetNudgeSecPerMile
      : 0;
  const base =
    mpAnchorSecPerMile != null
      ? mpAnchorSecPerMile
      : ctx.fitnessAnchorSecPerMile;
  if (legacyOffsetSecPerMile != null && Number.isFinite(legacyOffsetSecPerMile)) {
    return Math.max(1, base + legacyOffsetSecPerMile + presetNudge + adj);
  }
  if (mpAnchorSecPerMile != null) {
    return Math.max(1, mpAnchorSecPerMile + presetNudge + adj);
  }
  return null;
}

export function buildPaceResolutionContext(params: {
  anchorSecondsPerMile: number;
  racePaceSecondsPerMile: number | null;
  workoutType: WorkoutType | string;
  paceAdjuster?: AthletePaceAdjuster | null;
  presetNudgeSecPerMile?: number | null;
}): PaceResolutionContext {
  const adjuster = params.paceAdjuster ?? DEFAULT_ATHLETE_PACE_ADJUSTER;
  const presetNudge = params.presetNudgeSecPerMile;
  return {
    fitnessAnchorSecPerMile: params.anchorSecondsPerMile,
    racePaceSecPerMile: params.racePaceSecondsPerMile,
    typeAdjusterSecPerMile: adjusterForWorkoutType(params.workoutType, adjuster),
    presetNudgeSecPerMile:
      presetNudge != null && Number.isFinite(presetNudge) ? Math.round(presetNudge) : 0,
    workoutType: params.workoutType,
  };
}

export { resolveAnchorSecPerMile };
