"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, MessageCircle, Trash2, Users } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import {
  currentTrainingWeekNumber,
  effectiveTrainingWeekCount,
  formatCalendarWeekRangeLabel,
  formatPlanDateDisplay,
  utcDateOnly,
  ymdFromDate,
} from "@/lib/training/plan-utils";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import {
  fetchTrainingPlanDetail,
  fetchPlanWeekSchedule,
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

function effectiveWeeksForPlanHub(p: PlanDetailHub): number {
  return effectiveTrainingWeekCount(
    new Date(p.startDate),
    p.totalWeeks,
    p.race_registry?.raceDate ? new Date(p.race_registry.raceDate) : null
  );
}

function planDayMilesDisplay(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return "—";
  const mi = meters / 1609.34;
  if (mi >= 10) return `${Math.round(mi)} mi`;
  return `${mi.toFixed(1)} mi`;
}

export default function TrainingHubPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [planDetail, setPlanDetail] = useState<PlanDetailHub | null>(null);
  const [athleteFiveKPace, setAthleteFiveKPace] = useState<string | null>(null);
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekDays, setWeekDays] = useState<PlanDayCard[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);

  const paceDisplay = useMemo(() => {
    if (!planDetail) return null;
    const p = planDetail.currentFiveKPace?.trim() || athleteFiveKPace?.trim();
    return p || null;
  }, [planDetail, athleteFiveKPace]);

  const effectiveTotalWeeks = useMemo(
    () => (planDetail ? effectiveWeeksForPlanHub(planDetail) : 1),
    [planDetail]
  );

  const calendarRangeLabel = useMemo(() => {
    if (!planDetail) return "";
    return formatCalendarWeekRangeLabel(planDetail.startDate, weekNumber, {
      raceDate: planDetail.race_registry?.raceDate ?? null,
      totalWeeks: effectiveTotalWeeks,
    });
  }, [planDetail, weekNumber, effectiveTotalWeeks]);

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
        headers: athleteBearerFetchHeaders(token),
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
        const wn = currentTrainingWeekNumber(
          plan.startDate,
          effectiveWeeksForPlanHub(plan)
        );
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

  function openPlanDay(day: PlanDayCard) {
    router.push(`/training/day/${day.dateKey}`);
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
        headers: athleteBearerFetchHeaders(token),
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

  const todayKey = ymdFromDate(utcDateOnly(new Date()));
  const todayPlanDay = weekDays.find((d) => d.dateKey === todayKey) ?? null;

  return (
    <AthleteAppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Training</h1>
          <p className="text-gray-600">
            Today&apos;s run, your week, and tools — Go Train for logging and standalone workouts.
          </p>
        </div>

        {loading && (
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
            {/* Today's run — hero */}
            {!loadingWeek && (
              <div className="rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-900">
                  Today&apos;s run
                </p>
                {todayPlanDay ? (
                  <>
                    <h2 className="mt-2 text-2xl font-bold text-gray-900">
                      {displayWorkoutListTitle(todayPlanDay)}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {formatPlanDateDisplay(todayPlanDay.dateKey || String(todayPlanDay.date), {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                      {todayPlanDay.matchedActivityId ? (
                        <span className="ml-2 font-semibold text-emerald-700">· Done</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 tabular-nums">
                      Planned: {planDayMilesDisplay(todayPlanDay.estimatedDistanceInMeters)}
                    </p>
                    <Link
                      href={`/training/day/${todayPlanDay.dateKey}`}
                      className="mt-5 inline-flex justify-center rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-700"
                    >
                      Open today&apos;s session
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                      No session on the schedule for today
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Check this week below, or log a standalone workout.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href="/workouts"
                        className="inline-flex justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
                      >
                        Go Train
                      </Link>
                      <Link
                        href="/workouts/create"
                        className="inline-flex justify-center rounded-xl border-2 border-orange-300 bg-white px-5 py-2.5 text-sm font-semibold text-orange-900 hover:bg-orange-50"
                      >
                        Log a workout
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}

            {!loadingWeek && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Last run &amp; analysis
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  See your last synced run, recent Garmin history, and how you did vs plan targets on
                  Go Train.
                </p>
                <Link
                  href="/workouts"
                  className="mt-3 inline-flex justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-orange-700 ring-1 ring-orange-200 hover:bg-orange-50"
                >
                  Open Go Train →
                </Link>
              </div>
            )}

            {loadingWeek && (
              <p className="text-sm text-gray-500 mb-2">Loading today &amp; this week…</p>
            )}

            {/* Hub: AI Coach, Journal, Pod */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                More in training
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link
                  href="/ask-coach"
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:bg-orange-50/40 transition flex flex-col gap-2"
                >
                  <MessageCircle className="h-6 w-6 text-orange-600 shrink-0" aria-hidden />
                  <span className="font-semibold text-gray-900">AI Coach</span>
                  <span className="text-xs text-gray-600">Questions about your plan or pacing</span>
                </Link>
                <Link
                  href="/journal"
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:bg-orange-50/40 transition flex flex-col gap-2"
                >
                  <BookOpen className="h-6 w-6 text-orange-600 shrink-0" aria-hidden />
                  <span className="font-semibold text-gray-900">Training journal</span>
                  <span className="text-xs text-gray-600">Notes and how training feels</span>
                </Link>
                <Link
                  href="/my-runcrews"
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:bg-orange-50/40 transition flex flex-col gap-2"
                >
                  <Users className="h-6 w-6 text-orange-600 shrink-0" aria-hidden />
                  <span className="font-semibold text-gray-900">Training pod</span>
                  <span className="text-xs text-gray-600">Your crew and accountability</span>
                </Link>
              </div>
            </div>

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
                    Week {weekNumber} of {effectiveTotalWeeks}
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
                        onClick={() => openPlanDay(w)}
                        className="grid w-full grid-cols-[3.25rem_1fr_minmax(0,5rem)] sm:grid-cols-[3.5rem_1fr_minmax(0,5.5rem)] items-center gap-2 sm:gap-3 rounded-lg border border-gray-100 px-3 py-2.5 text-sm text-left hover:border-orange-200 hover:bg-orange-50/40 transition"
                      >
                        <span className="font-semibold text-gray-500 tabular-nums shrink-0">
                          {formatPlanDateDisplay(w.dateKey || String(w.date), {
                            weekday: "short",
                          })}
                        </span>
                        <span className="font-medium text-gray-900 min-w-0 truncate">
                          {displayWorkoutListTitle(w)}
                          {w.matchedActivityId ? (
                            <span className="ml-2 text-emerald-700 font-medium whitespace-nowrap">
                              Done
                            </span>
                          ) : null}
                        </span>
                        <span className="text-gray-600 text-right tabular-nums text-xs sm:text-sm shrink-0">
                          {planDayMilesDisplay(w.estimatedDistanceInMeters)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {authReady && !loading && !showDashboard && (
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              More in training
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/ask-coach"
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:bg-orange-50/40 transition flex flex-col gap-2"
              >
                <MessageCircle className="h-6 w-6 text-orange-600 shrink-0" aria-hidden />
                <span className="font-semibold text-gray-900">AI Coach</span>
                <span className="text-xs text-gray-600">Questions about your plan or pacing</span>
              </Link>
              <Link
                href="/journal"
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:bg-orange-50/40 transition flex flex-col gap-2"
              >
                <BookOpen className="h-6 w-6 text-orange-600 shrink-0" aria-hidden />
                <span className="font-semibold text-gray-900">Training journal</span>
                <span className="text-xs text-gray-600">Notes and how training feels</span>
              </Link>
              <Link
                href="/my-runcrews"
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:bg-orange-50/40 transition flex flex-col gap-2"
              >
                <Users className="h-6 w-6 text-orange-600 shrink-0" aria-hidden />
                <span className="font-semibold text-gray-900">Training pod</span>
                <span className="text-xs text-gray-600">Your crew and accountability</span>
              </Link>
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
              <Link href="/build-a-run" className="text-orange-600 hover:text-orange-700 font-medium">
                Build a run
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
