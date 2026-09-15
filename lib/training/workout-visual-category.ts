/**
 * Canonical workout visual / evaluation category — derived from WorkoutType + segment structure.
 * Never infer from workout title strings.
 */

export type WorkoutVisualCategory = "EASY" | "INTENSITY" | "LONG" | "HYBRID" | "RACE";

function segmentPhase(title?: string | null): "work" | "warmup" | "cooldown" | "recovery" {
  if (!title) return "work";
  const t = title.toLowerCase();
  if (t.includes("warm")) return "warmup";
  if (t.includes("cool")) return "cooldown";
  if (t.includes("recovery") || t.includes("rest") || t.includes("jog")) return "recovery";
  return "work";
}

export type SegmentCategoryInput = {
  title?: string | null;
  repeatCount?: number | null;
};

/** True when prescription includes structured work reps (not title heuristics). */
export function hasStructuredWorkReps(
  segments: readonly SegmentCategoryInput[] | null | undefined
): boolean {
  if (!segments?.length) return false;
  let workSegmentCount = 0;
  for (const seg of segments) {
    const rc = seg.repeatCount;
    if (rc != null && Number.isFinite(rc) && rc > 1) return true;
    if (segmentPhase(seg.title) === "work") workSegmentCount++;
  }
  return workSegmentCount > 1;
}

export function deriveWorkoutVisualCategory(
  workoutType: string,
  segments?: readonly SegmentCategoryInput[] | null
): WorkoutVisualCategory {
  const wt = workoutType.trim();
  if (wt === "Race") return "RACE";
  if (wt === "Tempo" || wt === "Intervals" || wt === "SpeedDuration") return "INTENSITY";
  if (wt === "LongRun") {
    return hasStructuredWorkReps(segments) ? "HYBRID" : "LONG";
  }
  if (wt === "Easy") {
    return hasStructuredWorkReps(segments) ? "HYBRID" : "EASY";
  }
  return "EASY";
}

/** Map visual category to WorkoutType used for card styling when hybrid → intensity treatment. */
export function workoutTypeForVisualStyle(
  workoutType: string,
  segments?: readonly SegmentCategoryInput[] | null
): string {
  const cat = deriveWorkoutVisualCategory(workoutType, segments);
  if (cat === "HYBRID" || cat === "INTENSITY") return "Intervals";
  if (cat === "LONG") return "LongRun";
  if (cat === "RACE") return "Race";
  return "Easy";
}
