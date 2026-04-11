"use client";

/**
 * Build a Run — page UX layer. The CityRun creation model lives in CreateCityRunForm.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";
import CreateCityRunForm, {
  type CreateCityRunFormWorkout,
} from "@/components/cityruns/CreateCityRunForm";

export default function BuildARunPage() {
  const params = useParams();
  const router = useRouter();
  const workoutId = (params.id as string) || "";

  const [workout, setWorkout] = useState<CreateCityRunFormWorkout | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingWorkout, setLoadingWorkout] = useState(true);

  const loadWorkout = useCallback(async () => {
    if (!workoutId) return;
    setLoadingWorkout(true);
    setLoadError(null);
    try {
      const { data } = await api.get<{ workout: CreateCityRunFormWorkout }>(
        `/training/workout/${workoutId}`
      );
      const w = data?.workout;
      if (!w) {
        setLoadError("Workout not found");
        setWorkout(null);
        return;
      }
      setWorkout(w);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setLoadError(err.response?.data?.error || "Could not load workout");
      setWorkout(null);
    } finally {
      setLoadingWorkout(false);
    }
  }, [workoutId]);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  if (loadingWorkout) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopNav />
        <div className="flex flex-1 overflow-hidden">
          <AthleteSidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 py-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (loadError || !workout) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopNav />
        <div className="flex flex-1 overflow-hidden">
          <AthleteSidebar />
          <main className="flex-1 overflow-y-auto px-4 py-8">
            <p className="text-red-700">{loadError || "Workout not found"}</p>
            <Link href="/workouts" className="mt-4 inline-block text-sky-700 font-medium">
              Back to workouts
            </Link>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            <button
              type="button"
              onClick={() => router.push(`/workouts/${workout.id}`)}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to workout
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Users className="w-6 h-6 text-sky-600" />
              <h1 className="text-xl font-semibold text-gray-900">Build a Run</h1>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              Your workout is set — design a route, pick a spot, and set a time. You&apos;ll get a CityRun
              RSVP link and a training share page.
            </p>
            <p className="text-xs text-gray-500 mb-8">
              Your run is published as approved so friends can RSVP right away.
            </p>

            <CreateCityRunForm
              workout={workout}
              onCancel={() => router.push(`/workouts/${workout.id}`)}
              onDone={() => router.push(`/workouts/${workout.id}`)}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
