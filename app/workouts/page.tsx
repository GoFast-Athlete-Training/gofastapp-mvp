"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Activity,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";
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

const PAGE_SIZE = 20;

type PlanListEntry = { id: string };

type LiteWorkout = {
  id: string;
  title?: string | null;
  workoutType?: string | null;
  description?: string | null;
  date?: string | null;
  matchedActivityId?: string | null;
  estimatedDistanceInMeters?: number | null;
  planId?: string | null;
  segments?: { length?: number };
  _count?: { segments: number };
};

function formatPlanDateLabel(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "Unscheduled";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unscheduled";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function segmentCount(w: LiteWorkout): number {
  if (typeof w._count?.segments === "number") return w._count.segments;
  return Array.isArray(w.segments) ? w.segments.length : 0;
}

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
              <p className="text-gray-600">
                Today&apos;s plan, your library, and standalone workouts — without
                loading everything at once.
              </p>
            </div>

            <div className="space-y-10">
              <TodaysPlanWorkout />
              <MyWorkoutsBrowse />
              <GenerateWorkoutSection />
              <ActivityHistoryCollapsible />
            </div>
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
  const [opening, setOpening] = useState(false);

  const todayKey = useMemo(() => ymdFromDate(new Date()), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTodayCard(null);
    setHasActiveSchedule(null);
    setPlanId(null);
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
      const scheduled =
        Array.isArray(p.planWeeks) && (p.planWeeks as unknown[]).length > 0;
      if (!scheduled) {
        setHasActiveSchedule(false);
        return;
      }
      setHasActiveSchedule(true);
      const wn = currentTrainingWeekNumber(p.startDate, p.totalWeeks);
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
      router.push(`/workouts/${wid}`);
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
        From your active training plan (
        {formatPlanDateDisplay(todayKey, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
        ).
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
        <p className="text-sm text-gray-600">
          No active plan with a schedule.{" "}
          <Link
            href="/training-setup"
            className="font-medium text-orange-600 hover:text-orange-700"
          >
            Set up or finish your plan
          </Link>{" "}
          — or browse workouts below.
        </p>
      )}
      {authReady && !loading && hasActiveSchedule === true && !todayCard && (
        <p className="text-sm text-gray-600">
          No session on your plan for today — rest day or off-calendar. Pick
          another workout below if you still want to run.
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

function MyWorkoutsBrowse() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [workouts, setWorkouts] = useState<LiteWorkout[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (start: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        workouts: LiteWorkout[];
        total: number;
        offset: number;
        hasMore: boolean;
      }>(`workouts?limit=${PAGE_SIZE}&offset=${start}&paged=1`);
      const list = res.data.workouts ?? [];
      const t = res.data.total ?? 0;
      setTotal(t);
      setOffset(start + list.length);
      setWorkouts((prev) => (append ? [...prev, ...list] : list));
    } catch (e: unknown) {
      setError("Could not load workouts");
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next && workouts.length === 0 && !loading) {
      void fetchPage(0, false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selectAllOnPage() {
    setSelected(new Set(workouts.map((w) => w.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        `Delete ${selected.size} workout(s)? This cannot be undone. Activities you already logged stay in history where supported.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await api.delete("/workouts", {
        data: { ids: Array.from(selected) },
      });
      const deleted = (res.data as { deleted?: number })?.deleted ?? 0;
      if (deleted < selected.size) {
        setError("Some workouts could not be deleted (refresh and try again).");
      }
      setSelected(new Set());
      setWorkouts([]);
      setOffset(0);
      await fetchPage(0, false);
    } catch (e: unknown) {
      setError("Delete failed");
      console.error(e);
    } finally {
      setDeleting(false);
    }
  }

  const hasMore = offset < total;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            All my workouts
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Browse and open any planned workout, or select several to delete
            (e.g. leftovers from an old plan).
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggleExpanded()}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Hide list
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Browse workouts
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {total > 0 && (
            <p className="text-xs text-gray-500">
              {total} total — showing {workouts.length}
            </p>
          )}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-100 bg-red-50/80 px-3 py-2">
              <span className="text-sm text-red-900">
                {selected.size} selected
              </span>
              <button
                type="button"
                onClick={() => void deleteSelected()}
                disabled={deleting}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting…" : "Delete selected"}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-sm text-red-800 underline"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={selectAllOnPage}
                className="text-sm text-red-800 underline"
              >
                Select all on page
              </button>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
            </div>
          )}
          {!loading && workouts.length === 0 && (
            <p className="text-sm text-gray-600 py-4">No workouts yet.</p>
          )}
          {!loading && workouts.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {workouts.map((workout) => (
                <li
                  key={workout.id}
                  className="flex gap-3 p-3 hover:bg-gray-50/80"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                    checked={selected.has(workout.id)}
                    onChange={() => toggleSelect(workout.id)}
                    aria-label={`Select ${workout.title ?? workout.id}`}
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => router.push(`/workouts/${workout.id}`)}
                  >
                    <span className="font-medium text-gray-900 block">
                      {displayWorkoutListTitle({
                        title: workout.title ?? "",
                        workoutType: workout.workoutType ?? "Easy",
                        estimatedDistanceInMeters:
                          workout.estimatedDistanceInMeters ?? null,
                      })}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatPlanDateLabel(workout.date ?? null)}
                      {segmentCount(workout) > 0
                        ? ` · ${segmentCount(workout)} segments`
                        : ""}
                      {workout.matchedActivityId ? (
                        <span className="ml-2 text-emerald-700 font-medium">
                          Logged
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && hasMore && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void fetchPage(offset, true)}
              className="w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function GenerateWorkoutSection() {
  return (
    <section className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/30 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Generate a workout
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Build a standalone session. When you&apos;re done, you&apos;ll land on
        just that workout — not the full list.
      </p>
      <Link
        href="/workouts/create"
        className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
      >
        <Plus className="h-5 w-5" />
        Create / generate workout
      </Link>
    </section>
  );
}

type ActivityRow = {
  id: string;
  ingestionStatus: string;
  activityName: string | null;
  activityType: string | null;
  startTime: string | null;
  duration: number | null;
  distance: number | null;
  matchedWorkoutId: string | null;
  matchedWorkoutTitle: string | null;
};

function ActivityHistoryCollapsible() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ activities: ActivityRow[] }>(
          "/athlete/activities?limit=100"
        );
        if (!cancelled) {
          setActivities(res.data.activities || []);
          setLoaded(true);
        }
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "response" in e
            ? (e as { response?: { data?: { error?: string } } }).response?.data
                ?.error
            : null;
        if (!cancelled) {
          setError(msg || "Could not load activities");
          setActivities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50"
      >
        <span className="text-lg font-semibold text-gray-900">
          Synced activities
        </span>
        {open ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>
      {open && (
        <div className="border-t border-gray-100 px-6 pb-6">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600 py-4" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && activities.length === 0 && (
            <div className="text-center py-8 text-gray-600 text-sm">
              <Activity className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              No activities yet.
            </div>
          )}
          {!loading && activities.length > 0 && (
            <div className="grid gap-3 pt-4 max-h-[480px] overflow-y-auto">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className={`rounded-lg border p-4 text-sm ${
                    activity.matchedWorkoutId
                      ? "border-emerald-200 cursor-pointer hover:bg-emerald-50/50"
                      : "border-gray-200"
                  }`}
                  onClick={() => {
                    if (activity.matchedWorkoutId) {
                      router.push(`/workouts/${activity.matchedWorkoutId}`);
                    }
                  }}
                  role={activity.matchedWorkoutId ? "button" : undefined}
                >
                  <div className="flex flex-wrap justify-between gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {activity.activityName || "Run"}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {activity.ingestionStatus}
                    </span>
                  </div>
                  {activity.matchedWorkoutId && (
                    <p className="text-emerald-800 text-xs font-medium">
                      Matched plan workout → tap to open
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
