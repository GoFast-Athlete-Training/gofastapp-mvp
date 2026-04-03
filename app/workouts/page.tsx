"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import { auth } from "@/lib/firebase";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { onAuthStateChanged } from "firebase/auth";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import {
  currentTrainingWeekNumber,
  formatPlanDateDisplay,
  localYmd,
} from "@/lib/training/plan-utils";
import {
  fetchPlanWeekSchedule,
  fetchTrainingPlanDetail,
  fetchTrainingWorkoutDetail,
  resolveWorkoutForPlanDay,
  type PlanDayCard,
} from "@/lib/training/fetch-plan-week-client";
import { workoutDetailPathWithGoTrainContext } from "@/lib/training/workout-nav-query";
import {
  metersToMiDisplay,
  pickWorkoutPayload,
  type PreviewWorkout,
} from "@/lib/training/workout-preview-payload";

type PlanListEntry = { id: string };

type StandaloneRow = { id: string; workout: PreviewWorkout | null; error: string | null };

type GoTrainData = {
  todayKey: string;
  planId: string | null;
  planName: string | null;
  hasActiveSchedule: boolean | null;
  todayCard: PlanDayCard | null;
  currentWeekNumber: number | null;
  totalWeeks: number | null;
  planWorkoutId: string | null;
  planWorkout: PreviewWorkout | null;
  planWorkoutError: string | null;
  standalone: StandaloneRow[];
};

const initialData = (): GoTrainData => ({
  todayKey: "",
  planId: null,
  planName: null,
  hasActiveSchedule: null,
  todayCard: null,
  currentWeekNumber: null,
  totalWeeks: null,
  planWorkoutId: null,
  planWorkout: null,
  planWorkoutError: null,
  standalone: [],
});

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
                Your hub for today&apos;s sessions — structure loads here first. Open a workout to
                set it up on your watch, customize segments, or invite others. Full calendar:{" "}
                <Link
                  href="/training"
                  className="font-medium text-orange-600 hover:text-orange-700"
                >
                  My Training
                </Link>
                . One-off runs:{" "}
                <Link
                  href="/build-a-run"
                  className="font-medium text-orange-600 hover:text-orange-700"
                >
                  Build a Run
                </Link>
                .
              </p>
            </div>

            <GoTrainToday />
          </div>
        </main>
      </div>
    </div>
  );
}

