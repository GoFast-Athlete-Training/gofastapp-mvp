"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import {
  addDaysUtc,
  formatPlanDateDisplay,
  localYmd,
  trainingWeekNumberForDateKey,
  utcDateOnly,
} from "@/lib/training/plan-utils";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import {
  fetchTrainingPlanDetail,
  fetchPlanWeekSchedule,
  fetchTrainingWorkoutDetail,
  resolveWorkoutForPlanDay,
  type PlanDayCard,
} from "@/lib/training/fetch-plan-week-client";
import {
  metersToMiDisplay,
  pickWorkoutPayload,
  type PreviewWorkout,
} from "@/lib/training/workout-preview-payload";
import {
  workoutDetailPathWithBackHref,
} from "@/lib/training/workout-nav-query";

type PlanDetail = {
  id: string;
  name: string;
  totalWeeks: number;
  startDate: string;
  planWeeks: unknown;
};

function hasSchedule(p: PlanDetail): boolean {
  return Array.isArray(p.planWeeks) && (p.planWeeks as unknown[]).length > 0;
}

function normalizeDateKey(raw: string): string | null {
  const t = decodeURIComponent(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

function dateKeyToUtcOnly(dateKey: string): Date {
  return utcDateOnly(new Date(`${dateKey}T12:00:00Z`));
}

function shiftDateKey(dateKey: string, deltaDays: number): string | null {
  try {
    const d = dateKeyToUtcOnly(dateKey);
    const next = addDaysUtc(d, deltaDays);
    const y = next.getUTCFullYear();
    const m = String(next.getUTCMonth() + 1).padStart(2, "0");
    const day = String(next.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return null;
  }
}

export default function TrainingPlanDayPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawDateKey = params.dateKey as string;
  const dateKey = normalizeDateKey(rawDateKey);

  const planIdFromQuery = searchParams.get("planId")?.trim() || null;
  const sourceSetup = searchParams.get("source") === "setup";

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planDetail, setPlanDetail] = useState<PlanDetail | null>(null);
  const [planDay, setPlanDay] = useState<PlanDayCard | null>(null);
  const [weekNumber, setWeekNumber] = useState(1);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<PreviewWorkout | null>(null);
  const [openingWorkout, setOpeningWorkout] = useState(false);

  const previewBackPath = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  const hubBackHref = sourceSetup && planDetail
    ? `/training-setup/${planDetail.id}`
    : "/training";
  const hubBackLabel = sourceSetup ? "Back to plan setup" : "Back to My Training";

  const prevDateKey = dateKey ? shiftDateKey(dateKey, -1) : null;
  const nextDateKey = dateKey ? shiftDateKey(dateKey, 1) : null;

  const querySuffix = useMemo(() => {
    const parts = new URLSearchParams();
    if (planIdFromQuery) parts.set("planId", planIdFromQuery);
    if (sourceSetup) parts.set("source", "setup");
    const s = parts.toString();
    return s ? `?${s}` : "";
  }, [planIdFromQuery, sourceSetup]);

  const load = useCallback(async () => {
    if (!dateKey) {
      setError("Invalid date");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setPlanDetail(null);
    setPlanDay(null);
    setWorkout(null);
    setWorkoutId(null);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Sign in required");
      const token = await u.getIdToken();

      let planId = planIdFromQuery;
      if (!planId) {
        const listRes = await fetch("/api/training-plan?status=active", {
          headers: athleteBearerFetchHeaders(token),
        });
        const listData = await listRes.json();
        if (!listRes.ok || !Array.isArray(listData.plans) || listData.plans.length === 0) {
          setError("No active training plan.");
          setLoading(false);
          return;
        }
        planId = (listData.plans[0] as { id: string }).id;
      }

      const { plan: raw } = await fetchTrainingPlanDetail(planId!, token);
      const plan = raw as PlanDetail;
      if (!hasSchedule(plan)) {
        setError("This plan has no schedule yet.");
        setLoading(false);
        return;
      }

      setPlanDetail(plan);
      const wn = trainingWeekNumberForDateKey(plan.startDate, plan.totalWeeks, dateKey);
      setWeekNumber(wn);
      const { days } = await fetchPlanWeekSchedule(plan.id, wn, token);
      const day = days.find((d) => d.dateKey === dateKey) ?? null;
      setPlanDay(day);

      if (day) {
        setWorkoutLoading(true);
        setWorkoutError(null);
        try {
          const wid =
            day.workoutId ?? (await resolveWorkoutForPlanDay(plan.id, day.dateKey, token));
          setWorkoutId(wid);
          const { workout: rawW } = await fetchTrainingWorkoutDetail(wid, token);
          setWorkout(pickWorkoutPayload(rawW));
        } catch (e) {
          setWorkoutError(e instanceof Error ? e.message : "Could not load workout");
        } finally {
          setWorkoutLoading(false);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [dateKey, planIdFromQuery]);

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
    if (!authReady || !dateKey) return;
    void load();
  }, [authReady, dateKey, load]);

  const title =
    workout?.title?.trim() || (planDay ? displayWorkoutListTitle(planDay) : "Workout");
  const typeLabel = workout?.workoutType || planDay?.workoutType || "";
  const scheduleMi = planDay
    ? metersToMiDisplay(planDay.estimatedDistanceInMeters)
    : metersToMiDisplay(workout?.estimatedDistanceInMeters);
  const plannedDateLabel = planDay?.date
    ? formatPlanDateDisplay(planDay.date, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : dateKey
      ? formatPlanDateDisplay(dateKey, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
      : "—";
  const isToday = dateKey != null && dateKey === localYmd(new Date());

  async function handleDoThisWorkout() {
    if (!planDetail || !dateKey || !planDay) return;
    const u = auth.currentUser;
    if (!u) return;
    setOpeningWorkout(true);
    try {
      const token = await u.getIdToken();
      const wid =
        workoutId ??
        planDay.workoutId ??
        (await resolveWorkoutForPlanDay(planDetail.id, dateKey, token));
      router.push(workoutDetailPathWithBackHref(wid, previewBackPath));
    } catch (e) {
      setWorkoutError(e instanceof Error ? e.message : "Could not open workout");
    } finally {
      setOpeningWorkout(false);
    }
  }

  const customizeHref =
    workoutId != null
      ? `/workouts/${workoutId}?edit=1&back=${encodeURIComponent(previewBackPath)}`
      : null;

  return (
    <AthleteAppShell>
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <Link
          href={hubBackHref}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          {hubBackLabel}
        </Link>

        {!dateKey && (
          <p className="text-sm text-red-600" role="alert">
            Invalid date in URL.
          </p>
        )}

        {dateKey && loading && (
          <p className="text-sm text-gray-500">Loading plan day…</p>
        )}

        {dateKey && error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        {dateKey && !loading && !error && planDetail && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4">
              {isToday ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                  Here&apos;s your work for today
                </p>
              ) : (
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Planned in your schedule
                </p>
              )}
              {planDetail.name?.trim() ? (
                <p className="mt-0.5 text-xs text-gray-600 truncate">{planDetail.name}</p>
              ) : null}
              <h1 className="mt-2 text-xl font-semibold text-gray-900 leading-snug">{title}</h1>
              <p className="mt-1 text-sm text-gray-600">
                Week {weekNumber} of {planDetail.totalWeeks} · {plannedDateLabel}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {typeLabel}
                {scheduleMi ? ` · ~${scheduleMi} planned` : null}
              </p>
              {workout?.description?.trim() ? (
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{workout.description}</p>
              ) : null}
            </div>

            <div className="px-5 py-4 space-y-4">
              {!planDay && (
                  <p className="text-sm text-gray-600">
                    No session on your plan for this calendar day.
                  </p>
                )}

              {planDay && workoutLoading && (
                <p className="text-sm text-gray-500">Loading segments…</p>
              )}
              {workoutError && (
                <p className="text-sm text-red-600" role="alert">
                  {workoutError}
                </p>
              )}
              {!workoutLoading && workout && workout.segments.length === 0 && (
                <p className="text-sm text-gray-600">
                  No structured steps yet for this workout type. You can still open the full workout
                  to set up your run or see more detail.
                </p>
              )}
              {!workoutLoading && workout && workout.segments.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                    Structure
                  </p>
                  <ol className="space-y-2">
                    {workout.segments.map((segment) => (
                      <li
                        key={segment.id}
                        className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm"
                      >
                        <div className="font-medium text-gray-900">
                          {segment.stepOrder}. {segment.title}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-600">
                          {segment.repeatCount != null && segment.repeatCount > 1 ? (
                            <span>Repeat {segment.repeatCount}× · </span>
                          ) : null}
                          {segment.durationType === "DISTANCE"
                            ? `${segment.durationValue} miles`
                            : `${segment.durationValue} minutes`}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <p className="text-xs text-gray-500 leading-relaxed">
                When you&apos;re ready to set up this run on your watch or log it, open the full
                workout screen.
              </p>
              {customizeHref && (
                <Link
                  href={customizeHref}
                  className="inline-flex text-sm font-semibold text-orange-700 hover:text-orange-900 underline-offset-2 hover:underline"
                >
                  Customize this workout
                </Link>
              )}
            </div>

            <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50/60">
              <div className="flex gap-2">
                {prevDateKey && (
                  <Link
                    href={`/training/day/${prevDateKey}${querySuffix}`}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                    Previous day
                  </Link>
                )}
                {nextDateKey && (
                  <Link
                    href={`/training/day/${nextDateKey}${querySuffix}`}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    Next day
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleDoThisWorkout()}
                disabled={openingWorkout || !planDay || !!workoutError || workoutLoading}
                className="w-full rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {isToday ? "Let&apos;s go — open workout" : "Do this workout"}
              </button>
              <Link
                href={hubBackHref}
                className="block w-full text-center rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to plan
              </Link>
            </div>
          </div>
        )}
      </div>
    </AthleteAppShell>
  );
}
