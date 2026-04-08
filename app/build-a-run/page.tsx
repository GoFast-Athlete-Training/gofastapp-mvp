"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";

const PAGE_SIZE = 20;

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

function formatWorkoutDate(iso: string | null | undefined): string {
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

export default function BuildARunPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Build a Run
              </h1>
              <p className="text-gray-600">
                Workouts you create yourself — not tied to your training plan.
                Same as plan workouts once you open them: Garmin, details, and
                share from the workout screen.
              </p>
            </div>

            <div className="space-y-10">
              <section className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/30 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  Create a workout
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Generate or define a session. You&apos;ll open it like any other
                  workout.
                </p>
                <Link
                  href="/workouts/create?from=build-a-run"
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  <Plus className="h-5 w-5" />
                  New workout
                </Link>
              </section>

              <StandaloneRunsList />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function StandaloneRunsList() {
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
      }>(
        `workouts?standalone=1&limit=${PAGE_SIZE}&offset=${start}&paged=1`
      );
      const list = res.data.workouts ?? [];
      const t = res.data.total ?? 0;
      setTotal(t);
      setOffset(start + list.length);
      setWorkouts((prev) => (append ? [...prev, ...list] : list));
    } catch (e: unknown) {
      setError("Could not load your runs.");
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
        `Delete ${selected.size} run(s)? This cannot be undone.`
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
        setError("Some items could not be deleted. Refresh and try again.");
      }
      setSelected(new Set());
      setWorkouts([]);
      setOffset(0);
      await fetchPage(0, false);
    } catch (e: unknown) {
      setError("Delete failed.");
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
          <h2 className="text-lg font-semibold text-gray-900">Your runs</h2>
          <p className="text-sm text-gray-500 mt-1">
            Open one to send to Garmin or share. Expand to list what you&apos;ve
            built.
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
              Show list
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
            <p className="text-sm text-gray-600 py-4">
              No standalone workouts yet. Create one above.
            </p>
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
                      {formatWorkoutDate(workout.date ?? null)}
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
