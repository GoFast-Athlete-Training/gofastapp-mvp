"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Activity, Calendar } from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";

export default function WorkoutsPage() {
  const router = useRouter();
  const [view, setView] = useState<"plan" | "activity">("plan");

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      
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
    </div>
  );
}

function PlanView() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // TODO: Fetch workouts from API
  useEffect(() => {
    // fetchWorkouts();
    setLoading(false);
  }, []);

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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{workout.title}</h3>
              {workout.description && (
                <p className="text-gray-600 mb-4">{workout.description}</p>
              )}
              <div className="flex gap-4 text-sm text-gray-500">
                {workout.totalMiles && (
                  <span>{workout.totalMiles} miles</span>
                )}
                {workout.garminSyncedAt && (
                  <span className="text-green-600">✓ Synced to Garmin</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityView() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // TODO: Fetch activities from API
  useEffect(() => {
    // fetchActivities();
    setLoading(false);
  }, []);

  return (
    <div>
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No activities yet</p>
          <p className="text-sm text-gray-500">Your completed workouts will appear here</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {activity.activityName || "Run"}
              </h3>
              <div className="flex gap-4 text-sm text-gray-500">
                {activity.distance && (
                  <span>{(activity.distance / 1609.34).toFixed(2)} miles</span>
                )}
                {activity.startTime && (
                  <span>{new Date(activity.startTime).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
