"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Activity, Flag } from "lucide-react";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import ActivityRouteMap from "@/components/activities/ActivityRouteMap";
import ActivityAddStuffPanel from "@/components/activities/ActivityAddStuffPanel";
import MarkActivityAsRaceSheet from "@/components/races/MarkActivityAsRaceSheet";
import { auth } from "@/lib/firebase";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { LocalStorageAPI } from "@/lib/localstorage";
import type { ActivityPostOwnerPayload } from "@/lib/gofast-with-me/activity-posts";
import { metersToMiDisplay } from "@/lib/training/workout-preview-payload";

type ActivityPayload = {
  id: string;
  activityType: string | null;
  activityName: string | null;
  startTime: string | null;
  duration: number | null;
  distance: number | null;
  calories: number | null;
  averageSpeed: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGain: number | null;
  steps: number | null;
  ingestionStatus: string;
  source: string;
  summaryPolyline?: string | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  endLatitude?: number | null;
  endLongitude?: number | null;
};

type DerivedLapPayload = {
  lapIndex: number;
  durationSeconds: number;
  distanceMiles: number | null;
  avgPaceSecPerMile: number | null;
  avgHeartRate: number | null;
};

function formatSecPerMile(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

function speedMpsToSecPerMile(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  return Math.round(1609.34 / mps);
}

export default function ActivityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const activityId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityPayload | null>(null);
  const [derivedLaps, setDerivedLaps] = useState<DerivedLapPayload[]>([]);
  const [hasDetail, setHasDetail] = useState(false);
  const [markRaceOpen, setMarkRaceOpen] = useState(false);
  const [hubPost, setHubPost] = useState<ActivityPostOwnerPayload | null>(null);
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const u = auth.currentUser;
      if (!u) {
        router.replace("/welcome");
        return;
      }
      const token = await u.getIdToken();
      const res = await fetch(`/api/activities/${encodeURIComponent(activityId)}`, {
        headers: athleteBearerFetchHeaders(token),
      });
      const json = (await res.json()) as {
        activity?: ActivityPayload;
        derivedLaps?: DerivedLapPayload[];
        hasDetail?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Could not load activity");
        setActivity(null);
        setDerivedLaps([]);
        setHasDetail(false);
        return;
      }
      setActivity(json.activity ?? null);
      setDerivedLaps(json.derivedLaps ?? []);
      setHasDetail(json.hasDetail ?? false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load activity");
      setActivity(null);
    } finally {
      setLoading(false);
    }
  }, [activityId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    setAthleteId(id);
    if (!id) return;
    void (async () => {
      try {
        const u = auth.currentUser;
        if (!u) return;
        const token = await u.getIdToken();
        const res = await fetch(
          `/api/athlete/${encodeURIComponent(id)}/activity-posts?activityId=${encodeURIComponent(activityId)}`,
          { headers: athleteBearerFetchHeaders(token) }
        );
        const json = (await res.json()) as {
          post?: ActivityPostOwnerPayload | null;
        };
        if (res.ok) setHubPost(json.post ?? null);
      } catch {
        /* optional */
      }
    })();
  }, [activityId]);

  async function handleDeleteActivity() {
    if (
      !window.confirm(
        "Delete this bad GoFast activity row? This does not delete it from Garmin."
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const res = await fetch(`/api/activities/${encodeURIComponent(activityId)}`, {
        method: "DELETE",
        headers: athleteBearerFetchHeaders(token),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Could not delete activity");
        return;
      }
      router.push("/activities");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete activity");
    } finally {
      setDeleting(false);
    }
  }

  const avgPace = activity ? speedMpsToSecPerMile(activity.averageSpeed) : null;
  const distMi =
    activity?.distance != null && activity.distance > 0
      ? metersToMiDisplay(activity.distance)
      : null;
  const durMin =
    activity?.duration != null && activity.duration > 0
      ? Math.round(activity.duration / 60)
      : null;

  const isRun =
    activity?.activityType != null &&
    /run|jog|walk|trail|track/i.test(activity.activityType);
  const hasRoute = Boolean(
    activity?.summaryPolyline ||
      (activity?.startLatitude != null && activity?.startLongitude != null)
  );

  const activityLabel =
    activity?.activityName?.trim() ||
    activity?.activityType?.replace(/_/g, " ") ||
    "Activity";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <Link
              href="/activities"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              Activities
            </Link>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
                {error}
              </div>
            ) : !activity ? (
              <p className="text-gray-600">Activity not found.</p>
            ) : (
              <>
                <div className="flex items-start gap-3 mb-6">
                  <div className="rounded-xl bg-orange-100 p-3">
                    <Activity className="w-8 h-8 text-orange-700" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-gray-900 break-words">
                      {activity.activityName?.trim() ||
                        activity.activityType?.replace(/_/g, " ") ||
                        "Activity"}
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                      {activity.startTime
                        ? new Date(activity.startTime).toLocaleString(undefined, {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                      <span className="text-gray-400"> · </span>
                      {activity.source}
                      <span className="text-gray-400"> · </span>
                      {activity.ingestionStatus}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                  {distMi ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-medium text-gray-500">Distance</p>
                      <p className="text-lg font-semibold text-gray-900 tabular-nums">{distMi}</p>
                    </div>
                  ) : null}
                  {avgPace != null ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-medium text-gray-500">Avg pace</p>
                      <p className="text-lg font-semibold text-gray-900 tabular-nums">
                        {formatSecPerMile(avgPace)}
                      </p>
                    </div>
                  ) : null}
                  {durMin != null ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-medium text-gray-500">Duration</p>
                      <p className="text-lg font-semibold text-gray-900 tabular-nums">
                        {durMin} min
                      </p>
                    </div>
                  ) : null}
                  {activity.averageHeartRate != null ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-medium text-gray-500">Avg HR</p>
                      <p className="text-lg font-semibold text-gray-900 tabular-nums">
                        {activity.averageHeartRate} bpm
                      </p>
                    </div>
                  ) : null}
                  {activity.maxHeartRate != null ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-medium text-gray-500">Max HR</p>
                      <p className="text-lg font-semibold text-gray-900 tabular-nums">
                        {activity.maxHeartRate} bpm
                      </p>
                    </div>
                  ) : null}
                  {activity.calories != null ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-medium text-gray-500">Calories</p>
                      <p className="text-lg font-semibold text-gray-900 tabular-nums">
                        {activity.calories}
                      </p>
                    </div>
                  ) : null}
                  {activity.elevationGain != null && activity.elevationGain > 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-medium text-gray-500">Elev gain</p>
                      <p className="text-lg font-semibold text-gray-900 tabular-nums">
                        {Math.round(activity.elevationGain)} m
                      </p>
                    </div>
                  ) : null}
                </div>

                {hasRoute && activity ? (
                  <div className="mb-8">
                    <h2 className="text-base font-semibold text-gray-900 mb-3">Route</h2>
                    <ActivityRouteMap
                      summaryPolyline={activity.summaryPolyline ?? null}
                      startLatitude={activity.startLatitude}
                      startLongitude={activity.startLongitude}
                      endLatitude={activity.endLatitude}
                      endLongitude={activity.endLongitude}
                    />
                  </div>
                ) : null}

                {athleteId ? (
                  <ActivityAddStuffPanel
                    athleteId={athleteId}
                    activityId={activityId}
                    activityLabel={activityLabel}
                    existingPost={hubPost}
                    onPublished={(post) => setHubPost(post)}
                  />
                ) : null}

                <div className="mb-8">
                  <h2 className="text-base font-semibold text-gray-900 mb-3">Laps</h2>
                  {hasDetail && derivedLaps.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                      <div className="grid grid-cols-5 gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 text-[11px] font-semibold uppercase text-gray-500">
                        <span>Lap</span>
                        <span>Time</span>
                        <span>Dist</span>
                        <span className="col-span-2">Pace</span>
                      </div>
                      {derivedLaps.map((lap) => (
                        <div
                          key={lap.lapIndex}
                          className="grid grid-cols-5 gap-2 border-b border-gray-100 px-4 py-2 text-sm last:border-b-0"
                        >
                          <span className="font-medium text-gray-900">{lap.lapIndex}</span>
                          <span className="tabular-nums text-gray-700">
                            {lap.durationSeconds > 0
                              ? `${Math.floor(lap.durationSeconds / 60)}:${String(
                                  Math.round(lap.durationSeconds % 60)
                                ).padStart(2, "0")}`
                              : "—"}
                          </span>
                          <span className="tabular-nums text-gray-700">
                            {lap.distanceMiles != null ? `${lap.distanceMiles.toFixed(2)} mi` : "—"}
                          </span>
                          <span className="col-span-2 tabular-nums text-gray-700">
                            {lap.avgPaceSecPerMile != null && isRun
                              ? formatSecPerMile(lap.avgPaceSecPerMile)
                              : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-4 text-sm text-gray-600">
                      {hasDetail
                        ? "No lap data in this activity."
                        : "Waiting on Garmin detail sync for lap breakdown…"}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-violet-100 p-2 text-violet-800">
                        <Flag className="w-5 h-5 shrink-0" aria-hidden />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-gray-900">Race day?</h2>
                        <p className="text-sm text-gray-600 mt-0.5">
                          Tie this Garmin activity to a race in our catalog — we&apos;ll use the
                          activity duration as your finish time (you can still enter an official time
                          from the race hub).
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMarkRaceOpen(true)}
                      className="shrink-0 inline-flex justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                    >
                      Log as race
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-red-100 bg-red-50/40 p-5">
                  <h2 className="text-sm font-semibold text-red-900">Remove from GoFast</h2>
                  <p className="mt-1 text-sm text-red-800/90">
                    Delete this bad GoFast activity row? This does not delete it from Garmin.
                  </p>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleDeleteActivity()}
                    className="mt-3 inline-flex rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete bad GoFast row"}
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <MarkActivityAsRaceSheet
        open={markRaceOpen}
        onClose={() => setMarkRaceOpen(false)}
        activityId={activityId}
        durationSeconds={activity?.duration ?? null}
        activityLabel={activityLabel}
      />
    </div>
  );
}
