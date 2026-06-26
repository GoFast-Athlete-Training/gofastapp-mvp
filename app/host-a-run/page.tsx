"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import CreateCityRunForm, {
  type CreateCityRunFormWorkout,
} from "@/components/cityruns/CreateCityRunForm";
import api from "@/lib/api";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function HostARunPage() {
  const [workout, setWorkout] = useState<CreateCityRunFormWorkout | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureHostWorkout = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await api.post<{ workout: CreateCityRunFormWorkout }>("/workouts", {
        title: "Hosted group run",
        workoutType: "Easy",
        date: todayYmd(),
        segments: [
          {
            stepOrder: 1,
            title: "Easy run",
            durationType: "DISTANCE",
            durationValue: 5000,
          },
        ],
      });
      const w = data?.workout;
      if (!w?.id) {
        setLoadError("Could not prepare your run");
        setWorkout(null);
        return;
      }
      setWorkout({
        id: w.id,
        title: w.title,
        workoutType: w.workoutType,
        description: w.description ?? null,
        date: w.date ?? todayYmd(),
        estimatedDistanceInMeters: w.estimatedDistanceInMeters ?? 5000,
        segments: Array.isArray(w.segments) ? w.segments : [],
      });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setLoadError(err.response?.data?.error || "Could not prepare your run");
      setWorkout(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void ensureHostWorkout();
  }, [ensureHostWorkout]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            <Link
              href="/gorun"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to runs
            </Link>

            <div className="flex items-start gap-3 mb-6">
              <div className="rounded-xl bg-orange-100 p-3">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Host a run</h1>
                <p className="mt-1 text-gray-600 max-w-xl">
                  Create a one-off run, invite friends with a link, and use run chat and check-in
                  on run day — same flow as club runs.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
              </div>
            ) : loadError || !workout ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                <p>{loadError || "Something went wrong"}</p>
                <button
                  type="button"
                  onClick={() => void ensureHostWorkout()}
                  className="mt-3 text-sm font-semibold text-red-700 underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <CreateCityRunForm workout={workout} hideWorkoutSummary />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
