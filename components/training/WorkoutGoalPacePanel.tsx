"use client";

import { useState } from "react";
import api from "@/lib/api";
import { formatPaceTargetRangeDisplay } from "@/lib/training/pace-comparison-display";
import {
  tempoGoalThresholdInterpretationLabel,
  type TempoPrescriptionGoalBenchmark,
} from "@/lib/training/goal-threshold-from-mp";
import type { WorkoutPerformanceSignals } from "@/lib/training/workout-pace-performance";

function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

export function TempoGoalBenchmarkPanel({
  benchmark,
  goalRacePaceSecPerMile,
}: {
  benchmark: TempoPrescriptionGoalBenchmark | null | undefined;
  goalRacePaceSecPerMile?: number | null;
}) {
  const goalMp = benchmark?.goalRacePaceSecPerMile ?? goalRacePaceSecPerMile ?? null;
  if (!benchmark && goalMp == null) return null;

  const prescribed = benchmark?.prescribedTempoPaceSecPerMile ?? null;
  const goalT = benchmark?.goalThresholdPaceSecPerMile ?? null;
  const label = tempoGoalThresholdInterpretationLabel(benchmark?.interpretation ?? null);

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-5 mb-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Goal pace context</h2>
      <p className="text-sm text-gray-600 mb-3">
        Today&apos;s tempo comes from your 5K anchor. Goal threshold shows whether that prescription
        is buying down toward race T.
      </p>
      <dl className="grid gap-2 text-sm">
        {prescribed != null ? (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Prescribed tempo</dt>
            <dd className="font-medium tabular-nums text-gray-900">
              {formatPaceTargetRangeDisplay(prescribed, prescribed) ?? formatSecPerMile(prescribed)}
            </dd>
          </div>
        ) : null}
        {goalMp != null ? (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Goal race pace (MP)</dt>
            <dd className="font-medium tabular-nums text-gray-900">
              {formatPaceTargetRangeDisplay(goalMp, goalMp) ?? formatSecPerMile(goalMp)}
            </dd>
          </div>
        ) : null}
        {goalT != null ? (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Goal threshold (from MP)</dt>
            <dd className="font-medium tabular-nums text-gray-900">
              {formatPaceTargetRangeDisplay(goalT, goalT) ?? formatSecPerMile(goalT)}
            </dd>
          </div>
        ) : null}
      </dl>
      {label ? (
        <p className="mt-3 text-sm text-indigo-950 rounded-md border border-indigo-100 bg-white/70 px-3 py-2">
          {label}
        </p>
      ) : null}
    </section>
  );
}

export function WorkoutFiveKConfirmPanel({
  workoutId,
  performanceSignals,
  onConfirmed,
}: {
  workoutId: string;
  performanceSignals: WorkoutPerformanceSignals | null | undefined;
  onConfirmed?: () => void;
}) {
  const suggestion = performanceSignals?.fiveKSuggestion;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!suggestion?.eligible || suggestion.suggestedFiveKSecPerMile == null) {
    return null;
  }

  async function confirm() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.post<{ ok?: boolean; result?: { reason?: string } }>(
        `/training/workout/${workoutId}/confirm-five-k-pace`,
        { suggestedFiveKSecPerMile: suggestion!.suggestedFiveKSecPerMile }
      );
      setMessage(res.data?.result?.reason ?? (res.data?.ok ? "5K updated." : "Could not update."));
      if (res.data?.ok) onConfirmed?.();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Could not update 5K pace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-5 mb-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">5K pace signal</h2>
      <p className="text-sm text-gray-700 mb-3">{suggestion.reason}</p>
      <p className="text-sm text-gray-800">
        Current 5K:{" "}
        <span className="font-semibold tabular-nums">
          {formatSecPerMile(suggestion.currentFiveKSecPerMile) ?? "—"}
        </span>
        {" · "}
        Suggested:{" "}
        <span className="font-semibold tabular-nums text-emerald-900">
          {formatSecPerMile(suggestion.suggestedFiveKSecPerMile) ?? "—"}
        </span>
      </p>
      <button
        type="button"
        onClick={() => void confirm()}
        disabled={busy}
        className="mt-4 inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {busy ? "Updating…" : "Update my 5K pace"}
      </button>
      {message ? <p className="mt-2 text-sm text-gray-700">{message}</p> : null}
    </section>
  );
}
