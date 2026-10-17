"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { formatCalendarDate } from "@/lib/calendar-date";
import type { RunnerAgendaItem } from "@/lib/runner/runner-agenda";
import { runCompletePath } from "@/lib/city-run/run-nav-paths";

type Props = { item: RunnerAgendaItem };

export default function PastTrainingWorkoutRow({ item }: Props) {
  const run = item.joinedRun;
  if (!run) return null;

  const preview = run.plannedWorkoutPreview;
  const workoutId = run.workoutId ?? run.plannedWorkoutId;
  if (!workoutId && !preview) return null;

  const dateLabel = formatCalendarDate(`${item.dateKey}T12:00:00.000Z`, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const title = preview?.title?.trim() || run.title;
  const segment = run.slug?.trim() || run.id;
  const recapHref = runCompletePath(segment);
  const workoutHref = run.workoutId
    ? `/workouts/${encodeURIComponent(run.workoutId)}`
    : recapHref;

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{dateLabel}</p>
        <p className="font-semibold text-gray-900 truncate">
          {title}
        </p>
        <p className="text-sm text-gray-600 truncate">{run.title}</p>
      </div>
      <Link
        href={workoutHref}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 shrink-0"
      >
        <ExternalLink className="h-4 w-4" />
        See how the run went
      </Link>
    </article>
  );
}
