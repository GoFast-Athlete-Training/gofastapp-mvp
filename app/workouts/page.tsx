"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import {
  currentTrainingWeekNumber,
  formatPlanDateDisplay,
  ymdFromDate,
} from "@/lib/training/plan-utils";
import {
  fetchPlanWeekSchedule,
  fetchTrainingPlanDetail,
  resolveWorkoutForPlanDay,
  type PlanDayCard,
} from "@/lib/training/fetch-plan-week-client";
import { workoutDetailPathWithGoTrainContext } from "@/lib/training/workout-nav-query";

type PlanListEntry = { id: string };

export default function WorkoutsPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Go Train</h1>
              <p className="text-gray-600 leading-relaxed">
                This is your hub for executing workouts. Open a session to see structure, set it up
                on your watch, or invite others to join. Each workout opens as a{" "}
                <span className="font-medium text-gray-800">workout detail</span> page with segments
                and actions.
              </p>
              <p className="text-gray-600 mt-3">
                Today&apos;s plan is below. Your full calendar lives under{" "}
                <Link
                  href="/training"
                  className="font-medium text-orange-600 hover:text-orange-700"
                >
                  My Training
                </Link>
                . Need a one-off? Use{" "}
                <Link
                  href="/build-a-run"
                  className="font-medium text-orange-600 hover:text-orange-700"
                >
                  Build a Run
                </Link>
                .
              </p>
            </div>

            <TodaysPlanWorkout />
          </div>
        </main>
      </div>
    </div>
  );
}

function TodaysPlanWorkout() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayCard, setTodayCard] = useState<PlanDayCard | null>(null);
  const [hasActiveSchedule, setHasActiveSchedule] = useState<boolean | null>(
    null
  );
  const [planId, setPlanId] = useState<string | null>(null);
  const [currentWeekNumber, setCurrentWeekNumber] = useState<number | null>(null);
  const [totalWeeks, setTotalWeeks] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);

  const todayKey = useMemo(() => ymdFromDate(new Date()), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTodayCard(null);
    setHasActiveSchedule(null);
    setPlanId(null);
    setCurrentWeekNumber(null);
    setTotalWeeks(null);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const listRes = await fetch("/api/training-plan?status=active", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const listData = (await listRes.json()) as { plans?: PlanListEntry[] };
      if (
        !listRes.ok ||
        !Array.isArray(listData.plans) ||
        listData.plans.length === 0
      ) {
        setHasActiveSchedule(false);
        return;
      }
      const id = listData.plans[0].id;
      setPlanId(id);
      const { plan } = await fetchTrainingPlanDetail(id, token);
      const p = plan as {
        planWeeks?: unknown;
        startDate: string;
        totalWeeks: number;
      };
      setTotalWeeks(
        typeof p.totalWeeks === "number" && Number.isFinite(p.totalWeeks)
          ? p.totalWeeks
          : null
      );
      const scheduled =
        Array.isArray(p.planWeeks) && (p.planWeeks as unknown[]).length > 0;
      if (!scheduled) {
        setHasActiveSchedule(false);
        return;
      }
      setHasActiveSchedule(true);
      const wn = currentTrainingWeekNumber(p.startDate, p.totalWeeks);
      setCurrentWeekNumber(wn);
      const { days } = await fetchPlanWeekSchedule(id, wn, token);
      const hit = days.find((d) => d.dateKey === todayKey) ?? null;
      setTodayCard(hit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load plan");
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(!!user);
      if (!user) setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    void load();
  }, [authReady, load]);

  async function openToday() {
    if (!planId || !todayCard) return;
    const u = auth.currentUser;
    if (!u) return;
    setOpening(true);
    setError(null);
    try {
      const token = await u.getIdToken();
      const wid =
        todayCard.workoutId ??
        (await resolveWorkoutForPlanDay(planId, todayCard.dateKey, token));
      router.push(
        workoutDetailPathWithGoTrainContext(wid, {
          back: "workouts",
          planId,
          weekNumber: currentWeekNumber ?? undefined,
          totalWeeks: totalWeeks ?? undefined,
          dateKey: todayCard.dateKey,
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open workout");
    } finally {
      setOpening(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Today&apos;s workout
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        From your training plan ·{" "}
        {formatPlanDateDisplay(todayKey, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
      </p>

      {!authReady && (
        <p className="text-sm text-gray-500">Checking your session…</p>
      )}
      {authReady && loading && (
        <p className="text-sm text-gray-500">Loading…</p>
      )}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {authReady && !loading && hasActiveSchedule === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5">
          <p className="text-sm text-amber-950/90 font-medium mb-3">
            You don&apos;t have an active plan with a schedule yet.
          </p>
          <Link
            href="/training-setup"
            className="inline-flex justify-center rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-800"
          >
            Develop a plan
          </Link>
        </div>
      )}
      {authReady && !loading && hasActiveSchedule === true && !todayCard && (
        <p className="text-sm text-gray-600">
          Nothing scheduled on your plan for today. For a custom run, open{" "}
          <Link
            href="/build-a-run"
            className="font-medium text-orange-600 hover:text-orange-700"
          >
            Build a Run
          </Link>
          .
        </p>
      )}
      {authReady && !loading && todayCard && (
        <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
          <p className="font-medium text-gray-900">
            {displayWorkoutListTitle(todayCard)}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {todayCard.workoutType}
            {todayCard.estimatedDistanceInMeters
              ? ` · ${(todayCard.estimatedDistanceInMeters / 1609.34).toFixed(1)} mi`
              : ""}
            {todayCard.matchedActivityId ? (
              <span className="ml-2 font-medium text-emerald-700">Logged</span>
            ) : null}
          </p>
          <button
            type="button"
            disabled={opening}
            onClick={() => void openToday()}
            className="mt-4 inline-flex justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {opening ? "Opening…" : "Open workout"}
          </button>
        </div>
      )}
    </section>
  );
}
