"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import AthleteHostedRunWizard from "@/components/runs/AthleteHostedRunWizard";
import type { CreateCityRunFormWorkout } from "@/components/cityruns/CreateCityRunForm";
import type { MeetupTemplateSeed } from "@/lib/city-run/athlete-hosted-wizard-map";
import api from "@/lib/api";
import { ensureAthleteIdInStorage } from "@/lib/ensure-athlete-session";

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
}): CreateCityRunFormWorkout {
  return {
    id: w.id,
    title: w.title?.trim() || "Hosted group run",
    workoutType: w.workoutType?.trim() || "Easy",
    description: w.description ?? null,
    date: w.date ?? todayYmd(),
    estimatedDistanceInMeters: w.estimatedDistanceInMeters ?? 5000,
    segments: [],
    city_runs: undefined,
  };
}

function HostARunPageInner() {
  const searchParams = useSearchParams();
  const workoutIdParam = searchParams.get("workoutId")?.trim() || null;
  const routeIdParam = searchParams.get("routeId")?.trim() || null;
  const fromRunIdParam = searchParams.get("fromRunId")?.trim() || null;

  const [workout, setWorkout] = useState<CreateCityRunFormWorkout | null>(null);
  const [template, setTemplate] = useState<MeetupTemplateSeed | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(workoutIdParam || fromRunIdParam));

  const loadSeed = useCallback(async () => {
    if (fromRunIdParam) {
      setLoading(true);
      setLoadError(null);
      try {
        const { data } = await api.get<{ success: boolean; invite: Record<string, unknown> }>(
          `/me/hosted-run-invites/${encodeURIComponent(fromRunIdParam)}`,
        );
        const inv = data?.invite;
        if (!inv) {
          setLoadError("Could not load that prior run.");
          setTemplate(null);
          return;
        }
        setTemplate({
          title: String(inv.title ?? ""),
          description: (inv.description as string | null) ?? null,
          meetUpPoint: String(inv.meetUpPoint ?? ""),
          meetUpStreetAddress: (inv.meetUpStreetAddress as string | null) ?? null,
          meetUpCity: (inv.meetUpCity as string | null) ?? null,
          meetUpState: (inv.meetUpState as string | null) ?? null,
          meetUpZip: (inv.meetUpZip as string | null) ?? null,
          meetUpPlaceId: (inv.meetUpPlaceId as string | null) ?? null,
          meetUpLat: (inv.meetUpLat as number | null) ?? null,
          meetUpLng: (inv.meetUpLng as number | null) ?? null,
          totalMiles: (inv.totalMiles as number | null) ?? null,
          pace: (inv.pace as string | null) ?? null,
          startTimeHour: (inv.startTimeHour as number | null) ?? null,
          startTimeMinute: (inv.startTimeMinute as number | null) ?? null,
          startTimePeriod: (inv.startTimePeriod as string | null) ?? null,
          profileEmoji: (inv.profileEmoji as string | null) ?? null,
          coverPhotoUrl: (inv.coverPhotoUrl as string | null) ?? null,
        });
      } catch {
        setLoadError("Could not load that prior run.");
      } finally {
        setLoading(false);
      }
      return;
    }

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
        `/training/workout/${workoutIdParam}`,
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
  }, [workoutIdParam, fromRunIdParam]);

  useEffect(() => {
    void ensureAthleteIdInStorage();
  }, []);

  useEffect(() => {
    void loadSeed();
  }, [loadSeed]);

  const wizardKey = [fromRunIdParam, workoutIdParam, routeIdParam].filter(Boolean).join("-") || "new";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            {loading ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
              </div>
            ) : loadError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                <p>{loadError}</p>
                <Link href="/gorun" className="mt-3 inline-block text-sm font-semibold underline">
                  Back to Run
                </Link>
              </div>
            ) : (
              <AthleteHostedRunWizard
                key={wizardKey}
                mode="create"
                pageTitle="Create a run"
                backHref="/gorun"
                backLabel="Back to Run"
                initialRouteId={routeIdParam}
                templateSeed={template}
                showCopyFromPrior={!fromRunIdParam}
                trainingWorkout={workout}
              />
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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
        </div>
      }
    >
      <HostARunPageInner />
    </Suspense>
  );
}
