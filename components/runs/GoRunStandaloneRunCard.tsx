"use client";

import Link from "next/link";
import { metersToMiDisplay } from "@/lib/training/workout-preview-payload";
import type { RunnerStandaloneWorkoutRun } from "@/lib/runner/runner-agenda";

type Props = {
  run: RunnerStandaloneWorkoutRun;
};

function formatDateKey(dateKey: string): string {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateKey;
  }
}

export default function GoRunStandaloneRunCard({ run }: Props) {
  const miles =
    run.estimatedDistanceInMeters != null && run.estimatedDistanceInMeters > 0
      ? metersToMiDisplay(run.estimatedDistanceInMeters)
      : null;

  return (
    <Link
      href={`/workouts/${run.id}?back=/gorun`}
      className="block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-orange-300 transition"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Your run</p>
          <h3 className="text-base font-semibold text-gray-900 truncate">{run.title}</h3>
          {run.description ? (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{run.description}</p>
          ) : null}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-900">{formatDateKey(run.dateKey)}</p>
          {miles ? <p className="text-xs text-gray-500 mt-0.5">{miles}</p> : null}
        </div>
      </div>
    </Link>
  );
}
