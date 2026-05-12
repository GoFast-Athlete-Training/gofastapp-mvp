import type { WorkoutType } from "@prisma/client";
import type { workout_catalogue } from "@prisma/client";

export type CatalogueMileEstimateInput = Pick<
  workout_catalogue,
  | "workoutType"
  | "segmentPaceDist"
  | "warmupMiles"
  | "cooldownMiles"
  | "workBaseMiles"
  | "workBaseReps"
  | "workBaseRepMeters"
>;

const FALLBACK_INTERVAL_MI = 5;
const FALLBACK_TEMPO_MI = 6;

function sumSegmentDistMiles(segmentPaceDist: unknown): number | null {
  if (!Array.isArray(segmentPaceDist)) return null;
  let m = 0;
  for (const seg of segmentPaceDist) {
    if (seg && typeof seg === "object" && "distanceMeters" in seg) {
      const dm = Number((seg as { distanceMeters?: unknown }).distanceMeters);
      if (Number.isFinite(dm)) m += dm / 1609.34;
    }
  }
  return m > 0 ? m : null;
}

export function estimateCatalogueWorkoutMiles(
  row: CatalogueMileEstimateInput | null | undefined,
  workoutTypeFallback: Extract<WorkoutType, "Intervals" | "Tempo">
): number {
  if (!row) {
    return workoutTypeFallback === "Tempo"
      ? FALLBACK_TEMPO_MI
      : FALLBACK_INTERVAL_MI;
  }
  const fromSeg = sumSegmentDistMiles(row.segmentPaceDist);
  if (fromSeg != null) {
    return Math.max(
      workoutTypeFallback === "Tempo" ? 3 : 2,
      Math.round(fromSeg * 10) / 10
    );
  }
  const wu = Number(row.warmupMiles);
  const cd = Number(row.cooldownMiles);
  const warmup = Number.isFinite(wu) ? wu : 0;
  const cooldown = Number.isFinite(cd) ? cd : 0;
  const wbMi = Number(row.workBaseMiles);
  if (Number.isFinite(wbMi) && wbMi > 0) {
    return Math.max(3, Math.round((warmup + cooldown + wbMi) * 10) / 10);
  }
  const reps = row.workBaseReps;
  const repM = row.workBaseRepMeters;
  if (
    reps != null &&
    repM != null &&
    Number.isFinite(reps) &&
    reps > 0 &&
    Number.isFinite(repM) &&
    repM > 0
  ) {
    const workMi = (reps * repM) / 1609.34;
    return Math.max(3, Math.round((warmup + cooldown + workMi) * 10) / 10);
  }
  return row.workoutType === "Tempo"
    ? FALLBACK_TEMPO_MI
    : FALLBACK_INTERVAL_MI;
}
