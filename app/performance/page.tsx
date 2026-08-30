"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import {
  PerformancePaceAnchors,
  PerformanceWeekSummary,
} from "@/components/training/PerformanceTabPanels";
import type { PendingFiveKConfirmation } from "@/lib/training/performance-summary";
import type { WeekPerformanceSnapshot } from "@/lib/training/week-performance-types";

type HistoryItem = {
  id: string;
  title: string;
  date: string | null;
  workoutType: string;
  actualAvgPaceSecPerMile: number | null;
  actualDistanceMeters: number | null;
  actualDurationSeconds: number | null;
  paceDeltaSecPerMile: number | null;
  vsPlanBadge: string | null;
  vsPlanMessage: string | null;
  prescribedPaceDisplay: string | null;
  hasLapDeltas: boolean;
  segmentComparisonCount: number;
  paceForPaceStatus: string | null;
  paceForPaceStatusLabel?: string | null;
  executionHeadline: string | null;
  executionSummary: string | null;
  executionStatus: string | null;
  executionStatusLabel: string | null;
  executionStatusReason: string | null;
  canCompareWholeRun: boolean;
  canCompareSegments: boolean;
  canCompare: boolean;
  hasSegmentComparison: boolean;
  hasExecutionAnalysis: boolean;
  hasPerformanceAnalysis: boolean;
};

type PerformanceSummaryResponse = {
  planId: string | null;
  planName: string | null;
  weekNumber: number | null;
  weekPerformance: WeekPerformanceSnapshot | null;
  currentFiveKPace: string | null;
  pendingFiveKConfirmations: PendingFiveKConfirmation[];
};

function formatPace(secPerMile: number | null): string {
  if (secPerMile == null || !Number.isFinite(secPerMile)) return "—";
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDistance(meters: number | null): string {
  if (meters == null || meters <= 0) return "—";
  return `${(meters / 1609.34).toFixed(2)} mi`;
}

function formatDuration(sec: number | null): string {
  if (sec == null || sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function paceForPaceStatusLabel(status: string | null): string {
  switch (status) {
    case "ready":
      return "Splits ready";
    case "needs_laps":
      return "Needs lap data";
    case "needs_analysis":
      return "Run analysis";
    default:
      return status ?? "—";
  }
}

export default function PerformancePage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [summary, setSummary] = useState<PerformanceSummaryResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [historyRes, summaryRes] = await Promise.all([
        api.get<{ items?: HistoryItem[] }>("/performance/history"),
        api.get<PerformanceSummaryResponse>("/performance/summary"),
      ]);
      setItems(Array.isArray(historyRes.data?.items) ? historyRes.data.items : []);
      setSummary(summaryRes.data ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load performance");
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      if (!user) {
        router.replace("/signup");
        return;
      }
      void load();
    });
    return () => unsub();
  }, [load, router]);

  return (
    <AthleteAppShell>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
          <p className="text-sm text-gray-600 mt-1">
            Weekly rollup and recent runs — tap a row to see your workout.
          </p>
        </div>

        {loading && !authReady ? (
          <p className="text-gray-500">Loading…</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <>
            {summary?.weekPerformance && summary.weekPerformance.sessionsPlanned > 0 ? (
              <PerformanceWeekSummary
                weekPerformance={summary.weekPerformance}
                planName={summary.planName}
                weekNumber={summary.weekNumber}
              />
            ) : summary?.planId ? (
              <section className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 mb-6 text-sm text-gray-600">
                No scheduled sessions this week yet.
              </section>
            ) : null}

            <PerformancePaceAnchors
              currentFiveKPace={summary?.currentFiveKPace ?? null}
              pendingFiveKConfirmations={summary?.pendingFiveKConfirmations ?? []}
              onConfirmed={() => void load()}
            />

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-3">
                Recent runs
              </h2>
              {items.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No matched workouts yet. Complete a planned run and sync Garmin to see history
                  here.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Workout</th>
                        <th className="px-4 py-3">Actual pace</th>
                        <th className="px-4 py-3">Splits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-orange-50/50 cursor-pointer"
                          onClick={() => router.push(`/workouts/${item.id}`)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                            {formatDate(item.date)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{item.title}</p>
                            <p className="text-xs text-gray-500">
                              {item.workoutType}
                              {item.actualDistanceMeters != null
                                ? ` · ${formatDistance(item.actualDistanceMeters)}`
                                : ""}
                              {item.actualDurationSeconds != null
                                ? ` · ${formatDuration(item.actualDurationSeconds)}`
                                : ""}
                            </p>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-gray-800">
                            {formatPace(item.actualAvgPaceSecPerMile)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {item.vsPlanMessage ??
                              (item.hasLapDeltas
                                ? `${item.segmentComparisonCount} lap${item.segmentComparisonCount === 1 ? "" : "s"} compared`
                                : paceForPaceStatusLabel(item.paceForPaceStatus))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-gray-500">
                Need lap splits? Open a run and use &ldquo;Look at my metrics&rdquo; on the workout
                page.
              </p>
              <Link
                href="/activities"
                className="mt-4 inline-block text-sm font-semibold text-orange-700 hover:text-orange-800"
              >
                All activities →
              </Link>
            </section>
          </>
        )}
      </div>
    </AthleteAppShell>
  );
}
