"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import CreateCityRunForm, {
  type CreateCityRunFormWorkout,
} from "@/components/cityruns/CreateCityRunForm";
import CityRunMeetupOnlyForm from "@/components/cityruns/CityRunMeetupOnlyForm";
import HostRunWorkoutSlot from "@/components/runs/HostRunWorkoutSlot";
import api from "@/lib/api";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mapTrainingWorkoutToHostForm(w: {
  id: string;
  title?: string | null;
  workoutType?: string | null;
  description?: string | null;
  date?: string | null;
  estimatedDistanceInMeters?: number | null;
  segments?: CreateCityRunFormWorkout["segments"];
  city_runs?: CreateCityRunFormWorkout["city_runs"];
}): CreateCityRunFormWorkout {
  return {
    id: w.id,
    title: w.title?.trim() || "Hosted group run",
    workoutType: w.workoutType?.trim() || "Easy",
    description: w.description ?? null,
    date: w.date ?? todayYmd(),
    estimatedDistanceInMeters: w.estimatedDistanceInMeters ?? 5000,
    segments: Array.isArray(w.segments) ? w.segments : [],
    city_runs: w.city_runs,
  };
}

function HostARunPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workoutIdParam = searchParams.get("workoutId")?.trim() || null;
  const routeIdParam = searchParams.get("routeId")?.trim() || null;
  const [workout, setWorkout] = useState<CreateCityRunFormWorkout | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(workoutIdParam));

  const ensureHostWorkout = useCallback(async () => {
    if (!workoutIdParam) {
      setWorkout(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await api.get<{ workout: CreateCityRunFormWorkout }>(
        `/training/workout/${workoutIdParam}`
      );
      const w = data?.workout;
      if (!w?.id) {
        setLoadError("Could not load that workout");
        setWorkout(null);
        return;
      }
      setWorkout(mapTrainingWorkoutToHostForm(w));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setLoadError(err.response?.data?.error || "Could not prepare your run");
      setWorkout(null);
    } finally {
      setLoading(false);
    }
  }, [workoutIdParam]);

  useEffect(() => {
    void ensureHostWorkout();
  }, [ensureHostWorkout]);

  function onChooseMeetupOnly() {
    if (workoutIdParam) {
      router.replace("/host-a-run");
    }
  }

  function onWorkoutReady(w: CreateCityRunFormWorkout) {
    router.replace(`/host-a-run?workoutId=${encodeURIComponent(w.id)}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            <Link
              href="/build-a-run"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Run
            </Link>

            <div className="flex items-start gap-3 mb-6">
              <div className="rounded-xl bg-orange-100 p-3">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create a run</h1>
                <p className="mt-1 text-gray-600 max-w-xl">
                  Save the meetup first, share the invite, then optionally attach or create a
                  route — run chat and check-in on run day.
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Need a new saved path?{" "}
                  <Link
                    href="/build-a-run/routes/new"
                    className="font-semibold text-orange-700 hover:underline"
                  >
                    Build a route
                  </Link>
                </p>
              </div>
            </div>

            <HostRunWorkoutSlot
              hasWorkout={Boolean(workoutIdParam && workout)}
              workoutTitle={workout?.title}
              onChooseMeetupOnly={onChooseMeetupOnly}
              onWorkoutReady={onWorkoutReady}
            />

            {loading ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
              </div>
            ) : workoutIdParam && (loadError || !workout) ? (
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
            ) : workout ? (
              <CreateCityRunForm workout={workout} initialRouteId={routeIdParam} />
            ) : (
              <CityRunMeetupOnlyForm initialRouteId={routeIdParam} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function HostARunPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <TopNav />
          <div className="flex flex-1 overflow-hidden min-w-0">
            <AthleteSidebar />
            <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
              </div>
            </main>
          </div>
        </div>
      }
    >
      <HostARunPageInner />
    </Suspense>
  );
}
