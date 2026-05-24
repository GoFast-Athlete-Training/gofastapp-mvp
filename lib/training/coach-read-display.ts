import type { RunAnalysisJsonV1 } from "@/lib/training/run-analysis-types";

function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")} /mi`;
}

/** Hide profile-update CTAs when evidence or workout type does not support them. */
export function shouldShowProfileRecommendation(
  workoutType: string,
  recommendation: RunAnalysisJsonV1["recommendation"]
): boolean {
  if (!recommendation?.field || recommendation.suggestedValue == null) return false;
  const type = workoutType.trim();
  if (recommendation.field === "fiveKPaceSecPerMile") {
    if (type === "LongRun" || type === "Easy") return false;
  }
  return true;
}

export function formatRecommendationDisplay(
  recommendation: NonNullable<RunAnalysisJsonV1["recommendation"]>
): string {
  if (recommendation.field === "aerobicCeilingBpm") {
    return `Suggested aerobic ceiling: ~${recommendation.suggestedValue} bpm`;
  }
  return `Suggested 5K pace: ~${formatSecPerMile(recommendation.suggestedValue) ?? "—"}`;
}

/** Prompt for run context when distance or pace differ meaningfully from plan. */
export function shouldPromptRunContext(params: {
  plannedDistanceMeters?: number | null;
  actualDistanceMeters?: number | null;
  targetPaceSecPerMile?: number | null;
  targetPaceSecPerMileHigh?: number | null;
  actualAvgPaceSecPerMile?: number | null;
  paceDeltaSecPerMile?: number | null;
}): boolean {
  const planned = params.plannedDistanceMeters;
  const actual = params.actualDistanceMeters;
  if (
    planned != null &&
    planned > 0 &&
    actual != null &&
    actual > 0
  ) {
    const ratio = actual / planned;
    if (ratio >= 1.1 || ratio <= 0.85) return true;
  }

  const actualPace = params.actualAvgPaceSecPerMile;
  const targetLow = params.targetPaceSecPerMile;
  const targetHigh = params.targetPaceSecPerMileHigh ?? targetLow;
  if (actualPace != null && targetHigh != null && actualPace > targetHigh + 15) {
    return true;
  }

  if (params.paceDeltaSecPerMile != null && params.paceDeltaSecPerMile < -20) {
    return true;
  }

  return false;
}

export const RUN_CONTEXT_OPTIONS = [
  "Training",
  "Ran with a group",
  "Fueling practice",
  "Hills/terrain",
  "Heat/weather",
  "Other",
] as const;

export type RunContextOption = (typeof RUN_CONTEXT_OPTIONS)[number];
