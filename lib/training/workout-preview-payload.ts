/**
 * Parse API workout payload for plan / Go Train previews (segments, etc.).
 */

export type PreviewSegment = {
  id: string;
  stepOrder: number;
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: number;
  repeatCount?: number | null;
  targets?: Array<{
    type: string;
    valueLow?: number;
    valueHigh?: number;
    value?: number;
  }>;
};

export type PreviewWorkout = {
  title: string;
  workoutType: string;
  description: string | null;
  estimatedDistanceInMeters?: number | null;
  /** From materialized `workouts.weekNumber` when present */
  weekNumber?: number | null;
  segments: PreviewSegment[];
};

export function pickWorkoutPayload(raw: unknown): PreviewWorkout | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Record<string, unknown>;
  const title = typeof w.title === "string" ? w.title : "";
  const workoutType = typeof w.workoutType === "string" ? w.workoutType : "";
  const description = typeof w.description === "string" ? w.description : null;
  const estimatedDistanceInMeters =
    typeof w.estimatedDistanceInMeters === "number"
      ? w.estimatedDistanceInMeters
      : null;
  const weekNumRaw = w.weekNumber;
  const weekNumber =
    weekNumRaw == null
      ? null
      : typeof weekNumRaw === "number" && Number.isFinite(weekNumRaw)
        ? weekNumRaw
        : Number(weekNumRaw);
  const segsRaw = w.segments;
  const segments: PreviewSegment[] = [];
  if (Array.isArray(segsRaw)) {
    for (const s of segsRaw) {
      if (!s || typeof s !== "object") continue;
      const o = s as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : String(o.id ?? "");
      const stepOrder =
        typeof o.stepOrder === "number" ? o.stepOrder : Number(o.stepOrder);
      const titleSeg = typeof o.title === "string" ? o.title : "";
      const durationType = o.durationType === "TIME" ? "TIME" : "DISTANCE";
      const durationValue =
        typeof o.durationValue === "number"
          ? o.durationValue
          : Number(o.durationValue);
      if (
        !id ||
        !Number.isFinite(stepOrder) ||
        !titleSeg ||
        !Number.isFinite(durationValue)
      )
        continue;
      const repeatCount =
        o.repeatCount == null
          ? undefined
          : typeof o.repeatCount === "number"
            ? o.repeatCount
            : Number(o.repeatCount);
      const targets = Array.isArray(o.targets)
        ? (o.targets as PreviewSegment["targets"])
        : undefined;
      segments.push({
        id,
        stepOrder,
        title: titleSeg,
        durationType,
        durationValue,
        repeatCount:
          repeatCount != null && Number.isFinite(repeatCount)
            ? repeatCount
            : undefined,
        targets,
      });
    }
    segments.sort((a, b) => a.stepOrder - b.stepOrder);
  }
  return {
    title,
    workoutType,
    description,
    estimatedDistanceInMeters,
    weekNumber:
      weekNumber != null && Number.isFinite(weekNumber) ? weekNumber : null,
    segments,
  };
}

export function metersToMiDisplay(m: number | null | undefined): string | null {
  if (m == null || !Number.isFinite(m)) return null;
  const mi = m / 1609.34;
  if (mi >= 10) return `${Math.round(mi)} mi`;
  if (mi >= 1) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi * 5280)} ft`;
}
