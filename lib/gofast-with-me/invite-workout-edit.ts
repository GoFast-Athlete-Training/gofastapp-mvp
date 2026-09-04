import type { WorkoutPreviewSegment } from '@/lib/training/workout-segment-preview';

export type InvitePaceEase = 'easier' | 'keep' | 'quicker';

export const PACE_OFFSET_PRESETS: Record<InvitePaceEase, number> = {
  easier: 15,
  keep: 0,
  quicker: -15,
};

const PACE_EASE_DELTA = PACE_OFFSET_PRESETS;

const METERS_PER_MILE = 1609.34;

export function milesToMeters(miles: number): number {
  return Math.round(miles * METERS_PER_MILE);
}

export function metersToMiles(meters: number | null | undefined): number | null {
  if (meters == null || meters <= 0 || !Number.isFinite(meters)) return null;
  return Math.round((meters / METERS_PER_MILE) * 10) / 10;
}

function shiftPaceTargetValue(value: number, delta: number): number {
  return Math.round(value + delta);
}

function adjustSegmentTargets(
  targets: WorkoutPreviewSegment['targets'],
  delta: number
): WorkoutPreviewSegment['targets'] {
  if (!targets?.length || delta === 0) return targets;
  return targets.map((t) => {
    const type = (t.type || '').toUpperCase();
    if (type === 'PACE_OFFSET') {
      const next: typeof t = { ...t };
      if (typeof t.value === 'number' && Number.isFinite(t.value)) {
        next.value = shiftPaceTargetValue(t.value, delta);
      }
      if (typeof t.valueLow === 'number' && Number.isFinite(t.valueLow)) {
        next.valueLow = shiftPaceTargetValue(t.valueLow, delta);
      }
      if (typeof t.valueHigh === 'number' && Number.isFinite(t.valueHigh)) {
        next.valueHigh = shiftPaceTargetValue(t.valueHigh, delta);
      }
      return next;
    }
    if (type === 'PACE') {
      const next: typeof t = { ...t };
      if (typeof t.value === 'number' && Number.isFinite(t.value)) {
        next.value = shiftPaceTargetValue(t.value, delta);
      }
      if (typeof t.valueLow === 'number' && Number.isFinite(t.valueLow)) {
        next.valueLow = shiftPaceTargetValue(t.valueLow, delta);
      }
      if (typeof t.valueHigh === 'number' && Number.isFinite(t.valueHigh)) {
        next.valueHigh = shiftPaceTargetValue(t.valueHigh, delta);
      }
      return next;
    }
    return t;
  });
}

export function applyPaceOffsetDeltaToSegments(
  baselineSegments: WorkoutPreviewSegment[],
  deltaSecPerMile: number
): WorkoutPreviewSegment[] {
  if (!Number.isFinite(deltaSecPerMile) || deltaSecPerMile === 0) {
    return baselineSegments.map((s) => ({
      ...s,
      targets: s.targets ? s.targets.map((t) => ({ ...t })) : s.targets,
    }));
  }
  return baselineSegments.map((seg) => ({
    ...seg,
    targets: adjustSegmentTargets(seg.targets, deltaSecPerMile),
  }));
}

export function applyPaceEaseToSegments(
  segments: WorkoutPreviewSegment[],
  baselineSegments: WorkoutPreviewSegment[],
  paceEase: InvitePaceEase
): WorkoutPreviewSegment[] {
  return applyPaceOffsetDeltaToSegments(baselineSegments, PACE_EASE_DELTA[paceEase]);
}

export function presetForPaceOffset(deltaSecPerMile: number): InvitePaceEase | null {
  if (!Number.isFinite(deltaSecPerMile)) return null;
  for (const [preset, value] of Object.entries(PACE_OFFSET_PRESETS) as [InvitePaceEase, number][]) {
    if (deltaSecPerMile === value) return preset;
  }
  return null;
}

export function scaleSegmentDistances(
  segments: WorkoutPreviewSegment[],
  baselineMeters: number,
  nextMeters: number
): WorkoutPreviewSegment[] {
  if (baselineMeters <= 0 || nextMeters <= 0) return segments;
  const ratio = nextMeters / baselineMeters;
  return segments.map((seg) => ({
    ...seg,
    durationValue:
      seg.durationType === 'DISTANCE'
        ? Math.max(1, Math.round(seg.durationValue * ratio))
        : seg.durationValue,
    recoveryDurationValue:
      seg.recoveryDurationType === 'DISTANCE' && seg.recoveryDurationValue != null
        ? Math.max(1, Math.round(seg.recoveryDurationValue * ratio))
        : seg.recoveryDurationValue,
  }));
}

export type PrescribeSegmentPayload = {
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  targets: WorkoutPreviewSegment['targets'];
  repeatCount: number | null;
  notes: string | null;
  recoveryDurationType: string | null;
  recoveryDurationValue: number | null;
};

export function segmentsToPrescribePayload(
  segments: WorkoutPreviewSegment[]
): PrescribeSegmentPayload[] {
  return segments.map((seg, i) => ({
    stepOrder: seg.stepOrder ?? i + 1,
    title: seg.title,
    durationType: seg.durationType,
    durationValue: seg.durationValue,
    targets: seg.targets ?? null,
    repeatCount: seg.repeatCount ?? null,
    notes: seg.notes ?? null,
    recoveryDurationType: seg.recoveryDurationType ?? null,
    recoveryDurationValue: seg.recoveryDurationValue ?? null,
  }));
}
