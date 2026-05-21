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
                Recent logged work and pace analysis from your synced runs. For today&apos;s plan, open{" "}
                <Link href="/training" className="font-medium text-orange-600 hover:text-orange-700">
                  Train
                </Link>
                .
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

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setLastRun(null);
    setFallbackActivityRow(null);
    setRecentActivities([]);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();

      const [lastRunRes, activitiesRes] = await Promise.all([
        fetch("/api/me/last-logged-workout", { headers: athleteBearerFetchHeaders(token) }),
        fetch("/api/activities?limit=5", { headers: athleteBearerFetchHeaders(token) }),
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
    } finally {
      setLoading(false);
    }
  }, []);

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
        </>
      ) : null}
    </div>
  );
}
