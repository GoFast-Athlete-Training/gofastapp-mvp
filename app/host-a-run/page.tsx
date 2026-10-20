"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import CreateCityRunForm, {
  type CreateCityRunFormWorkout,
} from "@/components/cityruns/CreateCityRunForm";
import CityRunMeetupOnlyForm, {
  type CityRunMeetupTemplate,
} from "@/components/cityruns/CityRunMeetupOnlyForm";
import HostRunCreateFork from "@/components/runs/HostRunCreateFork";
import HostedRunInvitesPanel from "@/components/runs/HostedRunInvitesPanel";
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
  const fromRunIdParam = searchParams.get("fromRunId")?.trim() || null;

  const [createStarted, setCreateStarted] = useState(Boolean(fromRunIdParam || workoutIdParam));
  const [workout, setWorkout] = useState<CreateCityRunFormWorkout | null>(null);
  const [template, setTemplate] = useState<CityRunMeetupTemplate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(workoutIdParam || fromRunIdParam));
  const [inviteReady, setInviteReady] = useState(false);

  const showCreateLanding = !createStarted && !workoutIdParam && !inviteReady;

  const ensureHostWorkout = useCallback(async () => {
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
          meetUpNote: (inv.meetUpNote as string | null) ?? null,
          routeNeighborhood: (inv.routeNeighborhood as string | null) ?? null,
          totalMiles: (inv.totalMiles as number | null) ?? null,
          pace: (inv.pace as string | null) ?? null,
          startTimeHour: (inv.startTimeHour as number | null) ?? null,
          startTimeMinute: (inv.startTimeMinute as number | null) ?? null,
          startTimePeriod: (inv.startTimePeriod as string | null) ?? null,
        });
        setCreateStarted(true);
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
      setCreateStarted(true);
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
    void ensureHostWorkout();
  }, [ensureHostWorkout]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex items-start gap-3 mb-6">
              <div className="rounded-xl bg-orange-100 p-3">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {inviteReady ? "Invite ready" : "Create a run"}
                </h1>
                <p className="mt-1 text-gray-600 max-w-xl">
                  {inviteReady
                    ? "Share the link, attach a route if you want, then manage the run from your dashboard."
                    : "Run home — build the meetup, share the invite, and manage execution after run day."}
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  <Link href="/gorun" className="font-semibold text-orange-700 hover:underline">
                    My upcoming runs
                  </Link>
                </p>
              </div>
            </div>

            {showCreateLanding ? (
              <>
                <HostRunCreateFork
                  onChooseNew={() => {
                    setInviteReady(false);
                    setCreateStarted(true);
                  }}
                  onChooseFromPrevious={(runId) => {
                    setInviteReady(false);
                    router.replace(`/host-a-run?fromRunId=${encodeURIComponent(runId)}`);
                  }}
                />
                <HostedRunInvitesPanel collapsible />
              </>
            ) : null}

            {loading ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
              </div>
            ) : workoutIdParam && (loadError || !workout) ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                <p>{loadError || "Something went wrong"}</p>
              </div>
            ) : workout ? (
              <CreateCityRunForm
                workout={workout}
                initialRouteId={routeIdParam}
                onInviteCreated={() => setInviteReady(true)}
              />
            ) : createStarted ? (
              <CityRunMeetupOnlyForm
                initialRouteId={routeIdParam}
                initialTemplate={template}
                key={fromRunIdParam ?? "new"}
                onInviteCreated={() => setInviteReady(true)}
              />
            ) : null}
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
