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
  utcDateOnly,
  ymdFromDate,
} from "@/lib/training/plan-utils";
import {
  fetchTrainingPlanDetail,
  fetchTrainingWorkoutDetail,
  resolveWorkoutForPlanDay,
} from "@/lib/training/fetch-plan-week-client";
import {
  metersToMiDisplay,
  pickWorkoutPayload,
  type PreviewWorkout,
} from "@/lib/training/workout-preview-payload";
import { stashWorkoutDayNav } from "@/lib/training/workout-day-nav";
import LogRaceResultSheet from "@/components/races/LogRaceResultSheet";

type PlanDetail = {
  id: string;
  name: string;
  totalWeeks: number;
  startDate: string;
  planWeeks: unknown;
  raceId?: string | null;
  race_registry?: {
    id: string;
    name: string;
    raceDate: string;
    distanceMeters: number | null;
    distanceLabel: string | null;
  } | null;
  athlete_goal?: { id: string } | null;
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
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  /** Find-or-create by date failed (e.g. no scheduled day) */
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  /** Workout exists but full detail/segments failed — user can still open workout */
  const [workoutDetailError, setWorkoutDetailError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<PreviewWorkout | null>(null);
  const [openingWorkout, setOpeningWorkout] = useState(false);
  /** e.g. navigate to /workouts/[id] failed — does not mean the day is unscheduled */
  const [openWorkoutError, setOpenWorkoutError] = useState<string | null>(null);
  const [raceResultRow, setRaceResultRow] = useState<{
    id: string;
    officialFinishTime: string | null;
  } | null>(null);
  const [logRaceOpen, setLogRaceOpen] = useState(false);

  const previewBackPath = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  const hubBackHref =
    sourceSetup && planDetail ? `/training-setup/${planDetail.id}` : "/training";
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
    setWorkout(null);
    setWorkoutId(null);
    setWorkoutError(null);
    setWorkoutDetailError(null);
    setOpenWorkoutError(null);
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
      setRaceResultRow(null);

      setWorkoutLoading(true);
      try {
        const wid = await resolveWorkoutForPlanDay(plan.id, dateKey, token);
        setWorkoutId(wid);
        setWorkoutError(null);
        let raceDayPayload: ReturnType<typeof pickWorkoutPayload> | null = null;
        try {
          const { workout: rawW } = await fetchTrainingWorkoutDetail(wid, token);
          raceDayPayload = pickWorkoutPayload(rawW);
          setWorkout(raceDayPayload);
          setWorkoutDetailError(null);
        } catch (e) {
          setWorkout(null);
          setWorkoutDetailError(
            e instanceof Error ? e.message : "Could not load workout detail"
          );
        }

        const regId = (plan as PlanDetail).race_registry?.id;
        if (regId && raceDayPayload?.workoutType === "Race") {
          try {
            const rr = await fetch(
              `/api/race-results?raceRegistryId=${encodeURIComponent(regId)}`,
              { headers: athleteBearerFetchHeaders(token) }
            );
            const rrJson = (await rr.json()) as { results?: { id: string; officialFinishTime: string | null }[] };
            if (rr.ok && Array.isArray(rrJson.results) && rrJson.results[0]) {
              setRaceResultRow({
                id: rrJson.results[0].id,
                officialFinishTime: rrJson.results[0].officialFinishTime ?? null,
              });
            }
          } catch {
            setRaceResultRow(null);
          }
        }
      } catch (e) {
        setWorkoutId(null);
        setWorkout(null);
        setWorkoutError(e instanceof Error ? e.message : "Could not load workout");
      } finally {
        setWorkoutLoading(false);
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

  const isRaceDay = workout?.workoutType === "Race";
  const title = workout?.title?.trim() || "Workout";
  const typeLabel = isRaceDay ? "Race" : workout?.workoutType || "";
  const scheduleMi = metersToMiDisplay(workout?.estimatedDistanceInMeters);
  const plannedDateLabel = dateKey
    ? formatPlanDateDisplay(dateKey, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "—";
  const weekNumberDisplay =
    workout?.weekNumber != null && Number.isFinite(workout.weekNumber)
      ? workout.weekNumber
      : "—";
  const isToday = dateKey != null && dateKey === localYmd(new Date());
  const isPastPlanDay = dateKey != null && dateKey < localYmd(new Date());
  const planRace = planDetail?.race_registry;
  const showRaceResultCta = Boolean(
    isRaceDay && isPastPlanDay && planRace?.id
  );
  const planRaceYmd = planRace?.raceDate
    ? ymdFromDate(
        /^\d{4}-\d{2}-\d{2}$/.test(String(planRace.raceDate).slice(0, 10))
          ? new Date(`${String(planRace.raceDate).slice(0, 10)}T12:00:00Z`)
          : new Date(planRace.raceDate)
      )
    : dateKey ?? "";
  const canOpenWorkout = workoutId != null;

  async function handleDoThisWorkout() {
    if (!planDetail || !dateKey) return;
    const u = auth.currentUser;
    if (!u) return;
    setOpeningWorkout(true);
    setOpenWorkoutError(null);
    try {
      const token = await u.getIdToken();
      const wid =
        workoutId ?? (await resolveWorkoutForPlanDay(planDetail.id, dateKey, token));
      stashWorkoutDayNav(wid, { source: "plan-preview", backPath: previewBackPath });
      router.push(`/workouts/${wid}`);
    } catch (e) {
      setOpenWorkoutError(e instanceof Error ? e.message : "Could not open workout");
    } finally {
      setOpeningWorkout(false);
    }
  }

  const customizeHref = workoutId != null ? `/workouts/${workoutId}?edit=1` : null;

  function stashPreviewNavForWorkout(wid: string) {
    stashWorkoutDayNav(wid, { source: "plan-preview", backPath: previewBackPath });
  }

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
              {isRaceDay ? (
                <p className="mt-2 inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-orange-900">
                  Race day
                </p>
              ) : null}
              <h1 className="mt-2 text-xl font-semibold text-gray-900 leading-snug">{title}</h1>
              <p className="mt-1 text-sm text-gray-600">
                Week {weekNumberDisplay} of {planDetail.totalWeeks} · {plannedDateLabel}
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
              {workoutLoading && (
                <p className="text-sm text-gray-500">Loading segments…</p>
              )}
              {workoutError && (
                <p className="text-sm text-red-600" role="alert">
                  {workoutError}
                </p>
              )}
              {workoutDetailError && workoutId && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2" role="status">
                  {workoutDetailError} — you can still open the full workout.
                </p>
              )}
              {openWorkoutError && (
                <p className="text-sm text-red-600" role="alert">
                  {openWorkoutError}
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
              {customizeHref && workoutId && (
                <Link
                  href={customizeHref}
                  onClick={() => stashPreviewNavForWorkout(workoutId)}
                  className="inline-flex text-sm font-semibold text-orange-700 hover:text-orange-900 underline-offset-2 hover:underline"
                >
                  Customize this workout
                </Link>
              )}

              {showRaceResultCta && planRace ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-3 space-y-2">
                  {raceResultRow?.officialFinishTime ? (
                    <p className="text-sm font-medium text-emerald-900 tabular-nums">
                      Your logged time: {raceResultRow.officialFinishTime}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-800">
                      Log your official finish time — even if your watch didn&apos;t record this as a
                      race.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setLogRaceOpen(true)}
                    className="inline-flex rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    {raceResultRow ? "Update result" : "Log your result"}
                  </button>
                </div>
              ) : null}
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
                disabled={openingWorkout || !canOpenWorkout || workoutLoading || !!workoutError}
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
      {showRaceResultCta && planRace ? (
        <LogRaceResultSheet
          open={logRaceOpen}
          onClose={() => setLogRaceOpen(false)}
          raceRegistryId={planRace.id}
          raceName={planRace.name}
          raceDateYmd={planRaceYmd}
          goalId={planDetail?.athlete_goal?.id ?? null}
          signupId={null}
          onSaved={() => {
            void load();
            setLogRaceOpen(false);
          }}
        />
      ) : null}
    </AthleteAppShell>
  );
}
