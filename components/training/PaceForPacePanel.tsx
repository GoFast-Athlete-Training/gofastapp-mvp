"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import type {
  PhaseAwareLapRow,
  WorkoutPerformanceAnalysis,
} from "@/lib/training/workout-performance-analysis";
import {
  formatPaceTargetRangeDisplay,
} from "@/lib/training/pace-comparison-display";
import { NO_DETAIL_SUPPORT_MESSAGE } from "@/lib/training/workout-pace-analyzer";

function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

function formatDeltaSecPerMile(delta: number | null | undefined): string {
  if (delta == null || !Number.isFinite(delta)) return "—";
  const rounded = Math.round(delta);
  if (rounded === 0) return "on band";
  const abs = Math.abs(rounded);
  return rounded > 0 ? `${abs}s faster` : `${abs}s slower`;
}

function hasLapPaceDeltas(analysis: WorkoutPerformanceAnalysis | null): boolean {
  if (!analysis) return false;
  return analysis.phaseAwareLaps.some(
    (lap) => lap.paceDeltaSecPerMile != null && Number.isFinite(lap.paceDeltaSecPerMile)
  );
}

function phaseLabel(phase: PhaseAwareLapRow["phase"]): string {
  switch (phase) {
    case "warmup":
      return "Warmup";
    case "work":
      return "Work";
    case "recovery":
      return "Recovery";
    case "cooldown":
      return "Cooldown";
  }
}

function SplitBar({ lap }: { lap: PhaseAwareLapRow }) {
  const pace = formatSecPerMile(lap.paceSecPerMile);
  const prescribed =
    lap.targetPaceSecPerMile != null
      ? formatPaceTargetRangeDisplay(lap.targetPaceSecPerMile, lap.targetPaceSecPerMileHigh)
      : "OPEN";
  const delta = formatDeltaSecPerMile(lap.paceDeltaSecPerMile);
  const barWidth =
    lap.paceSecPerMile != null
      ? `${Math.min(100, Math.max(18, 600 / lap.paceSecPerMile))}%`
      : "24%";

  return (
    <li className="rounded-xl border border-violet-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-gray-900">
          {phaseLabel(lap.phase)}
          {lap.segmentTitle ? ` · ${lap.segmentTitle}` : ""}
        </span>
        <span className="tabular-nums text-gray-800">{pace ?? "—"}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-violet-100">
        <div
          className="h-2 rounded-full bg-violet-600 transition-all"
          style={{ width: barWidth }}
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-gray-600">
        <span>Prescribed: {prescribed ?? "OPEN"}</span>
        <span className="font-medium text-violet-900">{delta}</span>
      </div>
    </li>
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
  const available = hasLapPaceDeltas(current);
  const showOffRamp = !available && Boolean(matchedActivityId);
  const laps = current?.phaseAwareLaps ?? [];

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
        setResolveError(res.data?.message ?? NO_DETAIL_SUPPORT_MESSAGE);
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
          : NO_DETAIL_SUPPORT_MESSAGE;
      setResolveError(msg);
    } finally {
      setResolving(false);
    }
  }, [workoutId, matchedActivityId, onAnalysisUpdated]);

  if (!matchedActivityId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        Link a Garmin activity to see your splits.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-violet-300 bg-violet-50/60 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-violet-900">Your splits</p>

      {available ? (
        <>
          <p className="mt-2 text-sm text-violet-950">
            Prescribed vs actual pace for each lap.
          </p>
          <ul className="mt-4 space-y-3">
            {laps.map((lap) => (
              <SplitBar key={`${lap.segmentId}-${lap.lapIndex}`} lap={lap} />
            ))}
          </ul>
        </>
      ) : (
        <>
          {(current?.paceForPaceError ?? current?.completionOnlyMessage) ? (
            <p className="mt-3 text-sm text-amber-900">
              {current?.paceForPaceError ?? current?.completionOnlyMessage}
            </p>
          ) : (
            <p className="mt-3 text-sm text-violet-900">
              Splits have not been generated for this run yet.
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
              {resolving ? "Analyzing…" : "Look at my metrics"}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
