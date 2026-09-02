"use client";

import Link from "next/link";
import PaceForPacePanel from "@/components/training/PaceForPacePanel";
import type { WorkoutPerformanceAnalysis } from "@/lib/training/workout-performance-analysis";

const METERS_PER_MILE = 1609.34;

function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

type MatchedActivity = {
  activityName?: string | null;
  startTime?: string | null;
};

type WorkoutLike = {
  id: string;
  title: string;
  description?: string | null;
  garminDetailActivityId?: string | null;
  garmin_detail_activity?: MatchedActivity | null;
  actualDistanceMeters?: number | null;
  actualDurationSeconds?: number | null;
  actualAvgPaceSecPerMile?: number | null;
  actualAverageHeartRate?: number | null;
};

function buildActualsLine(workout: WorkoutLike): string {
  const parts: string[] = [];
  if (workout.actualDistanceMeters != null && workout.actualDistanceMeters > 0) {
    parts.push(`${(workout.actualDistanceMeters / METERS_PER_MILE).toFixed(2)} mi`);
  }
  if (workout.actualDurationSeconds != null && workout.actualDurationSeconds > 0) {
    parts.push(`${Math.round(workout.actualDurationSeconds / 60)} min`);
  }
  if (workout.actualAvgPaceSecPerMile != null) {
    parts.push(formatSecPerMile(workout.actualAvgPaceSecPerMile) ?? "—");
  }
  if (workout.actualAverageHeartRate != null) {
    parts.push(`${workout.actualAverageHeartRate} bpm`);
  }
  return parts.join(" · ");
}

export function CompletedWorkoutResults({
  workout,
  performanceAnalysis,
}: {
  workout: WorkoutLike;
  performanceAnalysis: WorkoutPerformanceAnalysis | null;
}) {
  const activityTitle =
    workout.garmin_detail_activity?.activityName?.trim() || workout.title || "Activity";
  const planDescription = workout.description?.trim() || null;
  const actualsLine = buildActualsLine(workout);

  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{activityTitle}</p>
        <p className="mt-3 text-sm text-gray-600">
          Plan workout:{" "}
          <span className="font-semibold text-gray-900">{workout.title}</span>
        </p>
        {planDescription ? <p className="mt-1 text-sm text-gray-600">{planDescription}</p> : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Actuals</p>
        <p className="mt-2 text-sm font-semibold tabular-nums text-gray-900">
          {actualsLine || "—"}
        </p>
      </div>

      <PaceForPacePanel
        garminDetailActivityId={workout.garminDetailActivityId}
        performanceAnalysis={performanceAnalysis}
      />

      {workout.garminDetailActivityId ? (
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/activities/${encodeURIComponent(workout.garminDetailActivityId)}`}
            className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Add photo &amp; note →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
