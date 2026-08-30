"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import type { WorkoutPerformanceAnalysis } from "@/lib/training/workout-performance-analysis";
import PaceForPacePanel from "@/components/training/PaceForPacePanel";

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
  actualAvgPaceSecPerMile?: number | null;
  actualAverageHeartRate?: number | null;
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
      <div className="h-5 w-48 rounded bg-neutral-200" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-16 rounded-xl bg-neutral-100" />
        <div className="h-16 rounded-xl bg-neutral-100" />
      </div>
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
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Activity summary
        </p>
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
        Activity summary appears after your run is linked from Garmin or logged.
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
    <div className="space-y-5">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-600">
            Activity summary
          </p>
          {scorecard?.totalMiles.status !== "unknown" && scorecard ? (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${distanceBadgeClass}`}
            >
              {scorecard.totalMiles.badge}
            </span>
          ) : null}
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <dt className="text-xs font-medium text-gray-500">Distance</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
              {scorecard?.totalMiles.actualMiles != null
                ? `${scorecard.totalMiles.actualMiles.toFixed(2)} mi`
                : "—"}
            </dd>
            {scorecard?.totalMiles.message ? (
              <dd className="mt-1 text-xs text-gray-600">{scorecard.totalMiles.message}</dd>
            ) : null}
          </div>

          {workout.actualDurationSeconds != null && workout.actualDurationSeconds > 0 ? (
            <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
              <dt className="text-xs font-medium text-gray-500">Duration</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                {Math.round(workout.actualDurationSeconds / 60)} min
              </dd>
            </div>
          ) : null}

          {workout.actualAvgPaceSecPerMile != null ? (
            <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
              <dt className="text-xs font-medium text-gray-500">Avg pace</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                {formatSecPerMile(workout.actualAvgPaceSecPerMile) ?? "—"}
              </dd>
            </div>
          ) : null}

          {workout.actualAverageHeartRate != null ? (
            <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
              <dt className="text-xs font-medium text-gray-500">Avg HR</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                {workout.actualAverageHeartRate} bpm
              </dd>
            </div>
          ) : null}
        </dl>

      </div>

      <PaceForPacePanel
        workoutId={workout.id}
        matchedActivityId={workout.matchedActivityId}
        performanceAnalysis={performanceAnalysis}
        onAnalysisUpdated={setPerformanceAnalysis}
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/workouts/${workout.id}`}
          className="inline-flex rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Open workout
        </Link>
      </div>
    </div>
  );
}
