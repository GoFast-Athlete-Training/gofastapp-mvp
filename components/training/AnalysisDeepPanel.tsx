"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import {
  formatPaceTargetRangeDisplay,
  paceRangeDeltaMessage,
  paceVsTargetBadgeText,
  paceVsTargetLabel,
  singleTargetPaceDeltaMessage,
  type PaceVsTargetLabel,
} from "@/lib/training/pace-comparison-display";

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
  actualAvgPaceSecPerMile?: number | null;
  actualDurationSeconds?: number | null;
  paceDeltaSecPerMile?: number | null;
  targetPaceSecPerMile?: number | null;
  targetPaceSecPerMileHigh?: number | null;
  hrDeltaBpm?: number | null;
  creditedFiveKPaceSecPerMile?: number | null;
  matched_activity?: MatchedActivitySummary | null;
  training_plans?: {
    currentFiveKPace?: string | null;
  } | null;
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="h-16 rounded-xl bg-emerald-50" />
        <div className="h-16 rounded-xl bg-emerald-50" />
        <div className="h-16 rounded-xl bg-emerald-50" />
      </div>
    </div>
  );
}

export default function AnalysisDeepPanel({ workoutId }: { workoutId: string }) {
  const [workout, setWorkout] = useState<WorkoutDeep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await api.get<{ workout: WorkoutDeep }>(`/training/workout/${workoutId}`);
        const w = res.data?.workout;
        if (cancelled) return;
        if (w?.id) {
          setWorkout(w);
        } else {
          setError("Could not load workout");
        }
      } catch {
        if (!cancelled) setError("Could not load analysis");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  if (loading) {
    return (
      <div
        className="mt-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm"
        aria-busy="true"
        aria-label="Loading full analysis"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
          Full analysis
        </p>
        <SkeletonBlock />
      </div>
    );
  }

  if (error || !workout) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {error ?? "Analysis unavailable"}
      </div>
    );
  }

  const isLogged = Boolean(workout.matchedActivityId ?? workout.matched_activity);
  if (!isLogged) {
    return (
      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        Full analysis appears after your run is linked from Garmin or logged.
      </div>
    );
  }

  const hasPaceRangeForResults =
    workout.targetPaceSecPerMile != null &&
    workout.targetPaceSecPerMileHigh != null &&
    workout.targetPaceSecPerMileHigh !== workout.targetPaceSecPerMile;

  const paceVsPlanMessage =
    hasPaceRangeForResults && workout.actualAvgPaceSecPerMile != null
      ? paceRangeDeltaMessage(
          workout.actualAvgPaceSecPerMile,
          workout.targetPaceSecPerMile,
          workout.targetPaceSecPerMileHigh
        )
      : singleTargetPaceDeltaMessage(workout.paceDeltaSecPerMile);

  let resultsPaceBadgeLabel:
    | PaceVsTargetLabel
    | "single_faster"
    | "single_slower"
    | "single_on"
    | null = null;
  if (hasPaceRangeForResults && workout.actualAvgPaceSecPerMile != null) {
    const l = paceVsTargetLabel(
      workout.actualAvgPaceSecPerMile,
      workout.targetPaceSecPerMile,
      workout.targetPaceSecPerMileHigh
    );
    if (l !== "unknown") resultsPaceBadgeLabel = l;
  } else if (workout.paceDeltaSecPerMile != null) {
    resultsPaceBadgeLabel =
      workout.paceDeltaSecPerMile > 0
        ? "single_faster"
        : workout.paceDeltaSecPerMile < 0
          ? "single_slower"
          : "single_on";
  }

  return (
    <div className="mt-4 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Full analysis</p>
          <h3 className="mt-1 text-lg font-bold text-gray-900">{workout.title}</h3>
          <p className="text-sm font-medium text-emerald-900/90">Pace &amp; execution</p>
          {workout.matched_activity?.startTime ? (
            <p className="mt-1 text-xs text-gray-600">
              {new Date(workout.matched_activity.startTime).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>
        {resultsPaceBadgeLabel != null ? (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              resultsPaceBadgeLabel === "in_range" || resultsPaceBadgeLabel === "single_on"
                ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
                : resultsPaceBadgeLabel === "faster" || resultsPaceBadgeLabel === "single_faster"
                  ? "bg-sky-100 text-sky-900 ring-1 ring-sky-200"
                  : "bg-amber-100 text-amber-900 ring-1 ring-amber-200"
            }`}
          >
            {resultsPaceBadgeLabel === "single_faster"
              ? "Faster than target"
              : resultsPaceBadgeLabel === "single_slower"
                ? "Slower than target"
                : resultsPaceBadgeLabel === "single_on"
                  ? "On target"
                  : paceVsTargetBadgeText(resultsPaceBadgeLabel)}
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
          <dt className="text-xs font-medium text-gray-500">Target pace</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
            {formatPaceTargetRangeDisplay(workout.targetPaceSecPerMile, workout.targetPaceSecPerMileHigh) ??
              (workout.targetPaceSecPerMile != null
                ? formatSecPerMile(workout.targetPaceSecPerMile)
                : "—")}
          </dd>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
          <dt className="text-xs font-medium text-gray-500">Your pace</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
            {formatSecPerMile(workout.actualAvgPaceSecPerMile) ?? "—"}
          </dd>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
          <dt className="text-xs font-medium text-gray-500">Vs plan</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900">{paceVsPlanMessage ?? "—"}</dd>
        </div>
        {workout.actualDistanceMeters != null && workout.actualDistanceMeters > 0 ? (
          <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
            <dt className="text-xs font-medium text-gray-500">Distance</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
              {(workout.actualDistanceMeters / 1609.34).toFixed(2)} mi
            </dd>
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
        {workout.hrDeltaBpm != null ? (
          <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
            <dt className="text-xs font-medium text-gray-500">Vs target HR (mid)</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">
              {workout.hrDeltaBpm > 0
                ? `${workout.hrDeltaBpm} bpm under zone`
                : workout.hrDeltaBpm < 0
                  ? `${Math.abs(workout.hrDeltaBpm)} bpm above zone`
                  : "On target"}
            </dd>
          </div>
        ) : null}
      </dl>

      {workout.training_plans?.currentFiveKPace ? (
        <p className="mt-4 text-xs text-gray-500">
          Plan baseline 5K (snapshot): {workout.training_plans.currentFiveKPace}
          {workout.creditedFiveKPaceSecPerMile != null && workout.creditedFiveKPaceSecPerMile > 0 ? (
            <>
              {" "}
              · Implied 5K from this run:{" "}
              <span className="font-medium text-gray-700">
                {formatSecPerMile(workout.creditedFiveKPaceSecPerMile)}
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/workouts/${workout.id}`}
          className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Open full workout page
        </Link>
      </div>
    </div>
  );
}
