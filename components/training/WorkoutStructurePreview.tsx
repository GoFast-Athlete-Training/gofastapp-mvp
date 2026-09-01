'use client';

import {
  formatGroupedSegmentDuration,
  formatSegmentDuration,
  groupSegmentsForDisplay,
  humanDisplayGroupTitle,
  humanPlanStepSideTag,
  isMultiStepRepeatGroup,
  previewGroupedRecoveryDistanceLine,
  previewGroupedSegmentTargetSummary,
  previewSegmentTargetSummary,
  type WorkoutPreviewSegment,
} from '@/lib/training/workout-segment-preview';

type Props = {
  segments: WorkoutPreviewSegment[];
  workoutType?: string | null;
  compact?: boolean;
  className?: string;
};

export default function WorkoutStructurePreview({
  segments,
  workoutType,
  compact = false,
  className = '',
}: Props) {
  if (!segments.length) {
    return (
      <p className={`text-sm text-gray-500 ${className}`}>No structured steps for this workout.</p>
    );
  }

  const groups = groupSegmentsForDisplay(segments);

  return (
    <ul className={`space-y-1.5 list-none pl-0 m-0 ${className}`}>
      {groups.map((group, index) => {
        const segment = group.work;
        const multiStepRepeat = isMultiStepRepeatGroup(group);
        const paceLine = previewGroupedSegmentTargetSummary(group);
        const distanceLine = formatGroupedSegmentDuration(group);
        const recoveryLine = previewGroupedRecoveryDistanceLine(group);
        const sideTag = humanPlanStepSideTag(segment.title);
        const groupTitle = humanDisplayGroupTitle(group, workoutType);

        return (
          <li
            key={`${segment.id}:${group.recovery?.id ?? ''}`}
            className={`overflow-hidden rounded-lg border border-gray-100 ${compact ? '' : 'shadow-sm'}`}
          >
            <div
              className={`px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                multiStepRepeat
                  ? 'bg-orange-500 text-white'
                  : segmentHeaderClass(groupTitle, workoutType)
              }`}
            >
              {groupTitle}
            </div>
            <div className="flex items-center gap-2.5 bg-white px-3 py-2">
              <span className="w-4 shrink-0 text-sm font-bold tabular-nums text-gray-400">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                {multiStepRepeat && group.cycleSteps ? (
                  <ul className="space-y-1 list-none pl-0 m-0">
                    {group.cycleSteps.map((step) => (
                      <li key={step.id} className="text-sm font-semibold text-gray-900">
                        {formatSegmentDuration(step)}
                        {previewSegmentTargetSummary(step) ? (
                          <span className="ml-1.5 text-xs tabular-nums text-gray-500">
                            {previewSegmentTargetSummary(step)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-gray-900">{distanceLine}</span>
                    {paceLine ? (
                      <span className="ml-1.5 text-xs tabular-nums text-gray-500">{paceLine}</span>
                    ) : null}
                  </>
                )}
                {recoveryLine ? (
                  <p className="mt-0.5 text-xs text-gray-500">Recovery: {recoveryLine}</p>
                ) : null}
              </div>
              {sideTag ? (
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {sideTag}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function segmentHeaderClass(title: string, workoutType?: string | null): string {
  const t = title.toLowerCase();
  if (t.includes('warm') || t.includes('cool')) return 'bg-gray-500 text-white';
  if (t.includes('recovery')) return 'bg-teal-600 text-white';
  if (t.includes('tempo') || t.includes('interval')) return 'bg-orange-500 text-white';
  if (workoutType?.toLowerCase().includes('tempo')) return 'bg-orange-500 text-white';
  return 'bg-gray-400 text-white';
}
