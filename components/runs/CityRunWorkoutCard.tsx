'use client';

import Link from 'next/link';
import { Activity } from 'lucide-react';
import WorkoutStructurePreview from '@/components/training/WorkoutStructurePreview';
import type { WorkoutPreviewSegment } from '@/lib/training/workout-segment-preview';
import type { CityRunWorkoutSummary } from '@/components/runs/city-run-types';

export type PlannedWorkoutSummary = {
  id: string;
  title?: string | null;
  workoutType?: string | null;
  segments?: WorkoutPreviewSegment[];
};

type CityRunWorkoutCardProps = {
  workoutId?: string | null;
  workout?: CityRunWorkoutSummary | null;
  plannedWorkout?: PlannedWorkoutSummary | null;
  workoutDescription?: string | null;
};

function segmentsHaveStructure(segments: WorkoutPreviewSegment[] | undefined): boolean {
  return Boolean(segments?.length);
}

export default function CityRunWorkoutCard({
  workoutId,
  workout,
  plannedWorkout,
  workoutDescription,
}: CityRunWorkoutCardProps) {
  const linkedId = workoutId || workout?.id || null;
  const narrative = workout?.workoutNarrative?.trim() || null;
  const legacyText = workoutDescription?.trim() || workout?.description?.trim() || null;
  const isGroupWorkout = workout?.scope === 'GROUP';
  const prescribe = plannedWorkout ?? null;

  const renderStructure = (
    segments: WorkoutPreviewSegment[] | undefined,
    workoutType: string | null | undefined
  ) => {
    if (!segmentsHaveStructure(segments)) {
      return legacyText ? (
        <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{legacyText}</p>
      ) : null;
    }
    return (
      <div className="mt-3 border-t border-gray-100 pt-3">
        <WorkoutStructurePreview segments={segments!} workoutType={workoutType} compact />
      </div>
    );
  };

  if (prescribe?.title || segmentsHaveStructure(prescribe?.segments)) {
    const p = prescribe!;
    return (
      <div className="rounded-xl border border-sky-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-sky-600" />
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Workout
          </span>
          {p.workoutType ? (
            <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
              {p.workoutType}
            </span>
          ) : null}
        </div>
        {p.title ? (
          <p className="font-semibold text-gray-900">{p.title}</p>
        ) : null}
        {narrative ? (
          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap italic">{narrative}</p>
        ) : null}
        {renderStructure(p.segments, p.workoutType)}
      </div>
    );
  }

  if (linkedId) {
    return (
      <div className="rounded-xl border border-sky-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-sky-600" />
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Workout
          </span>
          {workout?.workoutType ? (
            <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
              {workout.workoutType}
            </span>
          ) : null}
        </div>
        {workout?.title ? (
          <p className="font-semibold text-gray-900">{workout.title}</p>
        ) : null}
        {narrative ? (
          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap italic">{narrative}</p>
        ) : null}
        {renderStructure(
          workout?.segments as WorkoutPreviewSegment[] | undefined,
          workout?.workoutType
        )}
        {!isGroupWorkout ? (
          <Link
            href={`/workouts/${linkedId}`}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700"
          >
            See workout →
          </Link>
        ) : null}
      </div>
    );
  }

  if (narrative || legacyText) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Workout notes
        </p>
        {narrative ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap italic">{narrative}</p>
        ) : null}
        {legacyText ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{legacyText}</p>
        ) : null}
      </div>
    );
  }

  return null;
}
