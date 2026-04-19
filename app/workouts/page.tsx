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
import { stashWorkoutDayNav } from "@/lib/training/workout-day-nav";
import {
  metersToMiDisplay,
  pickWorkoutPayload,
  type PreviewWorkout,
} from "@/lib/training/workout-preview-payload";

type PlanListEntry = { id: string };

type StandaloneRow = { id: string; workout: PreviewWorkout | null; error: string | null };

type LastLoggedWorkout = {
  id: string;
  title: string;
  workoutType: string;
  date: string | null;
  planId: string | null;
  actualAvgPaceSecPerMile: number | null;
  actualDistanceMeters: number | null;
  actualDurationSeconds: number | null;
  estimatedDistanceInMeters: number | null;
  paceDeltaSecPerMile: number | null;
  targetPaceSecPerMile: number | null;
  hrDeltaBpm: number | null;
  creditedFiveKPaceSecPerMile: number | null;
  activityStartTime: string | null;
};

/** Row from GET /api/activities */
type ActivitySummaryRow = {
  id: string;
  activityType: string | null;
  activityName: string | null;
  startTime: string | null;
  duration: number | null;
  distance: number | null;
  averageSpeed: number | null;
  averageHeartRate: number | null;
};

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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Workouts</h1>
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

function formatSecPerMileDisplay(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

function lastRunDayLabel(activityStartTime: string | null, date: string | null): string {
  const raw = activityStartTime ?? date;
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/** Pace delta sec/mi: >5 beat, <-5 missed, else on target band */
function paceBandLabel(paceDeltaSecPerMile: number | null | undefined): string | null {
  const p = paceDeltaSecPerMile;
  if (p == null || !Number.isFinite(p)) return null;
  if (p > 5) return "Beat target";
  if (p < -5) return "Missed target";
  return "On target";
}

/** paceDeltaSecPerMile = target − actual (positive ⇒ faster than prescribed). */
function versusTargetPhrase(deltaSecPerMile: number | null | undefined): string | null {
  if (deltaSecPerMile == null || !Number.isFinite(deltaSecPerMile)) return null;
  const n = Math.round(deltaSecPerMile);
  const abs = Math.abs(n);
  if (n > 0) return `${abs} sec/mi faster than target`;
  if (n < 0) return `${abs} sec/mi slower than target`;
  return "On target pace";
}

function formatDurationFromSeconds(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const m = Math.round(seconds / 60);
  if (m <= 0) return null;
  return `${m} min`;
}

/** m/s → seconds per mile (same as training matcher) */
function speedMpsToSecPerMile(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  return Math.round(1609.34 / mps);
}

function activityRowPaceDisplay(row: ActivitySummaryRow): string | null {
  const sec = speedMpsToSecPerMile(row.averageSpeed);
  if (sec != null) return formatSecPerMileDisplay(sec);
  return null;
}

function activityRowDistanceMi(row: ActivitySummaryRow): string | null {
  if (row.distance == null || row.distance <= 0) return null;
  return metersToMiDisplay(row.distance);
}

function LastRunPanelSkeleton() {
  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm animate-pulse"
      aria-hidden
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-4 w-36 rounded bg-gray-200" />
      </div>
      <div className="h-4 max-w-md w-full rounded bg-gray-100 mb-2" />
      <div className="h-3 w-20 rounded bg-gray-100 mb-3" />
      <div className="h-4 w-full max-w-lg rounded bg-gray-100 mb-2" />
      <div className="h-4 w-2/3 max-w-sm rounded bg-gray-100" />
    </section>
  );
}

function paceBandBadgeClasses(band: string | null): string {
  if (band === "Beat target") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (band === "Missed target") return "bg-amber-100 text-amber-900 border-amber-200";
  if (band === "On target") return "bg-slate-100 text-slate-800 border-slate-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function LastRunPanel({ workout }: { workout: LastLoggedWorkout }) {
  const day = lastRunDayLabel(workout.activityStartTime, workout.date);
  const actual = workout.actualAvgPaceSecPerMile;
  const delta = workout.paceDeltaSecPerMile;
  const band = paceBandLabel(delta);
  const versus = versusTargetPhrase(delta);
  const duration = formatDurationFromSeconds(workout.actualDurationSeconds);
  const distMi =
    workout.actualDistanceMeters != null && workout.actualDistanceMeters > 0
      ? metersToMiDisplay(workout.actualDistanceMeters)
      : workout.estimatedDistanceInMeters != null && workout.estimatedDistanceInMeters > 0
        ? `~${metersToMiDisplay(workout.estimatedDistanceInMeters)}`
        : null;

  return (
    <section className="rounded-2xl border-2 border-orange-100 bg-gradient-to-br from-white to-orange-50/40 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-800">Last run</h2>
          <p className="mt-1 text-lg font-bold text-gray-900">{workout.title}</p>
          {day ? <p className="text-sm text-gray-600 mt-0.5">{day}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {band ? (
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${paceBandBadgeClasses(band)}`}
            >
              {band}
            </span>
          ) : null}
          <Link
            href={`/workouts/${workout.id}`}
            className="text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            Full session →
          </Link>
        </div>
      </div>
      {workout.workoutType ? (
        <span className="inline-block rounded-md bg-orange-100/80 px-2 py-0.5 text-xs font-medium text-orange-900 capitalize">
          {String(workout.workoutType).toLowerCase()}
        </span>
      ) : null}
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {distMi ? (
          <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2">
            <dt className="text-xs font-medium text-gray-500">Distance</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">{distMi}</dd>
          </div>
        ) : null}
        {actual != null ? (
          <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2">
            <dt className="text-xs font-medium text-gray-500">Avg pace</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">
              {formatSecPerMileDisplay(actual)}
            </dd>
          </div>
        ) : null}
        {duration ? (
          <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2">
            <dt className="text-xs font-medium text-gray-500">Duration</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">{duration}</dd>
          </div>
        ) : null}
        {workout.targetPaceSecPerMile != null && workout.targetPaceSecPerMile > 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2">
            <dt className="text-xs font-medium text-gray-500">Target pace</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">
              {formatSecPerMileDisplay(workout.targetPaceSecPerMile)}
            </dd>
          </div>
        ) : null}
      </dl>
      {versus != null ? (
        <p className="mt-4 text-sm text-gray-800">
          <span className="font-medium text-gray-900">vs plan: </span>
          {versus}
        </p>
      ) : null}
      {workout.hrDeltaBpm != null ? (
        <p className="mt-2 text-sm text-gray-700">
          <span className="font-medium text-gray-900">Heart rate: </span>
          {workout.hrDeltaBpm > 0
            ? `${workout.hrDeltaBpm} bpm under zone midpoint`
            : workout.hrDeltaBpm < 0
              ? `${Math.abs(workout.hrDeltaBpm)} bpm above zone midpoint`
              : "on midpoint"}
        </p>
      ) : null}
    </section>
  );
}

/** When no workout match yet — show latest Garmin row only */
function LastActivityFallbackPanel({ row }: { row: ActivitySummaryRow }) {
  const day = row.startTime
    ? new Date(row.startTime).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";
  const dist = activityRowDistanceMi(row);
  const pace = activityRowPaceDisplay(row);
  const dur = formatDurationFromSeconds(row.duration);
  const label = row.activityName?.trim() || row.activityType || "Activity";

  return (
    <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last run</h2>
        <Link
          href={`/activities/${row.id}`}
          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
        >
          Details →
        </Link>
      </div>
      <p className="text-lg font-bold text-gray-900">{label}</p>
      {day ? <p className="text-sm text-gray-600 mt-1">{day}</p> : null}
      <p className="mt-3 text-sm text-gray-600">
        From your watch — not linked to a plan workout yet. Open the session to see full stats; when
        it matches a scheduled workout, pace analysis appears here.
      </p>
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        {dist ? (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <dt className="text-xs text-gray-500">Distance</dt>
            <dd className="font-semibold text-gray-900">{dist}</dd>
          </div>
        ) : null}
        {pace ? (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <dt className="text-xs text-gray-500">Avg pace</dt>
            <dd className="font-semibold text-gray-900">{pace}</dd>
          </div>
        ) : null}
        {dur ? (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <dt className="text-xs text-gray-500">Duration</dt>
            <dd className="font-semibold text-gray-900">{dur}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function RunHistoryPanel({ rows }: { rows: ActivitySummaryRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Run history
        </h2>
        <p className="text-sm text-gray-600">
          No activities synced yet. Connect Garmin in settings and sync, or check back after your
          next run.
        </p>
        <Link
          href="/settings/garmin"
          className="mt-3 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700"
        >
          Garmin settings →
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Run history</h2>
        <Link
          href="/activities"
          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
        >
          View all →
        </Link>
      </div>
      <ul className="divide-y divide-gray-100">
        {rows.map((row) => {
          const day = row.startTime
            ? new Date(row.startTime).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
            : "—";
          const type = row.activityType?.replace(/_/g, " ") ?? "Run";
          const dist = activityRowDistanceMi(row);
          const pace = activityRowPaceDisplay(row);
          const parts = [dist, pace].filter(Boolean);
          return (
            <li key={row.id}>
              <Link
                href={`/activities/${row.id}`}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm hover:bg-gray-50/80 -mx-2 px-2 rounded-lg transition-colors"
              >
                <span className="font-medium text-gray-900 min-w-0">
                  {row.activityName?.trim() || type}
                  <span className="font-normal text-gray-500"> · {day}</span>
                </span>
                <span className="text-gray-600 tabular-nums shrink-0">
                  {parts.length > 0 ? parts.join(" · ") : "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AnalysisPanel({ workout }: { workout: LastLoggedWorkout }) {
  const hasPace = workout.paceDeltaSecPerMile != null && Number.isFinite(workout.paceDeltaSecPerMile);
  const hasHr = workout.hrDeltaBpm != null && Number.isFinite(workout.hrDeltaBpm);
  const hasCredit =
    workout.creditedFiveKPaceSecPerMile != null &&
    workout.creditedFiveKPaceSecPerMile > 0;

  if (!hasPace && !hasHr && !hasCredit) {
    return null;
  }

  const versus = versusTargetPhrase(workout.paceDeltaSecPerMile);
  const band = paceBandLabel(workout.paceDeltaSecPerMile);

  return (
    <section className="rounded-2xl border-2 border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Analysis</h2>
          <p className="mt-1 text-base font-semibold text-gray-900">How this session stacked up</p>
          <p className="text-sm text-gray-600 mt-0.5">{workout.title}</p>
        </div>
        {band ? (
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${paceBandBadgeClasses(band)}`}
          >
            {band}
          </span>
        ) : null}
      </div>
      <div className="space-y-3 text-sm text-gray-800">
        {hasPace && versus ? (
          <p>
            <span className="font-semibold text-gray-900">Pace: </span>
            {versus}
            {workout.targetPaceSecPerMile != null && workout.targetPaceSecPerMile > 0 ? (
              <span className="text-gray-600">
                {" "}
                (target {formatSecPerMileDisplay(workout.targetPaceSecPerMile)})
              </span>
            ) : null}
          </p>
        ) : null}
        {hasHr ? (
          <p>
            <span className="font-semibold text-gray-900">Heart rate: </span>
            {workout.hrDeltaBpm! > 0
              ? `${workout.hrDeltaBpm} bpm under the prescribed zone midpoint`
              : workout.hrDeltaBpm! < 0
                ? `${Math.abs(workout.hrDeltaBpm!)} bpm above the zone midpoint`
                : "Right on the zone midpoint"}
          </p>
        ) : null}
        {hasCredit ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-emerald-950">
            <span className="font-semibold">5K pace signal: </span>
            this effort implies about{" "}
            <span className="font-bold tabular-nums">
              {formatSecPerMileDisplay(workout.creditedFiveKPaceSecPerMile)}
            </span>{" "}
            /mi at 5K — we may use this to tune your plan when quality targets are met.
          </p>
        ) : null}
      </div>
      <Link
        href={`/workouts/${workout.id}`}
        className="mt-4 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700"
      >
        Open full breakdown →
      </Link>
    </section>
  );
}

