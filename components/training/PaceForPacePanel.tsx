"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import type {
  WorkoutPerformanceAnalysis,
  WorkSegmentDelta,
} from "@/lib/training/workout-performance-analysis";
import {
  formatPaceTargetRangeDisplay,
  paceVsTargetBadgeText,
} from "@/lib/training/pace-comparison-display";

function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")} /mi`;
}

function hasPaceForPaceResult(analysis: WorkoutPerformanceAnalysis | null): boolean {
  if (!analysis) return false;
  if ((analysis.scorecard.workSegmentDeltas?.length ?? 0) > 0) return true;
  if (analysis.scorecard.workEffort?.summary) return true;
  if (analysis.executionHeadline) return true;
  if (
    analysis.canJudgeTargetPace &&
    analysis.phaseAwareLaps.some((lap) => lap.phase === "work" && lap.paceSecPerMile != null)
  ) {
    return true;
  }
  return false;
}

function WorkSegmentDeltaList({ rows }: { rows: WorkSegmentDelta[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((row) => (
        <li
          key={row.segmentId}
          className="rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm text-gray-800"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold text-gray-900">
              {row.stepOrder}. {row.title}
            </span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-900">
              {paceVsTargetBadgeText(row.vsTargetLabel)}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-xs text-gray-600">
            {row.targetPaceSecPerMile != null ? (
              <p>
                Planned:{" "}
                {formatPaceTargetRangeDisplay(
                  row.targetPaceSecPerMile,
                  row.targetPaceSecPerMileHigh
                ) ?? formatSecPerMile(row.targetPaceSecPerMile)}
              </p>
            ) : null}
            {row.actualPaceSecPerMile != null ? (
              <p className="text-sm font-medium tabular-nums text-gray-900">
                Actual: {formatSecPerMile(row.actualPaceSecPerMile)}
              </p>
            ) : null}
            {row.deltaDisplay !== "—" ? (
              <p className="font-medium text-gray-800">{row.deltaDisplay}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

type Props = {
  workoutId: string;
  matchedActivityId?: string | null;
  performanceAnalysis: WorkoutPerformanceAnalysis | null;
  onAnalysisUpdated?: (analysis: WorkoutPerformanceAnalysis) => void;
};

export default function PaceForPacePanel({
  workoutId,
  matchedActivityId,
  performanceAnalysis,
  onAnalysisUpdated,
}: Props) {
  const [analysis, setAnalysis] = useState(performanceAnalysis);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    setAnalysis(performanceAnalysis);
  }, [performanceAnalysis]);

  const current = analysis ?? performanceAnalysis;
  const available = hasPaceForPaceResult(current);
  const showOffRamp = !available && Boolean(matchedActivityId);

  const handleResolve = useCallback(async () => {
    setResolving(true);
    setResolveError(null);
    try {
      const res = await api.post<{
        ok: boolean;
        message?: string;
        performanceAnalysis?: WorkoutPerformanceAnalysis;
      }>("/training/pace-for-pace", {
        workoutId,
        activityId: matchedActivityId ?? undefined,
      });
      if (!res.data?.ok || !res.data.performanceAnalysis) {
        setResolveError(res.data?.message ?? "Pace for Pace could not be generated.");
        return;
      }
      setAnalysis(res.data.performanceAnalysis);
      onAnalysisUpdated?.(res.data.performanceAnalysis);
    } catch (e: unknown) {
      const msg =
        e &&
        typeof e === "object" &&
        "response" in e &&
        e.response &&
        typeof e.response === "object" &&
        "data" in e.response &&
        e.response.data &&
        typeof e.response.data === "object" &&
        "message" in e.response.data &&
        typeof (e.response.data as { message: unknown }).message === "string"
          ? (e.response.data as { message: string }).message
          : "Could not generate Pace for Pace.";
      setResolveError(msg);
    } finally {
      setResolving(false);
    }
  }, [workoutId, matchedActivityId, onAnalysisUpdated]);

  if (!matchedActivityId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        Link a Garmin activity to see Pace for Pace.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-violet-300 bg-violet-50/60 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-violet-900">Pace for Pace</p>

      {available ? (
        <>
          {current?.executionHeadline ? (
            <p className="mt-2 text-sm font-medium text-violet-950">{current.executionHeadline}</p>
          ) : null}
          {current?.scorecard.workEffort?.summary ? (
            <p className="mt-1 text-sm text-violet-900">{current.scorecard.workEffort.summary}</p>
          ) : null}
          {(current?.scorecard.workSegmentDeltas?.length ?? 0) > 0 ? (
            <WorkSegmentDeltaList rows={current!.scorecard.workSegmentDeltas} />
          ) : null}
        </>
      ) : (
        <>
          {(current?.paceForPaceError ?? current?.completionOnlyMessage) ? (
            <p className="mt-3 text-sm text-amber-900">
              {current?.paceForPaceError ?? current?.completionOnlyMessage}
            </p>
          ) : (
            <p className="mt-3 text-sm text-violet-900">
              Structured comparison has not been generated for this run yet.
            </p>
          )}
          {resolveError ? <p className="mt-2 text-sm text-red-700">{resolveError}</p> : null}
          {showOffRamp ? (
            <button
              type="button"
              onClick={() => void handleResolve()}
              disabled={resolving}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
            >
              {resolving ? "Generating…" : "See your Pace for Pace"}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
