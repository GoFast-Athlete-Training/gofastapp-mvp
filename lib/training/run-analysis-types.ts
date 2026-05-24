/** Shared types + guards for workouts.analysisJson coach assessment (client-safe). */

export type RunAnalysisJsonV1 = {
  v: 1;
  assessedAt: string;
  narrative: string;
  hrPattern: "steady" | "drift_up" | "drift_down" | "variable" | "unknown";
  effortQuality: "on_target" | "above" | "below" | "unknown";
  recommendation: {
    field: "aerobicCeilingBpm" | "fiveKPaceSecPerMile";
    suggestedValue: number;
    reason: string;
  } | null;
  recommendationAppliedAt?: string | null;
  /** Snapshot of user context used when generating this analysis. */
  contextTags?: string[];
  contextNote?: string | null;
};

export function isRunAnalysisJsonV1(raw: unknown): raw is RunAnalysisJsonV1 {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return o.v === 1 && typeof o.narrative === "string" && typeof o.assessedAt === "string";
}
