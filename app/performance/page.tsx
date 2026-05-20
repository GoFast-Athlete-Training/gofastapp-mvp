"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import { auth } from "@/lib/firebase";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { onAuthStateChanged } from "firebase/auth";
import AnalysisDeepPanel from "@/components/training/AnalysisDeepPanel";
import {
  type ActivitySummaryRow,
  fallbackActivityToSummaryRow,
  LastActivityFallbackPanel,
  type LastLoggedWorkout,
  LastRunPanel,
  LastRunPanelSkeleton,
  RunHistoryPanel,
} from "@/components/workouts/workout-hub-panels";
import { formatPlanDateDisplay } from "@/lib/training/plan-utils";
import { metersToMiDisplay } from "@/lib/training/workout-preview-payload";

type PagedWorkoutRow = {
  id: string;
  title: string;
  workoutType: string;
  date: string | null;
  matchedActivityId: string | null;
  estimatedDistanceInMeters: number | null;
  planId: string | null;
};

function workoutListDateLabel(date: string | null): string {
  if (date == null || !date.trim()) return "—";
  return formatPlanDateDisplay(date, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function PerformancePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Performance</h1>
              <p className="text-gray-600 leading-relaxed">
                Recent logged work and pace analysis. Open the full{" "}
                <Link href="/workouts" className="font-medium text-orange-600 hover:text-orange-700">
                  workout log
                </Link>{" "}
                for today&apos;s sessions;{" "}
                <Link href="/training" className="font-medium text-orange-600 hover:text-orange-700">
                  Plan
                </Link>{" "}
                for your calendar.
              </p>
            </div>
            <PerformanceHub />
          </div>
        </main>
      </div>
    </div>
  );
}

