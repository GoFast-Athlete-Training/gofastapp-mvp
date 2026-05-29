"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import type {
  WorkoutPerformanceAnalysis,
  WorkSegmentDelta,
} from "@/lib/training/workout-performance-analysis";

type MatchedActivitySummary = {
  activityName?: string | null;
  startTime?: string | null;
};

interface WorkoutDeep {
  id: string;
  title: string;
  workoutType: string;
  estimatedDistanceInMeters?: number | null;
  matchedActivityId?: string | null;
  actualDistanceMeters?: number | null;
  actualDurationSeconds?: number | null;
  matched_activity?: MatchedActivitySummary | null;
}

function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")} /mi`;
}

function SkeletonBlock() {
  return (
    <div className="mt-4 animate-pulse space-y-3">
      <div className="h-5 w-48 rounded bg-emerald-100" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-16 rounded-xl bg-emerald-50" />
        <div className="h-16 rounded-xl bg-emerald-50" />
      </div>
    </div>
  );
}

function WorkSegmentDeltaList({ rows }: { rows: WorkSegmentDelta[] }) {
  return (
    <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
        Work segments
      </p>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li
            key={row.segmentId}
            className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-gray-800"
          >
            <span className="font-medium">{row.title}</span>
            <span className="tabular-nums text-gray-700">
              {formatSecPerMile(row.actualPaceSecPerMile) ?? "—"}
              {row.targetPaceSecPerMile != null ? (
                <span className="text-gray-500">
                  {" "}
                  vs {formatSecPerMile(row.targetPaceSecPerMile)}
                </span>
              ) : null}
              <span className="ml-2 font-medium text-gray-900">{row.deltaDisplay}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalysisDeepPanel({ workoutId }: { workoutId: string }) {
  const [workout, setWorkout] = useState<WorkoutDeep | null>(null);
  const [performanceAnalysis, setPerformanceAnalysis] =
    useState<WorkoutPerformanceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWorkout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        workout: WorkoutDeep;
        performanceAnalysis?: WorkoutPerformanceAnalysis;
      }>(`/training/workout/${workoutId}`);
      const w = res.data?.workout;
      if (w?.id) {
        setWorkout(w);
        setPerformanceAnalysis(res.data?.performanceAnalysis ?? null);
      } else {
        setError("Could not load workout");
      }
    } catch {
      setError("Could not load analysis");
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading analysis">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Scorecard</p>
        <SkeletonBlock />
      </div>
    );
  }

  if (error || !workout) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {error ?? "Analysis unavailable"}
      </div>
    );
  }

  const isLogged = Boolean(workout.matchedActivityId ?? workout.matched_activity);
  if (!isLogged) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        Scorecard appears after your run is linked from Garmin or logged.
      </div>
    );
  }

  const scorecard = performanceAnalysis?.scorecard ?? null;
  const distanceBadgeClass =
    scorecard?.totalMiles.status === "on_plan"
      ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
      : scorecard?.totalMiles.status === "over"
        ? "bg-sky-100 text-sky-900 ring-1 ring-sky-200"
        : "bg-amber-100 text-amber-900 ring-1 ring-amber-200";

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Scorecard</p>
        {scorecard?.totalMiles.status !== "unknown" && scorecard ? (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${distanceBadgeClass}`}
          >
            {scorecard.totalMiles.badge}
          </span>
        ) : null}
      </div>

      {scorecard?.completionOnlyMessage ? (
        <p className="mb-4 text-sm font-medium text-gray-900">{scorecard.completionOnlyMessage}</p>
      ) : null}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
        <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
          <dt className="text-xs font-medium text-gray-500">Total miles</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
            {scorecard?.totalMiles.actualMiles != null
              ? `${scorecard.totalMiles.actualMiles.toFixed(2)} mi`
              : "—"}
          </dd>
          {scorecard?.totalMiles.message ? (
            <dd className="mt-1 text-xs text-gray-600">{scorecard.totalMiles.message}</dd>
          ) : null}
        </div>

        {scorecard?.workEffort ? (
          <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
            <dt className="text-xs font-medium text-gray-500">Work effort</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">
              {scorecard.workEffort.summary ?? "—"}
            </dd>
            {scorecard.workEffort.workAvgPaceSecPerMile != null ? (
              <dd className="mt-1 text-xs text-gray-600 tabular-nums">
                Avg work pace {formatSecPerMile(scorecard.workEffort.workAvgPaceSecPerMile)}
              </dd>
            ) : null}
          </div>
        ) : null}

        {workout.actualDurationSeconds != null && workout.actualDurationSeconds > 0 ? (
          <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
            <dt className="text-xs font-medium text-gray-500">Duration</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
              {Math.round(workout.actualDurationSeconds / 60)} min
            </dd>
          </div>
        ) : null}
      </dl>

      {scorecard && scorecard.workSegmentDeltas.length > 0 ? (
        <WorkSegmentDeltaList rows={scorecard.workSegmentDeltas} />
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/workouts/${workout.id}`}
          className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Review run
        </Link>
      </div>
    </div>
  );
}
