import type { PaceProfile } from "@/lib/training/preset-strategy";
import { getTrainingPaces } from "@/lib/workout-generator/pace-calculator";

export type PaceResolutionContext = {
  fitnessAnchorSecPerMile: number;
  racePaceSecPerMile: number | null;
  paceProfile: PaceProfile | null;
};

/** Approximate 10K race pace from current 5K fitness anchor (sec/mi). */
export function tenKAnchorFromFiveK(fiveKSecPerMile: number): number {
  return Math.round(fiveKSecPerMile + 15);
}

function resolveAnchorSecPerMile(
  anchor: "current5k" | "current10k" | "goalRacePace",
  ctx: PaceResolutionContext
): number {
  if (anchor === "current5k") return ctx.fitnessAnchorSecPerMile;
  if (anchor === "current10k") return tenKAnchorFromFiveK(ctx.fitnessAnchorSecPerMile);
  if (ctx.racePaceSecPerMile != null) return ctx.racePaceSecPerMile;
  return getTrainingPaces(ctx.fitnessAnchorSecPerMile).marathon;
}

/**
 * Resolve catalogue segment pace:
 * 1) paceKey + preset paceProfile
 * 2) legacy numeric offset vs fitness anchor
 */
export function resolveCataloguePaceSecPerMile(params: {
  paceKey?: string | null;
  legacyOffsetSecPerMile?: number | null;
  ctx: PaceResolutionContext;
}): number | null {
  const { paceKey, legacyOffsetSecPerMile, ctx } = params;
  const key = typeof paceKey === "string" ? paceKey.trim() : "";
  if (key && ctx.paceProfile?.[key]) {
    const entry = ctx.paceProfile[key]!;
    const anchorSec = resolveAnchorSecPerMile(entry.anchor, ctx);
    return Math.max(1, anchorSec + entry.offsetSecPerMile);
  }
  if (legacyOffsetSecPerMile != null && Number.isFinite(legacyOffsetSecPerMile)) {
    return Math.max(1, ctx.fitnessAnchorSecPerMile + legacyOffsetSecPerMile);
  }
  return null;
}

export function parsePaceProfileFromJson(raw: unknown): PaceProfile | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as PaceProfile;
}
