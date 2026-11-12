"use client";

import { WeekMileageBar } from "@/components/training/WeekMileageBar";

const MI_PER_M = 1609.34;

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
        <div className="mt-3">
          <WeekMileageBar
            variant="progress"
            actualMiles={wp.actualMetersMatched / MI_PER_M}
            plannedMiles={wp.plannedMetersTotal / MI_PER_M}
          />
        </div>
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
      ) : null}
    </section>
  );
}
