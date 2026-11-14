"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { RacePlanCloseOutCard } from "@/components/training/RacePlanCloseOutCard";
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
  inRaceCloseOut?: boolean;
};

function PerformancePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weeklyReview = searchParams.get("weeklyReview") === "1";
  const whereYouStandRef = useRef<HTMLDivElement | null>(null);
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
    if (!weeklyReview || loading) return;
    const t = window.setTimeout(() => {
      whereYouStandRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [weeklyReview, loading, summary]);

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
            Your current training week, plan sessions, and fitness anchors — confirm or edit
            your numbers.
          </p>
          {weeklyReview ? (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-950">
              Confirm your paces so we build next week&apos;s training correctly — especially your
              5K anchor.
            </p>
          ) : null}
        </div>

        {loading && !authReady ? (
          <p className="text-gray-500">Loading…</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <>
            {summary?.inRaceCloseOut && summary.planId ? (
              <RacePlanCloseOutCard
                planId={summary.planId}
                className="mb-6"
                onArchived={() => void load()}
              />
            ) : null}

            {!summary?.inRaceCloseOut &&
            summary?.weekPerformance &&
            summary.weekPerformance.sessionsPlanned > 0 ? (
              <PerformanceWeekSummary
                weekPerformance={summary.weekPerformance}
                planName={summary.planName}
                weekNumber={summary.weekNumber}
              />
            ) : summary?.planId && !summary.inRaceCloseOut ? (
              <section className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 mb-6 text-sm text-gray-600">
                No scheduled sessions this week yet.
              </section>
            ) : !summary?.planId ? (
              <section className="rounded-xl border border-gray-200 bg-white px-5 py-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Ready to start training again?</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Pick your next race and build a plan — your finished builds live in training history.
                </p>
                <Link
                  href="/races"
                  className="mt-4 inline-flex rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  Find another race
                </Link>
              </section>
            ) : null}

            {!summary?.inRaceCloseOut && summary?.weekDays && summary.weekDays.length > 0 ? (
              <PerformanceWeekPlan
                weekDays={summary.weekDays}
                onOpenWorkout={(id) => router.push(`/workouts/${id}`)}
              />
            ) : null}

            {!summary?.inRaceCloseOut && summary?.whereYouStand ? (
              <div ref={whereYouStandRef}>
                <WhereYouStandPanel
                  stand={summary.whereYouStand}
                  planId={summary.planId}
                  weekNumber={summary.weekNumber}
                  onConfirmed={() => void load()}
                />
              </div>
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

export default function PerformancePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500">Loading…</p>
        </div>
      }
    >
      <PerformancePageContent />
    </Suspense>
  );
}
