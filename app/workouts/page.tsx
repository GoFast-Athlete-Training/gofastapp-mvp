"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Activity, Calendar } from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";

export default function WorkoutsPage() {
  const router = useRouter();
  const [view, setView] = useState<"plan" | "activity">("plan");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Workouts</h1>
              <p className="text-gray-600">Plan workouts or view your activity history</p>
            </div>

            {/* Toggle: Plan or See Activity */}
            <div className="mb-6 flex gap-4 border-b border-gray-200">
              <button
                onClick={() => setView("plan")}
                className={`px-4 py-2 font-medium transition-colors ${
                  view === "plan"
                    ? "text-orange-600 border-b-2 border-orange-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Plan
              </button>
              <button
                onClick={() => setView("activity")}
                className={`px-4 py-2 font-medium transition-colors ${
                  view === "activity"
                    ? "text-orange-600 border-b-2 border-orange-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                See Activity
              </button>
            </div>

            {/* Content */}
            {view === "plan" ? (
              <PlanView />
            ) : (
              <ActivityView />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

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

function PlanView() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const response = await api.get("workouts");
      setWorkouts(response.data.workouts || []);
    } catch (error: any) {
      console.error("Error fetching workouts:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Create Button */}
      <Link
        href="/workouts/create"
        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors mb-6"
      >
        <Plus className="w-5 h-5" />
        Create Workout
      </Link>

      {/* Workouts List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
        </div>
      ) : workouts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No workouts yet</p>
          <p className="text-sm text-gray-500">Create your first workout to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {workouts.map((workout) => (
            <div
              key={workout.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/workouts/${workout.id}`)}
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-xl font-semibold text-gray-900">{workout.title}</h3>
                {workout.matchedActivityId && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Logged
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-2">{formatPlanDateLabel(workout.date)}</p>
              {workout.description && (
                <p className="text-gray-600 mb-4">{workout.description}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                {workout.segments && workout.segments.length > 0 && (
                  <span>
                    {workout.segments.length} segment{workout.segments.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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

function ActivityView() {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ activities: ActivityRow[] }>("/athlete/activities?limit=100");
        if (!cancelled) {
          setActivities(res.data.activities || []);
        }
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "response" in e
            ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
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
  }, []);

  return (
    <div>
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-red-50 rounded-lg border border-red-100 px-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No activities yet</p>
          <p className="text-sm text-gray-500">
            Sync Garmin or complete a run — matched activities link to your planned workouts automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={`bg-white rounded-lg border p-6 transition-shadow ${
                activity.matchedWorkoutId
                  ? "border-emerald-200 hover:shadow-md cursor-pointer"
                  : "border-gray-200"
              }`}
              onClick={() => {
                if (activity.matchedWorkoutId) {
                  router.push(`/workouts/${activity.matchedWorkoutId}`);
                }
              }}
              role={activity.matchedWorkoutId ? "button" : undefined}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <h3 className="text-xl font-semibold text-gray-900">
                  {activity.activityName || "Run"}
                </h3>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    activity.ingestionStatus === "MATCHED"
                      ? "bg-emerald-100 text-emerald-800"
                      : activity.ingestionStatus === "UNMATCHED"
                        ? "bg-amber-50 text-amber-900"
                        : activity.ingestionStatus === "INELIGIBLE"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {activity.ingestionStatus}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                {activity.distance != null && activity.distance > 0 && (
                  <span>{(activity.distance / 1609.34).toFixed(2)} mi</span>
                )}
                {activity.startTime && (
                  <span>{new Date(activity.startTime).toLocaleString()}</span>
                )}
                {activity.duration != null && activity.duration > 0 && (
                  <span>{Math.round(activity.duration / 60)} min</span>
                )}
              </div>
              {activity.matchedWorkoutId && (
                <p className="text-sm text-emerald-800 mt-3 font-medium">
                  Matched to plan workout: {activity.matchedWorkoutTitle || activity.matchedWorkoutId}{" "}
                  <span className="text-emerald-600">→ open</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
