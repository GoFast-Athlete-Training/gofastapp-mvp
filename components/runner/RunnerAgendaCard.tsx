'use client';

import Link from 'next/link';
import { Calendar, CheckCircle2, MapPin } from 'lucide-react';
import CityRunWorkoutCard from '@/components/runs/CityRunWorkoutCard';
import { formatCalendarDate } from '@/lib/calendar-date';
import { formatRunTime } from '@/utils/formatTime';
import type { RunnerAgendaItem } from '@/lib/runner/runner-agenda';

function milesLabel(meters: number | null | undefined): string | null {
  if (meters == null || meters <= 0) return null;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

type RunnerAgendaCardProps = {
  item: RunnerAgendaItem;
  checkingInId: string | null;
  onCheckin: (runId: string) => void;
};

export default function RunnerAgendaCard({ item, checkingInId, onCheckin }: RunnerAgendaCardProps) {
  const plan = item.plan;
  const run = item.joinedRun;
  const dateKey = item.dateKey;
  const dateLabel = formatCalendarDate(`${dateKey}T12:00:00.000Z`, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const planComplete = Boolean(plan?.matchedActivityId);
  const planHref =
    planComplete && plan?.workoutId
      ? `/workouts/${plan.workoutId}?back=/runner`
      : plan?.dateKey
        ? `/training/day/${plan.dateKey}?source=runner`
        : '/training';

  const runTimeStr =
    run != null
      ? formatRunTime({
          startTimeHour: run.startTimeHour,
          startTimeMinute: run.startTimeMinute,
          startTimePeriod: run.startTimePeriod,
        })
      : null;

  const runHref = run?.runClub?.slug
    ? `/runclub/${run.runClub.slug}`
    : run?.slug
      ? `/gorun/${run.slug}`
      : run
        ? `/gorun/${run.id}`
        : '#';

  const workoutPreview =
    run?.plannedWorkoutPreview ??
    (plan?.plannedWorkoutPreview
      ? {
          id: plan.plannedWorkoutPreview.id,
          title: plan.plannedWorkoutPreview.title,
          workoutType: plan.plannedWorkoutPreview.workoutType,
          segments: plan.plannedWorkoutPreview.segments,
        }
      : null);

  const headerLabel = item.isToday
    ? "Today's run"
    : run?.needsWereYouThere
      ? 'Confirm attendance'
      : 'Upcoming';

  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200/80 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">{headerLabel}</p>
          <p className="mt-1 text-sm text-gray-600 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {dateLabel}
            {runTimeStr ? ` · ${runTimeStr}` : null}
          </p>
        </div>
        {run?.hasCheckin ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Checked in
          </span>
        ) : planComplete ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Complete
          </span>
        ) : null}
      </div>

      {plan ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">Training plan</p>
          <p className="font-semibold text-gray-900">{plan.title}</p>
          <p className="text-sm text-gray-600">
            {plan.workoutType}
            {milesLabel(plan.estimatedDistanceInMeters)
              ? ` · ${milesLabel(plan.estimatedDistanceInMeters)}`
              : ''}
          </p>
          <Link
            href={planHref}
            className="mt-2 inline-flex text-sm font-semibold text-orange-700 hover:text-orange-800"
          >
            {planComplete ? 'Review workout →' : "View plan workout →"}
          </Link>
        </div>
      ) : null}

      {run ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
            {run.runClub?.name ?? 'Joined run'}
          </p>
          <p className="font-semibold text-gray-900">{run.title}</p>
          <p className="text-sm text-gray-600 flex items-start gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gray-400" aria-hidden />
            <span>
              {run.meetUpPoint}
              {[run.meetUpCity, run.meetUpState].filter(Boolean).length
                ? ` · ${[run.meetUpCity, run.meetUpState].filter(Boolean).join(', ')}`
                : run.city
                  ? ` · ${run.city}`
                  : ''}
            </span>
          </p>
          {run.totalMiles || run.pace ? (
            <p className="text-sm text-gray-600">
              {[run.totalMiles ? `${run.totalMiles} mi` : null, run.pace].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {workoutPreview || run?.workoutDescription ? (
        <CityRunWorkoutCard
          plannedWorkout={workoutPreview}
          workoutDescription={run?.workoutDescription ?? null}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {run?.supportsCheckin && run.isLive && !run.hasCheckin ? (
          <button
            type="button"
            disabled={checkingInId !== null}
            onClick={() => onCheckin(run.id)}
            className="inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {checkingInId === run.id ? 'Checking in…' : 'Check in'}
          </button>
        ) : null}
        {run?.supportsCheckin && run.needsWereYouThere && !run.hasCheckin ? (
          <button
            type="button"
            disabled={checkingInId !== null}
            onClick={() => onCheckin(run.id)}
            className="inline-flex rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {checkingInId === run.id ? 'Saving…' : 'Were you there?'}
          </button>
        ) : null}
        {run ? (
          <Link
            href={runHref}
            className="inline-flex rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {run.runClub?.slug ? 'Club home' : 'Run details'}
          </Link>
        ) : null}
        {plan && !run ? (
          <Link
            href={planHref}
            className="inline-flex rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Open workout
          </Link>
        ) : null}
      </div>
    </article>
  );
}
