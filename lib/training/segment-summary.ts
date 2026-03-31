/**
 * Roll up structured workout segments for UI totals (vs plan-level day mileage).
 */

export type SegmentLike = {
  stepOrder: number;
  durationType: "DISTANCE" | "TIME";
  durationValue: number;
  repeatCount?: number | null;
  title?: string;
};

export type StructuredTotals = {
  /** Sum of distance-based steps (each step: miles × repeats) */
  miles: number;
  /** Sum of time-based steps (each step: minutes × repeats) */
  minutes: number;
};

export function structuredSegmentTotals(segments: SegmentLike[]): StructuredTotals {
  let miles = 0;
  let minutes = 0;
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  for (const s of sorted) {
    const reps =
      s.repeatCount != null && s.repeatCount > 1 ? s.repeatCount : 1;
    const dur = Number(s.durationValue);
    if (!Number.isFinite(dur) || dur < 0) continue;
    if (s.durationType === "DISTANCE") miles += dur * reps;
    else minutes += dur * reps;
  }
  return { miles, minutes };
}

/** Short label for segment role from title / position (Garmin-style steps). */
export function segmentStructureBadge(
  title: string,
  indexZeroBased: number,
  totalSegments: number
): string | null {
  const t = title.toLowerCase();
  if (t.includes("warm")) return "Warm-up";
  if (t.includes("cool")) return "Cool-down";
  if (t.includes("recovery") && totalSegments > 1) return "Recovery";
  if (
    t.includes("main") ||
    t.includes("interval") ||
    t.includes("tempo") ||
    t.includes("steady") ||
    t.includes("hard") ||
    t.includes("on") /* "2 mi on" */
  ) {
    return "Main piece";
  }
  if (indexZeroBased === 0 && totalSegments > 1) return "Opening";
  if (indexZeroBased === totalSegments - 1 && totalSegments > 1) return "Closing";
  return null;
}

export function formatStructuredMilesTotal(miles: number): string | null {
  if (!Number.isFinite(miles) || miles <= 0) return null;
  if (miles >= 10) return `${Math.round(miles)} mi`;
  return `${miles.toFixed(1)} mi`;
}

export function formatStructuredMinutesTotal(minutes: number): string | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(minutes)} min`;
}
