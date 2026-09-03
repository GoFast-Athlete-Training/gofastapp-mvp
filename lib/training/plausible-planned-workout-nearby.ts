import {
  isHighConfidenceActivityCandidate,
  type ScoredActivityCandidate,
} from "@/lib/training/workout-activity-match-candidates";

/** True when a nearby unmatched planned workout could still claim this activity. */
export function isPlausiblePlannedWorkoutNearby(params: {
  scored: Pick<ScoredActivityCandidate, "reasons">;
}): boolean {
  if (params.scored.reasons.includes("title_match")) return true;
  if (isHighConfidenceActivityCandidate(params.scored)) return true;
  if (params.scored.reasons.includes("same_day")) return true;
  return false;
}
