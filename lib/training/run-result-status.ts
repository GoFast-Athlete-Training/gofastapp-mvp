/**
 * Deterministic actual-vs-plan distance and pace status for logged workouts.
 */

import {
  paceRangeDeltaMessage,
  paceVsTargetBadgeText,
  paceVsTargetLabel,
  type PaceVsTargetLabel,
} from "@/lib/training/pace-comparison-display";

export type DistanceStatus = "on_plan" | "short" | "over" | "unknown";

const METERS_PER_MILE = 1609.34;

/** Planned distance reached within ±10%; below 90% = short; above 110% = over. */
export function distanceStatus(
  plannedMeters: number | null | undefined,
  actualMeters: number | null | undefined
): DistanceStatus {
  if (
    plannedMeters == null ||
    plannedMeters <= 0 ||
    actualMeters == null ||
    actualMeters <= 0
  ) {
    return "unknown";
  }
  const ratio = actualMeters / plannedMeters;
  if (ratio >= 0.9 && ratio <= 1.1) return "on_plan";
  if (ratio < 0.9) return "short";
  return "over";
}

export function distanceStatusBadgeText(status: DistanceStatus): string {
  switch (status) {
    case "on_plan":
      return "Distance on plan";
    case "short":
      return "Shorter than planned";
    case "over":
      return "Longer than planned";
    default:
      return "—";
  }
}

export function distanceStatusMessage(
  plannedMeters: number | null | undefined,
  actualMeters: number | null | undefined
): string | null {
  if (
    plannedMeters == null ||
    plannedMeters <= 0 ||
    actualMeters == null ||
    actualMeters <= 0
  ) {
    return null;
  }
  const plannedMi = plannedMeters / METERS_PER_MILE;
  const actualMi = actualMeters / METERS_PER_MILE;
  const deltaMi = actualMi - plannedMi;
  const status = distanceStatus(plannedMeters, actualMeters);
  if (status === "on_plan") {
    return `Planned ${plannedMi.toFixed(1)} mi — on plan`;
  }
  if (status === "short") {
    return `${Math.abs(deltaMi).toFixed(1)} mi short of ${plannedMi.toFixed(1)} mi planned`;
  }
  return `${deltaMi.toFixed(1)} mi over ${plannedMi.toFixed(1)} mi planned`;
}

export function paceStatusLabel(
  actualSecPerMile: number | null | undefined,
  targetLow: number | null | undefined,
  targetHigh: number | null | undefined
): PaceVsTargetLabel {
  return paceVsTargetLabel(actualSecPerMile, targetLow, targetHigh);
}

export function paceStatusBadgeText(label: PaceVsTargetLabel): string {
  return paceVsTargetBadgeText(label);
}

export function paceStatusMessage(
  actualSecPerMile: number | null | undefined,
  targetLow: number | null | undefined,
  targetHigh: number | null | undefined
): string | null {
  return paceRangeDeltaMessage(actualSecPerMile, targetLow, targetHigh);
}

export type RunResultStatus = {
  distanceStatus: DistanceStatus;
  distanceBadge: string;
  distanceMessage: string | null;
  paceStatus: PaceVsTargetLabel;
  paceBadge: string;
  paceMessage: string | null;
};

export function buildRunResultStatus(params: {
  plannedDistanceMeters?: number | null;
  actualDistanceMeters?: number | null;
  actualAvgPaceSecPerMile?: number | null;
  targetPaceSecPerMile?: number | null;
  targetPaceSecPerMileHigh?: number | null;
}): RunResultStatus {
  const distStatus = distanceStatus(
    params.plannedDistanceMeters,
    params.actualDistanceMeters
  );
  const paceLabel = paceStatusLabel(
    params.actualAvgPaceSecPerMile,
    params.targetPaceSecPerMile,
    params.targetPaceSecPerMileHigh
  );
  return {
    distanceStatus: distStatus,
    distanceBadge: distanceStatusBadgeText(distStatus),
    distanceMessage: distanceStatusMessage(
      params.plannedDistanceMeters,
      params.actualDistanceMeters
    ),
    paceStatus: paceLabel,
    paceBadge: paceStatusBadgeText(paceLabel),
    paceMessage: paceStatusMessage(
      params.actualAvgPaceSecPerMile,
      params.targetPaceSecPerMile,
      params.targetPaceSecPerMileHigh
    ),
  };
}
