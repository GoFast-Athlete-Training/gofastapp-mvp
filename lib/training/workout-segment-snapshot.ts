import type { Prisma } from "@prisma/client";
import type { ApiSegment } from "@/lib/workout-generator/templates";

/** Prescription-only segment shape stored on workouts.segmentSnapshotJson (no DB lap actuals). */
export type SegmentSnapshotStep = {
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  targets?: unknown;
  repeatCount?: number | null;
  notes?: string | null;
  paceTargetEncodingVersion: number;
};

export type SegmentSnapshotDocument = {
  v: 1;
  capturedAt: string;
  source: SegmentSnapshotSource;
  segments: SegmentSnapshotStep[];
};

export type SegmentSnapshotSource =
  | "api_lazy_segments"
  | "plan_day_materialize"
  | "segments_put"
  | "standalone_workout_post"
  | "garmin_push";

/** Build JSON document for workouts.segmentSnapshotJson from materialized API segments. */
export function segmentSnapshotDocumentFromApiSegments(
  apiSegs: ApiSegment[],
  source: SegmentSnapshotSource
): Prisma.InputJsonValue {
  const segments: SegmentSnapshotStep[] = apiSegs.map((s) => ({
    stepOrder: s.stepOrder,
    title: s.title,
    durationType: s.durationType,
    durationValue: s.durationValue,
    targets: s.targets ?? undefined,
    repeatCount: s.repeatCount ?? null,
    notes: null,
    paceTargetEncodingVersion: 2,
  }));
  const doc: SegmentSnapshotDocument = {
    v: 1,
    capturedAt: new Date().toISOString(),
    source,
    segments,
  };
  return doc as unknown as Prisma.InputJsonValue;
}

/** Build snapshot from persisted segment rows (after replace or before Garmin send). */
export function segmentSnapshotDocumentFromDbRows(
  rows: Array<{
    stepOrder: number;
    title: string;
    durationType: string;
    durationValue: number;
    targets: unknown;
    repeatCount: number | null;
    notes: string | null;
    paceTargetEncodingVersion: number;
  }>,
  source: SegmentSnapshotSource
): Prisma.InputJsonValue {
  const segments: SegmentSnapshotStep[] = rows.map((r) => ({
    stepOrder: r.stepOrder,
    title: r.title,
    durationType: r.durationType === "TIME" ? "TIME" : "DISTANCE",
    durationValue: r.durationValue,
    targets: r.targets ?? undefined,
    repeatCount: r.repeatCount ?? null,
    notes: r.notes ?? null,
    paceTargetEncodingVersion: r.paceTargetEncodingVersion,
  }));
  const doc: SegmentSnapshotDocument = {
    v: 1,
    capturedAt: new Date().toISOString(),
    source,
    segments,
  };
  return doc as unknown as Prisma.InputJsonValue;
}