function GoTrainToday() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GoTrainData>(initialData);
  const [lastRun, setLastRun] = useState<LastLoggedWorkout | null>(null);
  const [recentActivities, setRecentActivities] = useState<ActivitySummaryRow[]>([]);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const todayKey = useMemo(() => localYmd(new Date()), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLastRun(null);
    setRecentActivities([]);
    setData({ ...initialData(), todayKey });
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();

      const [standaloneRes, listRes, lastRunRes, activitiesRes] = await Promise.all([
        fetch(
          `/api/workouts?standalone=1&date=${encodeURIComponent(todayKey)}&paged=1&limit=20`,
          { headers: athleteBearerFetchHeaders(token) }
        ),
        fetch("/api/training-plan?status=active", {
          headers: athleteBearerFetchHeaders(token),
        }),
        fetch("/api/me/last-logged-workout", {
          headers: athleteBearerFetchHeaders(token),
        }),
        fetch("/api/activities?limit=5", {
          headers: athleteBearerFetchHeaders(token),
        }),
      ]);

      const lastRunJson = (await lastRunRes.json()) as {
        workout?: LastLoggedWorkout | null;
        error?: string;
      };
      if (lastRunRes.ok && lastRunJson.workout && typeof lastRunJson.workout.id === "string") {
        setLastRun(lastRunJson.workout);
      } else {
        setLastRun(null);
      }

      const actJson = (await activitiesRes.json()) as { activities?: ActivitySummaryRow[] };
      if (activitiesRes.ok && Array.isArray(actJson.activities)) {
        setRecentActivities(actJson.activities.slice(0, 5));
      } else {
        setRecentActivities([]);
      }

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
      setLastRun(null);
      setRecentActivities([]);
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
      stashWorkoutDayNav(wid, { source: "go-train" });
      router.push(`/workouts/${wid}`);
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
        stashWorkoutDayNav(workoutId, { source: "go-train" });
        router.push(`/workouts/${workoutId}`);
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
    <div className="space-y-6">
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

      {authReady && loading ? (
        <div className="space-y-6">
          <LastRunPanelSkeleton />
          <LastRunPanelSkeleton />
        </div>
      ) : null}

      {authReady && !loading ? (
        <div className="space-y-6">
          {lastRun ? (
            <LastRunPanel workout={lastRun} />
          ) : recentActivities[0] ? (
            <LastActivityFallbackPanel row={recentActivities[0]} />
          ) : (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Last run
              </h2>
              <p className="text-sm text-gray-600">
                No synced runs yet. After you connect Garmin and complete a workout, your last run
                and analysis show up here.
              </p>
            </section>
          )}

          <RunHistoryPanel rows={recentActivities} />

          {lastRun ? <AnalysisPanel workout={lastRun} /> : null}
        </div>
      ) : null}
    </div>
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
      {variant === "plan" && weekNumber != null && totalWeeks != null && (
        <p className="mt-1 text-sm text-gray-600">
          Week {weekNumber} of {totalWeeks}
        </p>
      )}
      <p className="mt-1 text-xs text-gray-500">
        {typeLabel}
        {scheduleMi ? ` · ~${scheduleMi} planned` : null}
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
      </div>
    </div>
  );
}
