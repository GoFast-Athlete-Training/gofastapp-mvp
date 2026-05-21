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

/** Miles → meters (matches Garmin conversion in lib/garmin-workouts/types). */
export const SEGMENT_METERS_PER_MILE = 1609.34;

/**
 * Human-readable distance for RUN prescriptions: show meters when the value matches a standard track rep length.
 * Otherwise show miles (1 decimal under 10 mi).
 */
export function formatSegmentDistance(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return "—";
  const meters = miles * SEGMENT_METERS_PER_MILE;
  if (meters <= 5000 && meters > 0) {
    const rounded50 = Math.round(meters / 50) * 50;
    if (rounded50 > 0) {
      const relErr = Math.abs(meters - rounded50) / meters;
      if (relErr <= 0.005) {
        return `${rounded50}m`;
      }
    }
  }
  if (miles >= 10) return `${Math.round(miles)} mi`;
  return `${miles.toFixed(1)} mi`;
}

/** DISTANCE → formatted distance; TIME → rounded minutes. */
export function formatSegmentDuration(seg: SegmentLike): string {
  if (seg.durationType === "TIME") {
    const min = Number(seg.durationValue);
    if (!Number.isFinite(min) || min < 0) return "—";
    if (min >= 60 && min % 1 !== 0) return `${min.toFixed(1)} min`;
    return `${Math.round(min)} min`;
  }
  return formatSegmentDistance(Number(seg.durationValue));
}

export function isRecoveryTitle(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.includes("recovery") ||
    /\bjog\b/.test(t) ||
    t.includes("jog between") ||
    /\brest\b/.test(t)
  );
}

export type SegmentDisplayGroup<T extends SegmentLike = SegmentLike> = {
  work: T;
  recovery?: T;
  /** Repeats when flat per-rep DB rows were collapsed for display (not stored on work row). */
  flatRepeatCount?: number;
};

/** Miles → meters for editable inputs; snaps to 50m track reps like formatSegmentDistance. */
export function milesToDisplayMeters(miles: number): number {
  if (!Number.isFinite(miles) || miles <= 0) return 0;
  const meters = miles * SEGMENT_METERS_PER_MILE;
  if (meters <= 5000) {
    const rounded50 = Math.round(meters / 50) * 50;
    if (rounded50 > 0) {
      const relErr = Math.abs(meters - rounded50) / meters;
      if (relErr <= 0.005) return rounded50;
    }
  }
  return Math.round(meters);
}

export function segmentsMatchForRepeat(a: SegmentLike, b: SegmentLike): boolean {
  const titleA = (a.title ?? "").trim().toLowerCase();
  const titleB = (b.title ?? "").trim().toLowerCase();
  if (titleA !== titleB) return false;
  if (a.durationType !== b.durationType) return false;
  const da = Number(a.durationValue);
  const db = Number(b.durationValue);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return false;
  return Math.abs(da - db) < 1e-5;
}

/** Effective repeat count for a display group (stored repeatCount or collapsed flat reps). */
export function effectiveRepeatCount(group: SegmentDisplayGroup): number {
  const stored = group.work.repeatCount;
  if (stored != null && stored > 1) return stored;
  if (group.flatRepeatCount != null && group.flatRepeatCount > 1) return group.flatRepeatCount;
  return 1;
}

function tryCollapseAlternatingWorkRecovery<T extends SegmentLike>(
  segmentsInOrder: T[],
  start: number
): { workCount: number; recovery?: T; nextIndex: number } | null {
  const work = segmentsInOrder[start];
  if (!work || isRecoveryTitle(work.title ?? "")) return null;

  let workCount = 0;
  let recovery: T | undefined;
  let i = start;

  while (i < segmentsInOrder.length) {
    const w = segmentsInOrder[i];
    if (!w || isRecoveryTitle(w.title ?? "")) break;
    if (workCount > 0 && !segmentsMatchForRepeat(work, w)) break;

    workCount++;
    const r = segmentsInOrder[i + 1];
    if (r && isRecoveryTitle(r.title ?? "")) {
      if (!recovery) recovery = r;
      else if (!segmentsMatchForRepeat(recovery, r)) break;
      i += 2;
      continue;
    }
    i += 1;
    break;
  }

  if (workCount <= 1) return null;
  return { workCount, recovery, nextIndex: i };
}

