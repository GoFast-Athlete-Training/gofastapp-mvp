import type { WorkoutType } from "@prisma/client";
import type { workout_catalogue } from "@prisma/client";
import { catalogueSegmentDistanceMiles } from "@/lib/training/catalogue-segment-distance";

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
const FALLBACK_EASY_MI = 5;

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
  workoutTypeFallback: Extract<WorkoutType, "Easy" | "Intervals" | "Tempo">,
  fallbackMiles?: number
): number {
  const fallback =
    fallbackMiles != null && Number.isFinite(fallbackMiles) && fallbackMiles > 0
      ? Math.round(fallbackMiles * 10) / 10
      : workoutTypeFallback === "Tempo"
        ? FALLBACK_TEMPO_MI
        : workoutTypeFallback === "Easy"
          ? FALLBACK_EASY_MI
          : FALLBACK_INTERVAL_MI;
  if (!row) {
    return fallback;
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
    const minimum = workoutTypeFallback === "Easy" ? 1 : 3;
    return Math.max(minimum, Math.round((warmup + cooldown + wbMi) * 10) / 10);
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
  return fallback;
}

function positiveMiles(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function segmentWorkMiles(segment: unknown): number | null {
  if (segment == null || typeof segment !== "object" || Array.isArray(segment)) return null;
  const row = segment as { miles?: unknown; distanceMeters?: unknown; reps?: unknown };
  const miles = catalogueSegmentDistanceMiles(row);
  if (miles == null) return null;
  const repsRaw = Number(row.reps);
  const reps = Number.isFinite(repsRaw) && repsRaw > 0 ? Math.max(1, Math.round(repsRaw)) : 1;
  return miles * reps;
}

function sumSegmentWorkMiles(segments: unknown): number {
  if (!Array.isArray(segments)) return 0;
  let total = 0;
  for (const segment of segments) {
    total += segmentWorkMiles(segment) ?? 0;
  }
  return total;
}

/** Warmup + structured work + cooldown. Null when the row has no distance to sum. */
export function catalogueWarmupWorkCooldownMiles(
  row: CatalogueMileEstimateInput | null | undefined,
): number | null {
  if (!row) return null;
  const warmup = positiveMiles(row.warmupMiles) ?? 0;
  const cooldown = positiveMiles(row.cooldownMiles) ?? 0;
  let work = 0;

  const pace = row.segmentPaceDist;
  if (pace != null && typeof pace === "object" && !Array.isArray(pace)) {
    const block = pace as { layout?: unknown; segments?: unknown; repeatCount?: unknown };
    if (block.layout === "blockRepeat" && Array.isArray(block.segments)) {
      const cycle = sumSegmentWorkMiles(block.segments);
      const repeatRaw = Number(block.repeatCount);
      const repeat =
        Number.isFinite(repeatRaw) && repeatRaw >= 1 ? Math.min(99, Math.round(repeatRaw)) : 1;
      if (cycle > 0) work = cycle * repeat;
    }
  } else if (Array.isArray(pace)) {
    work = sumSegmentWorkMiles(pace);
  }

  if (work <= 0) {
    const base = positiveMiles(row.workBaseMiles);
    if (base != null) work = base;
  }
  if (work <= 0) {
    const reps = positiveMiles(row.workBaseReps);
    const meters = positiveMiles(row.workBaseRepMeters);
    if (reps != null && meters != null) work = (reps * meters) / 1609.34;
  }

  const total = warmup + work + cooldown;
  if (total <= 0) return null;
  return Math.round(total * 10) / 10;
}
