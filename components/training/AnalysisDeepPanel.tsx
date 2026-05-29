"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  isRunAnalysisJsonV1,
  type RunAnalysisJsonV1,
} from "@/lib/training/run-analysis-types";
import RunContextPrompt from "@/components/training/RunContextPrompt";
import {
  formatRecommendationDisplay,
  shouldShowProfileRecommendation,
} from "@/lib/training/coach-read-display";
import { buildRunResultStatus } from "@/lib/training/run-result-status";
import type {
  WorkoutPerformanceAnalysis,
  WorkSegmentActualRow,
} from "@/lib/training/workout-performance-analysis";
import { resolveTargetComparisonPace } from "@/lib/training/workout-performance-analysis";

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
  analysisJson?: RunAnalysisJsonV1 | unknown | null;
  runContextTags?: string[] | null;
  runContextNote?: string | null;
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
  const [performanceAnalysis, setPerformanceAnalysis] =
    useState<WorkoutPerformanceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

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

  const analysis = workout?.analysisJson && isRunAnalysisJsonV1(workout.analysisJson)
    ? workout.analysisJson
    : null;

  const hrPatternLabel = (p: RunAnalysisJsonV1["hrPattern"]) => {
    switch (p) {
      case "steady":
        return "Steady aerobic";
      case "drift_up":
        return "HR drifted up";
      case "drift_down":
        return "HR eased off";
      case "variable":
        return "Variable effort";
      default:
        return null;
    }
  };

  const applyRecommendation = async (rec: NonNullable<RunAnalysisJsonV1["recommendation"]>) => {
    setApplyError(null);
    setApplyLoading(true);
    try {
      await api.post("/me/apply-run-recommendation", {
        workoutId,
        field: rec.field,
        suggestedValue: rec.suggestedValue,
      });
      await loadWorkout();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setApplyError(msg ?? "Could not apply");
    } finally {
      setApplyLoading(false);
    }
  };

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading analysis">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Analysis</p>
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
        Full analysis appears after your run is linked from Garmin or logged.
      </div>
    );
  }

  const analysisMeta = performanceAnalysis;
  const completionOnly = analysisMeta?.analysisMode === "completion_only";
  const canJudgePace = analysisMeta?.canJudgeTargetPace ?? false;
  const executionHeadline = analysisMeta?.executionHeadline ?? null;

  const comparison = resolveTargetComparisonPace({
    analysis: analysisMeta ?? {
      hasActivityDetail: false,
      hasSegmentActuals: false,
      hasWorkSegmentActuals: false,
      analysisMode: "summary_only",
      requiresDetailForTargetAnalysis: false,
      canJudgeTargetPace: false,
      workSegmentActual: null,
      workRepsOnTarget: null,
      completionOnlyMessage: null,
      executionHeadline: null,
      phaseAwareLaps: [],
    },
    workoutType: workout.workoutType,
    actualAvgPaceSecPerMile: workout.actualAvgPaceSecPerMile ?? null,
    paceDeltaSecPerMile: workout.paceDeltaSecPerMile ?? null,
    targetPaceSecPerMile: workout.targetPaceSecPerMile ?? null,
    targetPaceSecPerMileHigh: workout.targetPaceSecPerMileHigh ?? null,
  });

  const runResultStatus = buildRunResultStatus({
    plannedDistanceMeters: workout.estimatedDistanceInMeters,
    actualDistanceMeters: workout.actualDistanceMeters,
    actualAvgPaceSecPerMile: canJudgePace ? comparison.actualPaceSecPerMile : null,
    targetPaceSecPerMile: comparison.targetPaceSecPerMile,
    targetPaceSecPerMileHigh: comparison.targetPaceSecPerMileHigh,
  });

  const hasPaceRangeForResults =
    comparison.targetPaceSecPerMile != null &&
    comparison.targetPaceSecPerMileHigh != null &&
    comparison.targetPaceSecPerMileHigh !== comparison.targetPaceSecPerMile;

  const paceVsPlanMessage = canJudgePace
    ? hasPaceRangeForResults && comparison.actualPaceSecPerMile != null
      ? paceRangeDeltaMessage(
          comparison.actualPaceSecPerMile,
          comparison.targetPaceSecPerMile,
          comparison.targetPaceSecPerMileHigh
        )
      : singleTargetPaceDeltaMessage(comparison.paceDeltaSecPerMile)
    : null;

  let resultsPaceBadgeLabel:
    | PaceVsTargetLabel
    | "single_faster"
    | "single_slower"
    | "single_on"
    | null = null;
  if (canJudgePace) {
    if (
      analysisMeta?.requiresDetailForTargetAnalysis &&
      analysisMeta.workRepsOnTarget
    ) {
      const { onTarget, total } = analysisMeta.workRepsOnTarget;
      if (onTarget === total) resultsPaceBadgeLabel = "in_range";
      else if (onTarget === 0) resultsPaceBadgeLabel = "slower";
    } else if (hasPaceRangeForResults && comparison.actualPaceSecPerMile != null) {
      const l = paceVsTargetLabel(
        comparison.actualPaceSecPerMile,
        comparison.targetPaceSecPerMile,
        comparison.targetPaceSecPerMileHigh
      );
      if (l !== "unknown") resultsPaceBadgeLabel = l;
    } else if (comparison.paceDeltaSecPerMile != null) {
      resultsPaceBadgeLabel =
        comparison.paceDeltaSecPerMile > 0
          ? "single_faster"
          : comparison.paceDeltaSecPerMile < 0
            ? "single_slower"
            : "single_on";
    }
  }

  const hasTargetPace =
    comparison.targetPaceSecPerMile != null && comparison.targetPaceSecPerMile > 0;
  const showRunContextPrompt = !analysis;
  const workSegments = analysisMeta?.workSegmentActual?.segments ?? [];
  const showWorkSegmentBreakdown =
    canJudgePace && workSegments.some((s) => s.actualPaceSecPerMile != null);

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Analysis</p>
        <div className="flex flex-wrap gap-2">
          {runResultStatus.distanceStatus !== "unknown" ? (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                runResultStatus.distanceStatus === "on_plan"
                  ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
                  : runResultStatus.distanceStatus === "over"
                    ? "bg-sky-100 text-sky-900 ring-1 ring-sky-200"
                    : "bg-amber-100 text-amber-900 ring-1 ring-amber-200"
              }`}
            >
              {runResultStatus.distanceBadge}
            </span>
          ) : null}
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
      </div>

      {executionHeadline ? (
        <p className="mb-4 text-sm font-medium text-gray-900">{executionHeadline}</p>
      ) : null}

      {!hasTargetPace && !completionOnly ? (
        <p className="text-sm text-gray-500 italic mb-3">No pace target set for this session.</p>
      ) : hasTargetPace && canJudgePace ? (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-3">
          <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
            <dt className="text-xs font-medium text-gray-500">
              {analysisMeta?.requiresDetailForTargetAnalysis ? "Work target pace" : "Target pace"}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
              {formatPaceTargetRangeDisplay(
                comparison.targetPaceSecPerMile,
                comparison.targetPaceSecPerMileHigh
              ) ??
                formatSecPerMile(comparison.targetPaceSecPerMile) ??
                "—"}
            </dd>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
            <dt className="text-xs font-medium text-gray-500">
              {analysisMeta?.requiresDetailForTargetAnalysis ? "Work rep pace" : "Your pace"}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
              {formatSecPerMile(comparison.actualPaceSecPerMile) ?? "—"}
            </dd>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
            <dt className="text-xs font-medium text-gray-500">Vs plan</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">{paceVsPlanMessage ?? "—"}</dd>
          </div>
        </dl>
      ) : null}

      {showWorkSegmentBreakdown ? (
        <WorkSegmentBreakdown rows={workSegments} />
      ) : null}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {workout.actualDistanceMeters != null && workout.actualDistanceMeters > 0 ? (
          <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
            <dt className="text-xs font-medium text-gray-500">Distance</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
              {(workout.actualDistanceMeters / 1609.34).toFixed(2)} mi
            </dd>
            {runResultStatus.distanceMessage ? (
              <dd className="mt-1 text-xs text-gray-600">{runResultStatus.distanceMessage}</dd>
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

      {showRunContextPrompt ? (
        <RunContextPrompt
          className="mt-5"
          workoutId={workoutId}
          initialTags={workout.runContextTags}
          initialNote={workout.runContextNote}
          hasCoachFeedback={Boolean(analysis)}
          coachFeedbackBlocked={completionOnly && (analysisMeta?.requiresDetailForTargetAnalysis ?? false)}
          coachFeedbackBlockedReason="Coach target feedback needs Garmin lap detail for interval and tempo workouts."
          onFeedbackReady={() => void loadWorkout()}
        />
      ) : null}

      {analysis ? (
        <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-900">Coach read</p>
          <p className="mt-2 text-sm text-gray-800 leading-relaxed">{analysis.narrative}</p>
          {(() => {
            const hrLabel = hrPatternLabel(analysis.hrPattern);
            return hrLabel ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-violet-900 ring-1 ring-violet-200">
                  {hrLabel}
                </span>
              </div>
            ) : null;
          })()}
          {analysis.recommendation &&
          !analysis.recommendationAppliedAt &&
          analysis.recommendation.field &&
          analysis.recommendation.suggestedValue != null &&
          shouldShowProfileRecommendation(workout.workoutType, analysis.recommendation) ? (
            <div className="mt-4 rounded-xl border border-violet-300 bg-white/90 px-3 py-3">
              <p className="text-sm text-gray-800">{analysis.recommendation.reason}</p>
              <p className="mt-2 text-xs text-gray-600">
                {formatRecommendationDisplay(analysis.recommendation)}
              </p>
              {applyError ? (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {applyError}
                </p>
              ) : null}
              <button
                type="button"
                disabled={applyLoading}
                onClick={() => void applyRecommendation(analysis.recommendation!)}
                className="mt-3 inline-flex rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
              >
                {applyLoading ? "Applying…" : "Apply to my profile"}
              </button>
            </div>
          ) : null}
          {analysis.recommendationAppliedAt ? (
            <p className="mt-3 text-sm font-medium text-emerald-800">Applied to your profile.</p>
          ) : null}
        </div>
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

function WorkSegmentBreakdown({ rows }: { rows: WorkSegmentActualRow[] }) {
  const withActuals = rows.filter((r) => r.actualPaceSecPerMile != null);
  if (withActuals.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
        Work segments
      </p>
      <ul className="mt-2 space-y-2">
        {withActuals.map((row) => (
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
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
