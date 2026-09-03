import {
  formatGroupedSegmentDuration,
  formatSegmentDuration,
  formatBetweenRepeatsRecoveryLabel,
  groupSegmentsForDisplay,
  humanDisplayGroupTitle,
  humanPlanStepSideTag,
  isMultiStepRepeatGroup,
  type SegmentDisplayGroup,
  type SegmentLike,
} from '@/lib/training/segment-summary';
import {
  formatPaceTargetRangeForDisplay,
  formatPaceTargetSingleForDisplay,
  normalizePaceTargetEncodingVersion,
  workoutTargetTypeLabel,
} from '@/lib/workout-generator/pace-calculator';

export type WorkoutPreviewSegment = SegmentLike & {
  id: string;
  title: string;
  durationType: string;
  durationValue: number;
  repeatCount?: number | null;
  paceTargetEncodingVersion?: number | null;
  recoveryDurationType?: string | null;
  recoveryDurationValue?: number | null;
  notes?: string | null;
  targets?: Array<{
    type?: string;
    value?: number;
    valueLow?: number;
    valueHigh?: number;
  }> | null;
};

export function previewSegmentTargetSummary(
  segment: WorkoutPreviewSegment
): string | null {
  const targets = segment.targets;
  if (!targets?.length) return null;
  const enc = normalizePaceTargetEncodingVersion(segment.paceTargetEncodingVersion ?? undefined);
  const parts: string[] = [];
  for (const t of targets) {
    const type = (t.type || '').toUpperCase();
    if (type === 'PACE') {
      if (t.valueLow != null && t.valueHigh != null) {
        parts.push(formatPaceTargetRangeForDisplay(t.valueLow, t.valueHigh, enc));
      } else if (typeof t.value === 'number' && Number.isFinite(t.value)) {
        parts.push(formatPaceTargetSingleForDisplay(t.value, enc));
      }
    } else if (
      (type === 'HEART_RATE' || type === 'HEARTRATE') &&
      t.valueLow != null &&
      t.valueHigh != null
    ) {
      parts.push(`${workoutTargetTypeLabel(t.type || 'Target')} ${t.valueLow}–${t.valueHigh} bpm`);
    }
  }
  return parts.length ? parts.join(' · ') : null;
}

export function previewGroupedSegmentTargetSummary(
  group: SegmentDisplayGroup<WorkoutPreviewSegment>
): string | null {
  const pace = previewSegmentTargetSummary(group.work);
  if (pace) return pace;
  const notes = group.work.notes?.trim();
  return notes || null;
}

export function previewGroupedRecoveryDistanceLine(
  group: SegmentDisplayGroup<WorkoutPreviewSegment>
): string | null {
  const between = formatBetweenRepeatsRecoveryLabel(group);
  if (between) return between.replace(/^Between repeats: /, '');
  if (!group.recovery) {
    const work = group.work;
    if (
      work.recoveryDurationType &&
      work.recoveryDurationValue != null &&
      work.recoveryDurationValue > 0
    ) {
      return formatSegmentDuration({
        stepOrder: work.stepOrder,
        durationType: work.recoveryDurationType,
        durationValue: work.recoveryDurationValue,
        repeatCount: null,
        title: 'Recovery',
      });
    }
    return null;
  }
  return formatSegmentDuration({
    stepOrder: group.recovery.stepOrder,
    durationType: group.recovery.durationType,
    durationValue: group.recovery.durationValue,
    repeatCount: group.recovery.repeatCount ?? null,
    title: group.recovery.title,
  });
}

export function segmentHeaderClass(title: string, workoutType?: string): string {
  const groupTitle = humanDisplayGroupTitle({ work: { title, stepOrder: 0, durationType: 'DISTANCE', durationValue: 0 } }, workoutType).toLowerCase();
  if (groupTitle.includes('warm') || groupTitle.includes('cool')) return 'bg-gray-500 text-white';
  if (groupTitle.includes('recovery')) return 'bg-teal-600 text-white';
  if (groupTitle.includes('tempo') || groupTitle.includes('interval')) return 'bg-orange-500 text-white';
  return 'bg-gray-400 text-white';
}

export {
  groupSegmentsForDisplay,
  humanDisplayGroupTitle,
  humanPlanStepSideTag,
  isMultiStepRepeatGroup,
  formatGroupedSegmentDuration,
  formatSegmentDuration,
};
