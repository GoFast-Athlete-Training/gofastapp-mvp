"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import {
  currentTrainingWeekNumber,
  formatCalendarWeekRangeLabel,
  formatPlanDateDisplay,
} from "@/lib/training/plan-utils";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import {
  fetchTrainingPlanDetail,
  fetchPlanWeekSchedule,
  resolveWorkoutForPlanDay,
  type PlanDayCard,
} from "@/lib/training/fetch-plan-week-client";

type PlanDetailHub = {
  id: string;
  name: string;
  totalWeeks: number;
  startDate: string;
  planWeeks: unknown;
  currentFiveKPace?: string | null;
  _count?: { planned_workouts: number };
  race_registry: { name: string; raceDate?: string } | null;
};

function hasSchedule(p: PlanDetailHub): boolean {
  return Array.isArray(p.planWeeks) && (p.planWeeks as unknown[]).length > 0;
}

export default function TrainingHubPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [planDetail, setPlanDetail] = useState<PlanDetailHub | null>(null);
  const [athleteFiveKPace, setAthleteFiveKPace] = useState<string | null>(null);
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekDays, setWeekDays] = useState<PlanDayCard[]>([]);
  const [openingDayKey, setOpeningDayKey] = useState<string | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);

  const paceDisplay = useMemo(() => {
    if (!planDetail) return null;
    const p = planDetail.currentFiveKPace?.trim() || athleteFiveKPace?.trim();
    return p || null;
  }, [planDetail, athleteFiveKPace]);

  const calendarRangeLabel = useMemo(() => {
    if (!planDetail) return "";
    return formatCalendarWeekRangeLabel(planDetail.startDate, weekNumber);
  }, [planDetail, weekNumber]);

  const loadHub = useCallback(async () => {
    setLoading(true);
    setHubError(null);
    setPlanDetail(null);
    setWeekDays([]);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const listRes = await fetch("/api/training-plan?status=active", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const listData = await listRes.json();
      if (!listRes.ok || !Array.isArray(listData.plans) || listData.plans.length === 0) {
        return;
      }
      const planId = (listData.plans[0] as { id: string }).id;
      const { plan: raw, athleteFiveKPace: athPace } = await fetchTrainingPlanDetail(
        planId,
        token
      );
      const plan = raw as PlanDetailHub;
      setPlanDetail(plan);
      setAthleteFiveKPace(athPace);
      if (hasSchedule(plan)) {
        const wn = currentTrainingWeekNumber(plan.startDate, plan.totalWeeks);
        setWeekNumber(wn);
        setLoadingWeek(true);
        try {
          const { days } = await fetchPlanWeekSchedule(planId, wn, token);
          setWeekDays(days);
        } catch (e) {
          setHubError(e instanceof Error ? e.message : "Could not load this week");
          setWeekDays([]);
        } finally {
          setLoadingWeek(false);
        }
      }
    } catch (e) {
      setHubError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  async function openPlanDay(planIdForDay: string, day: PlanDayCard) {
    const u = auth.currentUser;
    if (!u) return;
    try {
      setOpeningDayKey(day.dateKey);
      const token = await u.getIdToken();
      const id =
        day.workoutId ??
        (await resolveWorkoutForPlanDay(planIdForDay, day.dateKey, token));
      router.push(`/workouts/${id}`);
    } catch (e) {
      setHubError(e instanceof Error ? e.message : "Could not open workout");
    } finally {
      setOpeningDayKey(null);
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAuthReady(false);
        router.replace("/welcome");
        return;
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!authReady) return;
    void loadHub();
  }, [authReady, loadHub]);

  async function deleteActivePlan() {
    if (!planDetail) return;
    if (
      !window.confirm(
        "Delete this training plan permanently? Workouts will stay on your log but won’t be tied to this plan."
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const res = await fetch(`/api/training-plan/${planDetail.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await loadHub();
      }
    } finally {
      setDeleting(false);
    }
  }

  const showDashboard = !!planDetail && hasSchedule(planDetail);
  const showIncompletePlan = !!planDetail && !hasSchedule(planDetail);

  return (
    <AthleteAppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Training</h1>
          <p className="text-gray-600">
            Your active plan and this week at a glance. Go Train for logging and standalone
            workouts.
          </p>
        </div>

        {authReady && loading && (
          <p className="mb-6 text-sm text-gray-500">Loading your training…</p>
        )}

        {hubError && (
          <p className="mb-4 text-sm text-red-600" role="alert">
            {hubError}
          </p>
        )}

        {authReady && !loading && !planDetail && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No active plan yet</h2>
            <p className="text-sm text-gray-600 mb-6">
              Start a plan from your race goal, or log a workout without a full schedule.
            </p>
            <Link
              href="/training-setup"
              className="inline-flex justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Start or connect a plan
            </Link>
          </div>
        )}

        {showIncompletePlan && planDetail && (
          <div className="mb-8 rounded-2xl border-2 border-amber-200 bg-amber-50/90 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Finish your plan
            </p>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">{planDetail.name}</h2>
            {planDetail.race_registry?.name && (
              <p className="mt-1 text-sm text-gray-600">{planDetail.race_registry.name}</p>
            )}
            <p className="mt-3 text-sm text-amber-950/90">
              Generate your schedule in setup to see workouts here each week.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/training-setup/${planDetail.id}`}
                className="inline-flex justify-center rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-800"
              >
                Continue plan setup
              </Link>
            </div>
          </div>
        )}

        {showDashboard && planDetail && (
          <div className="space-y-6 mb-8">
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/80 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    Active plan
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-gray-900">{planDetail.name}</h2>
                  {planDetail.race_registry?.name && (
                    <p className="mt-1 text-sm text-gray-600">{planDetail.race_registry.name}</p>
                  )}
                  <p className="mt-3 text-base font-semibold text-gray-900">
                    Week {weekNumber} of {planDetail.totalWeeks}
                  </p>
                  {calendarRangeLabel && (
                    <p className="mt-1 text-sm text-gray-600">Calendar week: {calendarRangeLabel}</p>
                  )}
                  {paceDisplay && (
                    <p className="mt-2 text-sm text-emerald-900/90">
                      Current 5K pace (plan): <span className="font-mono">{paceDisplay}</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <Link
                    href={`/training-setup/${planDetail.id}`}
                    className="inline-flex justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Open plan calendar
                  </Link>
                  <Link
                    href={`/training-setup/${planDetail.id}`}
                    className="inline-flex justify-center text-sm font-medium text-emerald-800 hover:text-emerald-950 underline-offset-2 hover:underline"
                  >
                    Update plan (goal, mileage, setup)
                  </Link>
                  <Link
                    href="/workouts"
                    className="inline-flex justify-center rounded-xl border-2 border-emerald-600 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                  >
                    Go Train
                  </Link>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void deleteActivePlan()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {deleting ? "Deleting…" : "Delete plan"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                This week
              </p>
              {loadingWeek && (
                <p className="text-sm text-gray-500">Loading workouts…</p>
              )}
              {!loadingWeek && weekDays.length === 0 && (
                <p className="text-sm text-gray-600">No sessions this week in the schedule.</p>
              )}
              {!loadingWeek && weekDays.length > 0 && (
                <ul className="space-y-2">
                  {weekDays.map((w) => (
                    <li key={w.dateKey}>
                      <button
                        type="button"
                        disabled={openingDayKey === w.dateKey}
                        onClick={() => {
                          if (!planDetail) return;
                          void openPlanDay(planDetail.id, w);
                        }}
                        className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-gray-100 px-3 py-2.5 text-sm text-left hover:border-orange-200 hover:bg-orange-50/40 transition disabled:opacity-50"
                      >
                        <span className="font-medium text-gray-900">
                          {displayWorkoutListTitle(w)}
                        </span>
                        <span className="text-gray-500 text-right">
                          {w.date
                            ? formatPlanDateDisplay(w.date, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                          {w.matchedActivityId ? (
                            <span className="ml-2 text-emerald-700 font-medium">Done</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-5 text-sm text-gray-600">
          <p className="font-medium text-gray-800 mb-2">More</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link href="/training-setup" className="text-orange-600 hover:text-orange-700 font-medium">
                {planDetail ? "Create or replace a plan" : "Plan setup"}
              </Link>
            </li>
            <li>
              <Link href="/workouts/create" className="text-orange-600 hover:text-orange-700 font-medium">
                Create a workout
              </Link>
            </li>
            <li>
              <Link href="/workouts" className="text-gray-700 hover:text-gray-900 font-medium">
                All workouts (Go Train)
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </AthleteAppShell>
  );
}