function PerformanceHub() {
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState<LastLoggedWorkout | null>(null);
  const [fallbackActivityRow, setFallbackActivityRow] = useState<ActivitySummaryRow | null>(null);
  const [recentActivities, setRecentActivities] = useState<ActivitySummaryRow[]>([]);
  const [workoutRows, setWorkoutRows] = useState<PagedWorkoutRow[]>([]);
  const [workoutOffset, setWorkoutOffset] = useState(0);
  const [workoutHasMore, setWorkoutHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 15;

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setLastRun(null);
    setFallbackActivityRow(null);
    setRecentActivities([]);
    setWorkoutRows([]);
    setWorkoutOffset(0);
    setWorkoutHasMore(false);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();

      const [lastRunRes, activitiesRes, workoutsRes] = await Promise.all([
        fetch("/api/me/last-logged-workout", { headers: athleteBearerFetchHeaders(token) }),
        fetch("/api/activities?limit=5", { headers: athleteBearerFetchHeaders(token) }),
        fetch(`/api/workouts?paged=1&limit=${pageSize}&offset=0`, {
          headers: athleteBearerFetchHeaders(token),
        }),
      ]);

      const lastJson = (await lastRunRes.json()) as {
        workout?: LastLoggedWorkout | null;
        fallbackActivity?: {
          id: string;
          activityName: string | null;
          activityType: string | null;
          startTime: string | null;
          distance: number | null;
          duration: number | null;
        } | null;
      };
      if (lastRunRes.ok && lastJson.workout?.id) {
        setLastRun(lastJson.workout);
        setFallbackActivityRow(null);
      } else if (lastRunRes.ok && lastJson.fallbackActivity?.id) {
        setLastRun(null);
        setFallbackActivityRow(fallbackActivityToSummaryRow(lastJson.fallbackActivity));
      } else {
        setLastRun(null);
        setFallbackActivityRow(null);
      }

      const actJson = (await activitiesRes.json()) as { activities?: ActivitySummaryRow[] };
      if (activitiesRes.ok && Array.isArray(actJson.activities)) {
        setRecentActivities(actJson.activities.slice(0, 5));
      }

      const wJson = (await workoutsRes.json()) as {
        workouts?: PagedWorkoutRow[];
        hasMore?: boolean;
      };
      if (workoutsRes.ok && Array.isArray(wJson.workouts)) {
        setWorkoutRows(wJson.workouts);
        setWorkoutOffset(wJson.workouts.length);
        setWorkoutHasMore(!!wJson.hasMore);
      }
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  const loadMoreWorkouts = useCallback(async () => {
    const u = auth.currentUser;
    if (!u || loadingMore || !workoutHasMore) return;
    setLoadingMore(true);
    try {
      const token = await u.getIdToken();
      const res = await fetch(
        `/api/workouts?paged=1&limit=${pageSize}&offset=${workoutOffset}`,
        { headers: athleteBearerFetchHeaders(token) }
      );
      const wJson = (await res.json()) as {
        workouts?: PagedWorkoutRow[];
        hasMore?: boolean;
      };
      if (res.ok && Array.isArray(wJson.workouts)) {
        setWorkoutRows((prev) => [...prev, ...wJson.workouts!]);
        setWorkoutOffset((o) => o + wJson.workouts!.length);
        setWorkoutHasMore(!!wJson.hasMore);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, workoutHasMore, workoutOffset, pageSize]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(!!user);
      if (!user) setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    void loadInitial();
  }, [authReady, loadInitial]);

  const fallbackForDisplay =
    !lastRun && fallbackActivityRow
      ? fallbackActivityRow
      : !lastRun && !fallbackActivityRow && recentActivities[0]
        ? recentActivities[0]
        : null;

  return (
    <div className="space-y-6">
      {!authReady ? (
        <p className="text-sm text-gray-500">Checking your session…</p>
      ) : null}

      {authReady && loading ? (
        <div className="space-y-6">
          <LastRunPanelSkeleton />
          <LastRunPanelSkeleton />
        </div>
      ) : null}

      {authReady && !loading ? (
        <>
          {lastRun ? (
            <LastRunPanel workout={lastRun}>
              <AnalysisDeepPanel workoutId={lastRun.id} />
            </LastRunPanel>
          ) : fallbackForDisplay ? (
            <LastActivityFallbackPanel row={fallbackForDisplay} />
          ) : (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Last run
              </h2>
              <p className="text-sm text-gray-600">
                No synced runs yet. After you connect Garmin and complete a workout, your last run
                and analysis show up here.
              </p>
              <Link
                href="/settings/garmin"
                className="mt-3 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700"
              >
                Garmin settings →
              </Link>
            </section>
          )}

          <RunHistoryPanel rows={recentActivities} />

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Recent workouts
              </h2>
              <Link
                href="/workouts"
                className="text-sm font-semibold text-orange-600 hover:text-orange-700"
              >
                Full log →
              </Link>
            </div>
            {workoutRows.length === 0 ? (
              <p className="text-sm text-gray-600">
                No saved workouts yet. Sessions you create from{" "}
                <Link href="/training" className="font-medium text-orange-600 hover:text-orange-700">
                  Plan
                </Link>{" "}
                or{" "}
                <Link
                  href="/build-a-run"
                  className="font-medium text-orange-600 hover:text-orange-700"
                >
                  Build a run
                </Link>{" "}
                show up here.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-gray-100">
                  {workoutRows.map((w) => {
                    const mi =
                      w.estimatedDistanceInMeters != null && w.estimatedDistanceInMeters > 0
                        ? metersToMiDisplay(w.estimatedDistanceInMeters)
                        : null;
                    const day = workoutListDateLabel(w.date);
                    return (
                      <li key={w.id}>
                        <Link
                          href={`/workouts/${w.id}`}
                          className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm hover:bg-gray-50/80 -mx-2 px-2 rounded-lg transition-colors"
                        >
                          <span className="font-medium text-gray-900 min-w-0">
                            {w.title?.trim() || "Workout"}
                            <span className="font-normal text-gray-500"> · {day}</span>
                            {w.workoutType ? (
                              <span className="font-normal text-gray-500">
                                {" "}
                                · {String(w.workoutType).toLowerCase()}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-gray-600 tabular-nums shrink-0 flex items-center gap-2">
                            {w.matchedActivityId ? (
                              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                Logged
                              </span>
                            ) : null}
                            {mi ? <span>{mi} planned</span> : null}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {workoutHasMore ? (
                  <button
                    type="button"
                    onClick={() => void loadMoreWorkouts()}
                    disabled={loadingMore}
                    className="mt-4 w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                ) : null}
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