function GoTrainToday() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GoTrainData>(initialData);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const todayKey = useMemo(() => localYmd(new Date()), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData({ ...initialData(), todayKey });
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();

      const [standaloneRes, listRes] = await Promise.all([
        fetch(
          `/api/workouts?standalone=1&date=${encodeURIComponent(todayKey)}&paged=1&limit=20`,
          { headers: athleteBearerFetchHeaders(token) }
        ),
        fetch("/api/training-plan?status=active", {
          headers: athleteBearerFetchHeaders(token),
        }),
      ]);

      const standaloneJson = (await standaloneRes.json()) as {
        workouts?: Array<{ id: string }>;
        error?: string;
      };
      let standaloneIds: string[] = [];
      if (standaloneRes.ok && Array.isArray(standaloneJson.workouts)) {
        standaloneIds = standaloneJson.workouts.map((w) => w.id);
      }

      let planId: string | null = null;
      let planName: string | null = null;
      let hasActiveSchedule: boolean | null = null;
      let todayCard: PlanDayCard | null = null;
      let currentWeekNumber: number | null = null;
      let totalWeeks: number | null = null;

      const listData = (await listRes.json()) as { plans?: PlanListEntry[] };
      if (
        listRes.ok &&
        Array.isArray(listData.plans) &&
        listData.plans.length > 0
      ) {
        planId = listData.plans[0].id;
        const { plan } = await fetchTrainingPlanDetail(planId, token);
        const p = plan as {
          name?: string;
          planWeeks?: unknown;
          startDate: string;
          totalWeeks: number;
        };
        planName = typeof p.name === "string" && p.name.trim() ? p.name.trim() : null;
        totalWeeks =
          typeof p.totalWeeks === "number" && Number.isFinite(p.totalWeeks)
            ? p.totalWeeks
            : null;
        const scheduled =
          Array.isArray(p.planWeeks) && (p.planWeeks as unknown[]).length > 0;
        if (!scheduled) {
          hasActiveSchedule = false;
        } else {
          hasActiveSchedule = true;
          const wn = currentTrainingWeekNumber(p.startDate, p.totalWeeks);
          currentWeekNumber = wn;
          const { days } = await fetchPlanWeekSchedule(planId, wn, token);
          todayCard = days.find((d) => d.dateKey === todayKey) ?? null;
        }
      } else {
        hasActiveSchedule = false;
      }

      let planWorkoutId: string | null = null;
      if (planId && todayCard) {
        planWorkoutId =
          todayCard.workoutId ??
          (await resolveWorkoutForPlanDay(planId, todayCard.dateKey, token));
      }

      if (planWorkoutId) {
        standaloneIds = standaloneIds.filter((id) => id !== planWorkoutId);
      }

      const detailTasks: Array<{ kind: "plan" | "standalone"; id: string }> = [];
      if (planWorkoutId && todayCard) {
        detailTasks.push({ kind: "plan", id: planWorkoutId });
      }
      for (const id of standaloneIds) {
        detailTasks.push({ kind: "standalone", id });
      }

      const results = await Promise.all(
        detailTasks.map(async ({ kind, id }) => {
          try {
            const { workout: raw } = await fetchTrainingWorkoutDetail(id, token);
            const parsed = pickWorkoutPayload(raw);
            return { kind, id, workout: parsed, err: null as string | null };
          } catch (e) {
            return {
              kind,
              id,
              workout: null,
              err: e instanceof Error ? e.message : "Could not load workout",
            };
          }
        })
      );

      const planResult = results.find((r) => r.kind === "plan");
      const standaloneRows: StandaloneRow[] = results
        .filter((r) => r.kind === "standalone")
        .map((r) => ({
          id: r.id,
          workout: r.workout,
          error: r.err,
        }));

      setData({
        todayKey,
        planId,
        planName,
        hasActiveSchedule,
        todayCard,
        currentWeekNumber,
        totalWeeks,
        planWorkoutId: planWorkoutId && todayCard ? planWorkoutId : null,
        planWorkout: planResult?.workout ?? null,
        planWorkoutError: planResult?.err ?? null,
        standalone: standaloneRows,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load today");
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

  const openPlanWorkout = useCallback(async () => {
    const u = auth.currentUser;
    if (!u || !data.planId || !data.todayCard) return;
    setError(null);
    try {
      const token = await u.getIdToken();
      const wid =
        data.planWorkoutId ??
        data.todayCard.workoutId ??
        (await resolveWorkoutForPlanDay(data.planId, data.todayCard.dateKey, token));
      setOpeningId(wid);
      router.push(
        workoutDetailPathWithGoTrainContext(wid, {
          back: "workouts",
          planId: data.planId,
          weekNumber: data.currentWeekNumber ?? undefined,
          totalWeeks: data.totalWeeks ?? undefined,
          dateKey: data.todayCard.dateKey,
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open workout");
    } finally {
      setOpeningId(null);
    }
  }, [data, router]);

  const openStandaloneWorkout = useCallback(
    async (workoutId: string) => {
      setOpeningId(workoutId);
      setError(null);
      try {
        router.push(
          workoutDetailPathWithGoTrainContext(workoutId, {
            back: "workouts",
            planId: null,
            dateKey: todayKey,
          })
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open workout");
      } finally {
        setOpeningId(null);
      }
    },
    [router, todayKey]
  );

  const hasPlanPreview =
    data.planWorkoutId &&
    data.todayCard &&
    data.hasActiveSchedule === true;
  const hasAnySession = hasPlanPreview || data.standalone.length > 0;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Today</h2>
        <p className="text-sm text-gray-500 mb-4">
          {formatPlanDateDisplay(data.todayKey || todayKey, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </p>

        {!authReady && (
          <p className="text-sm text-gray-500">Checking your session…</p>
        )}
        {authReady && loading && (
          <p className="text-sm text-gray-500">Loading your sessions…</p>
        )}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {authReady &&
          !loading &&
          data.hasActiveSchedule === false &&
          !hasAnySession && (
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

        {authReady &&
          !loading &&
          data.hasActiveSchedule === true &&
          !data.todayCard &&
          data.standalone.length === 0 && (
            <p className="text-sm text-gray-600">
              Nothing on your plan for today. Schedule a custom run in{" "}
              <Link
                href="/build-a-run"
                className="font-medium text-orange-600 hover:text-orange-700"
              >
                Build a Run
              </Link>{" "}
              (set the date to today), or check{" "}
              <Link
                href="/training"
                className="font-medium text-orange-600 hover:text-orange-700"
              >
                My Training
              </Link>
              .
            </p>
          )}

        {authReady &&
          !loading &&
          (hasPlanPreview || data.standalone.length > 0) && (
          <div className="space-y-6">
            {hasPlanPreview && data.todayCard && (
              <WorkoutPreviewPanel
                variant="plan"
                eyebrow="From your training plan"
                planName={data.planName}
                todayCard={data.todayCard}
                weekNumber={data.currentWeekNumber}
                totalWeeks={data.totalWeeks}
                workout={data.planWorkout}
                loadError={data.planWorkoutError}
                workoutId={data.planWorkoutId!}
                opening={openingId === data.planWorkoutId}
                onOpen={() => void openPlanWorkout()}
              />
            )}

            {data.standalone.map((row) => (
              <WorkoutPreviewPanel
                key={row.id}
                variant="standalone"
                eyebrow="Your custom run"
                planName={null}
                todayCard={null}
                weekNumber={null}
                totalWeeks={null}
                workout={row.workout}
                loadError={row.error}
                workoutId={row.id}
                opening={openingId === row.id}
                onOpen={() => void openStandaloneWorkout(row.id)}
              />
            ))}
          </div>
          )}
      </div>
    </section>
  );
}

function WorkoutPreviewPanel({
  variant,
  eyebrow,
  planName,
  todayCard,
  weekNumber,
  totalWeeks,
  workout,
  loadError,
  workoutId,
  opening,
  onOpen,
}: {
  variant: "plan" | "standalone";
  eyebrow: string;
  planName: string | null;
  todayCard: PlanDayCard | null;
  weekNumber: number | null;
  totalWeeks: number | null;
  workout: PreviewWorkout | null;
  loadError: string | null;
  workoutId: string;
  opening: boolean;
  onOpen: () => void;
}) {
  const title =
    workout?.title?.trim() ||
    (todayCard ? displayWorkoutListTitle(todayCard) : "Workout");
  const typeLabel = workout?.workoutType || todayCard?.workoutType || "";
  const scheduleMi = todayCard
    ? metersToMiDisplay(todayCard.estimatedDistanceInMeters)
    : metersToMiDisplay(workout?.estimatedDistanceInMeters);

  const phaseLabel =
    variant === "plan" && todayCard ? (
      <>
        {" · "}
        <span className="font-medium text-gray-600">{todayCard.phase}</span> phase
      </>
    ) : null;

  const logged =
    variant === "plan" && todayCard?.matchedActivityId ? (
      <span className="ml-2 font-medium text-emerald-700">Logged</span>
    ) : null;

  return (
    <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">{eyebrow}</p>
      {planName ? (
        <p className="mt-0.5 text-xs text-gray-600 truncate">{planName}</p>
      ) : null}
      <h3 className="mt-2 text-lg font-semibold text-gray-900 leading-snug">{title}</h3>
      {variant === "plan" &&
        weekNumber != null &&
        totalWeeks != null &&
        todayCard?.date && (
          <p className="mt-1 text-sm text-gray-600">
            Week {weekNumber} of {totalWeeks} ·{" "}
            {formatPlanDateDisplay(todayCard.date, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
        )}
      <p className="mt-1 text-xs text-gray-500">
        {typeLabel}
        {scheduleMi ? ` · ~${scheduleMi} planned` : null}
        {phaseLabel}
        {logged}
      </p>
      {workout?.description?.trim() ? (
        <p className="mt-3 text-sm text-gray-600 leading-relaxed">{workout.description}</p>
      ) : null}

      {loadError && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {loadError}
        </p>
      )}

      {!loadError && workout && workout.segments.length === 0 && (
        <p className="mt-3 text-sm text-gray-600">
          No structured steps yet for this workout type. You can still open the full workout to set
          up your run or see more detail.
        </p>
      )}

      {!loadError && workout && workout.segments.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
            Structure
          </p>
          <ol className="space-y-2">
            {workout.segments.map((segment) => (
              <li
                key={segment.id}
                className="rounded-lg border border-gray-100 bg-white/80 px-3 py-2 text-sm"
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

      <p className="mt-4 text-xs text-gray-500 leading-relaxed">
        Ready to execute? Open the full workout for Garmin, edits, and sharing.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={opening}
          onClick={onOpen}
          className="inline-flex justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {opening ? "Opening…" : "Open workout"}
        </button>
        <Link
          href={`/workouts/${workoutId}?edit=1`}
          className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Customize
        </Link>
      </div>
    </div>
  );
}
