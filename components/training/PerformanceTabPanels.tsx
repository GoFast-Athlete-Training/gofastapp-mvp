"use client";

import { useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import type { PendingFiveKConfirmation } from "@/lib/training/performance-summary";

function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

export function PerformanceWeekSummary({
  weekPerformance,
  planName,
  weekNumber,
}: {
  weekPerformance: {
    sessionsCompleted: number;
    sessionsPlanned: number;
    sessionsMissed: number;
    sessionsSkipped: number;
    plannedMetersTotal: number;
    actualMetersMatched: number;
    weeklyMileageCompletionPct: number | null;
    longRunCompleted: boolean;
    longRunCompletionRatio: number | null;
    structuredPaceAvgDeltaSecPerMile: number | null;
  };
  planName: string | null;
  weekNumber: number | null;
}) {
  const wp = weekPerformance;
  return (
    <section className="rounded-xl border border-orange-100 bg-orange-50/60 px-5 py-4 mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
          This week
        </h2>
        {planName && weekNumber != null ? (
          <p className="text-xs text-gray-500">
            {planName} · Week {weekNumber}
          </p>
        ) : null}
      </div>
      <p className="font-semibold text-gray-900 tabular-nums">
        {wp.sessionsCompleted} of {wp.sessionsPlanned} sessions complete
        {wp.sessionsMissed > 0 ? ` · ${wp.sessionsMissed} missed` : ""}
        {wp.sessionsSkipped > 0 ? ` · ${wp.sessionsSkipped} skipped` : ""}
      </p>
      {wp.plannedMetersTotal > 0 ? (
        <p className="mt-1 tabular-nums text-sm text-gray-700">
          Volume: ~{(wp.actualMetersMatched / 1609.34).toFixed(1)} mi actual vs ~
          {(wp.plannedMetersTotal / 1609.34).toFixed(1)} mi planned
          {wp.weeklyMileageCompletionPct != null
            ? ` (${wp.weeklyMileageCompletionPct.toFixed(0)}% of planned)`
            : ""}
        </p>
      ) : null}
      {wp.longRunCompletionRatio != null ? (
        <p className="mt-1 text-sm text-gray-700">
          Long run:{" "}
          {wp.longRunCompleted
            ? `complete (${Math.round(wp.longRunCompletionRatio * 100)}% of planned)`
            : "not complete yet"}
        </p>
      ) : null}
      {wp.structuredPaceAvgDeltaSecPerMile != null ? (
        <p className="mt-1 text-sm text-gray-700">
          Structured pace avg:{" "}
          {wp.structuredPaceAvgDeltaSecPerMile <= 0 ? "on or ahead of plan" : "behind plan"} (
          {wp.structuredPaceAvgDeltaSecPerMile > 0 ? "+" : ""}
          {wp.structuredPaceAvgDeltaSecPerMile} sec/mi)
        </p>
      ) : (
        <p className="mt-1 text-sm text-gray-500">
          Structured pace comparison available after lap splits are analyzed.
        </p>
      )}
    </section>
  );
}

function PendingFiveKRow({
  item,
  onConfirmed,
}: {
  item: PendingFiveKConfirmation;
  onConfirmed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const suggestion = item.suggestion;

  async function confirm() {
    if (suggestion.suggestedFiveKSecPerMile == null) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.post<{ ok?: boolean; result?: { reason?: string } }>(
        `/training/workout/${item.workoutId}/confirm-five-k-pace`,
        { suggestedFiveKSecPerMile: suggestion.suggestedFiveKSecPerMile }
      );
      setMessage(res.data?.result?.reason ?? (res.data?.ok ? "5K updated." : "Could not update."));
      if (res.data?.ok) onConfirmed();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Could not update 5K pace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-emerald-200 bg-white px-4 py-3">
      <p className="text-sm font-medium text-gray-900">{item.title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{item.workoutType}</p>
      <p className="text-sm text-gray-700 mt-2">{suggestion.reason}</p>
      <p className="text-sm text-gray-800 mt-1">
        Suggested:{" "}
        <span className="font-semibold tabular-nums text-emerald-900">
          {formatSecPerMile(suggestion.suggestedFiveKSecPerMile) ?? "—"}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Updating…" : "Confirm 5K pace"}
        </button>
        <Link
          href={`/workouts/${item.workoutId}`}
          className="text-sm font-semibold text-emerald-800 hover:text-emerald-900"
        >
          See run →
        </Link>
      </div>
      {message ? <p className="mt-2 text-xs text-gray-600">{message}</p> : null}
    </li>
  );
}

export function PerformancePaceAnchors({
  currentFiveKPace,
  pendingFiveKConfirmations,
  onConfirmed,
}: {
  currentFiveKPace: string | null;
  pendingFiveKConfirmations: PendingFiveKConfirmation[];
  onConfirmed: () => void;
}) {
  if (!currentFiveKPace && pendingFiveKConfirmations.length === 0) return null;

  return (
    <section className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-5 py-4 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-2">
        Pace anchors
      </h2>
      {currentFiveKPace ? (
        <p className="text-sm text-gray-800">
          Current 5K: <span className="font-semibold tabular-nums">{currentFiveKPace}</span>
        </p>
      ) : (
        <p className="text-sm text-gray-600">Set a 5K pace in your profile to unlock speed updates.</p>
      )}
      {pendingFiveKConfirmations.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Pending confirmation
          </p>
          <ul className="space-y-3">
            {pendingFiveKConfirmations.map((item) => (
              <PendingFiveKRow key={item.workoutId} item={item} onConfirmed={onConfirmed} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
