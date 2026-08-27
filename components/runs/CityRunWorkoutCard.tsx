'use client';

import Link from 'next/link';
import { Activity } from 'lucide-react';
import type { CityRunWorkoutSummary } from '@/components/runs/city-run-types';

export type PlannedWorkoutSummary = {
  id: string;
  title?: string | null;
  workoutType?: string | null;
  segments?: Array<{
    id: string;
    stepOrder: number;
    title: string;
    durationType: string;
    durationValue: number;
    repeatCount?: number | null;
  }>;
};

type CityRunWorkoutCardProps = {
  workoutId?: string | null;
  workout?: CityRunWorkoutSummary | null;
  plannedWorkout?: PlannedWorkoutSummary | null;
  workoutDescription?: string | null;
};

function SegmentList({
  segments,
}: {
  segments: Array<{
    id: string;
    title: string;
    durationType: string;
    durationValue: number;
    repeatCount?: number | null;
  }>;
}) {
  return (
    <ul className="mt-3 space-y-1.5 text-sm text-gray-700 border-t border-gray-100 pt-3">
      {segments.map((s) => (
        <li key={s.id}>
          <span className="font-medium text-gray-800">{s.title}</span>
          <span className="text-gray-500">
            {' '}
            ·{' '}
            {s.durationType === 'DISTANCE'
              ? `${s.durationValue} mi`
              : `${s.durationValue} min`}
            {s.repeatCount != null && s.repeatCount > 1 ? ` ×${s.repeatCount}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function CityRunWorkoutCard({
  workoutId,
  workout,
  plannedWorkout,
  workoutDescription,
}: CityRunWorkoutCardProps) {
  const linkedId = workoutId || workout?.id || null;
  const textOnly = workoutDescription?.trim() || workout?.description?.trim() || null;
  const isGroupWorkout = workout?.scope === 'GROUP';
  const prescribe = plannedWorkout ?? null;

  if (prescribe?.title || (prescribe?.segments && prescribe.segments.length > 0)) {
    return (
      <div className="rounded-xl border border-sky-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-sky-600" />
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Workout
          </span>
          {prescribe.workoutType ? (
            <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
              {prescribe.workoutType}
            </span>
          ) : null}
        </div>
        {prescribe.title ? (
          <p className="font-semibold text-gray-900">{prescribe.title}</p>
        ) : null}
        {prescribe.segments && prescribe.segments.length > 0 ? (
          <SegmentList segments={prescribe.segments} />
        ) : textOnly ? (
          <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{textOnly}</p>
        ) : null}
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
        {workout?.segments && workout.segments.length > 0 ? (
          <SegmentList segments={workout.segments} />
        ) : textOnly ? (
          <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{textOnly}</p>
        ) : null}
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

  if (textOnly) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Workout notes
        </p>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{textOnly}</p>
      </div>
    );
  }

  return null;
}
