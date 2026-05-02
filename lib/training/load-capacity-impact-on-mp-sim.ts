export type MpSimLoadImpact = "below_capacity" | "aligned" | "above_capacity";

/**
 * MVP1 advisory only — compare scheduled marathon-pace prescription to a coarse endurance band.
 * Do not plug into plan generation until product explicitly opts in.
 */
export function loadCapacityImpactOnMpSim(params: {
  scheduledMpMiles: number;
  /** Recent MP-relevant readiness (typically from `estimateMpCapacityFromRollingVolume`). */
  estimatedCapacityMiles: number;
  /** Bands how close aligned must be between scheduled and estimate (mile tolerance). */
  toleranceMiles?: number;
}): {
  scheduledMpMiles: number;
  estimatedCapacityMiles: number;
  toleranceMiles: number;
  impact: MpSimLoadImpact;
  message: string;
} {
  const scheduled = Math.max(0, Number(params.scheduledMpMiles) || 0);
  const cap = Math.max(0, Number(params.estimatedCapacityMiles) || 0);
  const tol =
    typeof params.toleranceMiles === "number" && params.toleranceMiles > 0
      ? params.toleranceMiles
      : 1.25;

  let impact: MpSimLoadImpact;
  if (scheduled <= cap + tol && scheduled >= cap - tol) {
    impact = "aligned";
  } else if (scheduled < cap - tol) {
    impact = "below_capacity";
  } else {
    impact = "above_capacity";
  }

  const msg =
    impact === "aligned"
      ? "MP block is within the tolerance of the athlete’s estimated current capacity."
      : impact === "below_capacity"
        ? "MP block is conservative relative to the athlete’s estimated current capacity."
        : "MP block is aggressive relative to the athlete’s estimated current capacity.";

  return {
    scheduledMpMiles: Math.round(scheduled * 100) / 100,
    estimatedCapacityMiles: Math.round(cap * 100) / 100,
    toleranceMiles: tol,
    impact,
    message: msg,
  };
}

/** Tier bands from actual run miles in the analysis window (no CTL substitute). */
export function estimateMpCapacityFromRollingVolume(actualRunMiles28d: number): number {
  const m = Math.max(0, Number(actualRunMiles28d) || 0);
  if (m < 40) return 4;
  if (m < 70) return 6;
  if (m < 100) return 9;
  return 12;
}
