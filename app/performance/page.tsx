"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import { PerformanceWeekSummary } from "@/components/training/PerformanceTabPanels";
import {
  PerformanceWeekPlan,
  WhereYouStandPanel,
} from "@/components/training/WhereYouStandPanel";
import type { PerformanceSummary } from "@/lib/training/performance-summary";
import type { WeekPerformanceSnapshot } from "@/lib/training/week-performance-types";
import type { WhereYouStandSnapshot } from "@/lib/training/where-you-stand";

type PerformanceSummaryResponse = {
  planId: string | null;
  planName: string | null;
  weekNumber: number | null;
  weekPerformance: WeekPerformanceSnapshot | null;
  weekDays: PerformanceSummary["weekDays"];
  whereYouStand: WhereYouStandSnapshot | null;
  currentFiveKPace: string | null;
};

export default function PerformancePage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PerformanceSummaryResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryRes = await api.get<PerformanceSummaryResponse>("/performance/summary");
      setSummary(summaryRes.data ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load performance");
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
            This week&apos;s plan and where you stand — confirm or edit your numbers.
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

            {summary?.weekDays && summary.weekDays.length > 0 ? (
              <PerformanceWeekPlan
                weekDays={summary.weekDays}
                onOpenWorkout={(id) => router.push(`/workouts/${id}`)}
              />
            ) : null}

            {summary?.whereYouStand ? (
              <WhereYouStandPanel
                stand={summary.whereYouStand}
                planId={summary.planId}
                weekNumber={summary.weekNumber}
                onConfirmed={() => void load()}
              />
            ) : null}

            <Link
              href="/activities"
              className="inline-block text-sm font-semibold text-orange-700 hover:text-orange-800"
            >
              Your activities →
            </Link>
          </>
        )}
      </div>
    </AthleteAppShell>
  );
}