/** Pair repeat blocks with the following recovery row when titles match (catalogue materialization pattern). */
export function groupSegmentsForDisplay<T extends SegmentLike>(
  segments: T[]
): SegmentDisplayGroup<T>[] {
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  return groupSegmentsInDisplayOrder(sorted);
}

/** Pair detection for merging repeat work + following recovery (same rules as grouping). */
export function isPairRecovery(work: SegmentLike, maybeRecovery: SegmentLike): boolean {
  const reps = work.repeatCount != null && work.repeatCount > 1 ? work.repeatCount : 1;
  return (
    reps > 1 &&
    isRecoveryTitle(maybeRecovery.title ?? "") &&
    !isRecoveryTitle(work.title ?? "") &&
    (maybeRecovery.repeatCount == null || maybeRecovery.repeatCount <= 1)
  );
}

/** Group segments without re-sorting — use when order comes from quick-reorder or API order. */
export function groupSegmentsInDisplayOrder<T extends SegmentLike>(
  segmentsInOrder: T[]
): SegmentDisplayGroup<T>[] {
  const out: SegmentDisplayGroup<T>[] = [];
  let i = 0;

  while (i < segmentsInOrder.length) {
    const work = segmentsInOrder[i]!;

    if (i > 0 && isPairRecovery(segmentsInOrder[i - 1]!, work)) {
      i++;
      continue;
    }

    if (work.repeatCount != null && work.repeatCount > 1) {
      const next = segmentsInOrder[i + 1];
      const recovery = next && isPairRecovery(work, next) ? next : undefined;
      out.push({ work, recovery });
      i += recovery ? 2 : 1;
      continue;
    }

    const alt = tryCollapseAlternatingWorkRecovery(segmentsInOrder, i);
    if (alt) {
      out.push({ work, recovery: alt.recovery, flatRepeatCount: alt.workCount });
      i = alt.nextIndex;
      continue;
    }

    if (!isRecoveryTitle(work.title ?? "")) {
      let count = 1;
      let j = i + 1;
      while (j < segmentsInOrder.length) {
        const nextSeg = segmentsInOrder[j]!;
        if (isRecoveryTitle(nextSeg.title ?? "")) break;
        if (!segmentsMatchForRepeat(work, nextSeg)) break;
        count++;
        j++;
      }
      if (count > 1) {
        out.push({ work, flatRepeatCount: count });
        i = j;
        continue;
      }
    }

    const next = segmentsInOrder[i + 1];
    const recovery = next && isPairRecovery(work, next) ? next : undefined;
    out.push({ work, recovery });
    i += recovery ? 2 : 1;
  }

  return out;
}

/** Human-readable distance/duration for a grouped segment row (includes × N when collapsed). */
export function formatGroupedSegmentDuration(group: SegmentDisplayGroup): string {
  const duration = formatSegmentDuration(group.work);
  const reps = effectiveRepeatCount(group);
  if (reps > 1) return `${duration} × ${reps}`;
  return duration;
}

/**
 * Collapse flat materialized reps into canonical rows with repeatCount for Garmin assembly.
 * UI stays grouped via groupSegmentsInDisplayOrder; Garmin push calls this first.
 */
export function expandSegmentsForGarminPush<T extends SegmentLike>(
  segmentsInOrder: T[]
): Array<T & { stepOrder: number; repeatCount?: number | null }> {
  const groups = groupSegmentsInDisplayOrder(segmentsInOrder);
  const out: Array<T & { stepOrder: number; repeatCount?: number | null }> = [];
  let stepOrder = 1;

  for (const g of groups) {
    const reps = effectiveRepeatCount(g);
    if (reps > 1) {
      out.push({
        ...g.work,
        stepOrder,
        repeatCount: reps,
      });
      stepOrder++;
      if (g.recovery) {
        out.push({
          ...g.recovery,
          stepOrder,
          repeatCount: 1,
        });
        stepOrder++;
      }
      continue;
    }

    out.push({ ...g.work, stepOrder, repeatCount: g.work.repeatCount ?? null });
    stepOrder++;
    if (g.recovery) {
      out.push({ ...g.recovery, stepOrder, repeatCount: g.recovery.repeatCount ?? null });
      stepOrder++;
    }
  }

  return out;
}

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
