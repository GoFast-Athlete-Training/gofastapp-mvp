"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Activity } from "lucide-react";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import { auth } from "@/lib/firebase";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { metersToMiDisplay } from "@/lib/training/workout-preview-payload";
import {
  formatPaceTargetRangeDisplay,
  paceRangeDeltaMessage,
  singleTargetPaceDeltaMessage,
} from "@/lib/training/pace-comparison-display";

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
};

type MatchedWorkoutPayload = {
  id: string;
  title: string;
  workoutType: string;
  actualDistanceMeters: number | null;
  actualAvgPaceSecPerMile: number | null;
  actualDurationSeconds: number | null;
  paceDeltaSecPerMile: number | null;
  targetPaceSecPerMile: number | null;
  targetPaceSecPerMileHigh: number | null;
  hrDeltaBpm: number | null;
  creditedFiveKPaceSecPerMile: number | null;
  segments: Array<{
    id: string;
    stepOrder: number;
    title: string;
    actualPaceSecPerMile: number | null;
    actualDistanceMiles: number | null;
    actualDurationSeconds: number | null;
  }>;
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
  const [matched, setMatched] = useState<MatchedWorkoutPayload | null>(null);

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
        matchedWorkout?: MatchedWorkoutPayload | null;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Could not load activity");
        setActivity(null);
        setMatched(null);
        return;
      }
      setActivity(json.activity ?? null);
      setMatched(json.matchedWorkout ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load activity");
      setActivity(null);
      setMatched(null);
    } finally {
      setLoading(false);
    }
  }, [activityId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const avgPace = activity ? speedMpsToSecPerMile(activity.averageSpeed) : null;
  const distMi =
    activity?.distance != null && activity.distance > 0
      ? metersToMiDisplay(activity.distance)
      : null;
  const durMin =
    activity?.duration != null && activity.duration > 0
      ? Math.round(activity.duration / 60)
      : null;

  const segWithActuals =
    matched?.segments?.filter(
      (s) =>
        s.actualPaceSecPerMile != null ||
        s.actualDistanceMiles != null ||
        s.actualDurationSeconds != null
    ) ?? [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
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

                {matched ? (
                  <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-6 mb-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-900 mb-1">
                      Linked plan workout
                    </h2>
                    <p className="text-lg font-bold text-gray-900">{matched.title}</p>
                    <p className="text-sm text-gray-600 capitalize mb-4">
                      {String(matched.workoutType).toLowerCase()}
                    </p>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {matched.targetPaceSecPerMile != null ? (
                        <div>
                          <dt className="text-gray-500">Target pace</dt>
                          <dd className="font-medium text-gray-900 tabular-nums">
                            {formatPaceTargetRangeDisplay(
                              matched.targetPaceSecPerMile,
                              matched.targetPaceSecPerMileHigh
                            ) ?? formatSecPerMile(matched.targetPaceSecPerMile)}
                          </dd>
                        </div>
                      ) : null}
                      {matched.actualAvgPaceSecPerMile != null ? (
                        <div>
                          <dt className="text-gray-500">Your pace</dt>
                          <dd className="font-medium text-gray-900 tabular-nums">
                            {formatSecPerMile(matched.actualAvgPaceSecPerMile)}
                          </dd>
                        </div>
                      ) : null}
                      {matched.paceDeltaSecPerMile != null ||
                      matched.actualAvgPaceSecPerMile != null ? (
                        <div className="sm:col-span-2">
                          <dt className="text-gray-500">Vs plan</dt>
                          <dd className="font-medium text-gray-900">
                            {matched.targetPaceSecPerMile != null &&
                            matched.targetPaceSecPerMileHigh != null &&
                            matched.targetPaceSecPerMileHigh !== matched.targetPaceSecPerMile &&
                            matched.actualAvgPaceSecPerMile != null
                              ? paceRangeDeltaMessage(
                                  matched.actualAvgPaceSecPerMile,
                                  matched.targetPaceSecPerMile,
                                  matched.targetPaceSecPerMileHigh
                                ) ?? "—"
                              : singleTargetPaceDeltaMessage(matched.paceDeltaSecPerMile) ?? "—"}
                          </dd>
                        </div>
                      ) : null}
                      {matched.hrDeltaBpm != null ? (
                        <div>
                          <dt className="text-gray-500">Vs target HR</dt>
                          <dd className="font-medium text-gray-900">
                            {matched.hrDeltaBpm > 0
                              ? `${matched.hrDeltaBpm} bpm under zone`
                              : matched.hrDeltaBpm < 0
                                ? `${Math.abs(matched.hrDeltaBpm)} bpm above zone`
                                : "On target"}
                          </dd>
                        </div>
                      ) : null}
                      {matched.creditedFiveKPaceSecPerMile != null &&
                      matched.creditedFiveKPaceSecPerMile > 0 ? (
                        <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-white/80 px-3 py-2">
                          <dt className="text-gray-500 text-xs">Implied 5K pace (credit signal)</dt>
                          <dd className="font-semibold text-emerald-950 tabular-nums">
                            {formatSecPerMile(matched.creditedFiveKPaceSecPerMile)}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    <Link
                      href={`/workouts/${matched.id}`}
                      className="mt-4 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700"
                    >
                      Open workout →
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 mb-6">
                    <h2 className="text-sm font-semibold text-gray-900 mb-1">No plan match</h2>
                    <p className="text-sm text-gray-600">
                      This activity isn&apos;t linked to a scheduled workout yet. If it was an easy
                      day or a one-off, that&apos;s normal. Quality sessions from your plan usually
                      match automatically when the date and Garmin workout line up.
                    </p>
                  </div>
                )}

                {segWithActuals.length > 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-6">
                    <h2 className="text-base font-semibold text-gray-900 mb-3">
                      Segment actuals (from laps)
                    </h2>
                    <ul className="space-y-3">
                      {segWithActuals.map((s) => (
                        <li
                          key={s.id}
                          className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-gray-900">
                            {s.stepOrder}. {s.title}
                          </span>
                          <div className="mt-1 text-gray-700 space-x-3">
                            {s.actualPaceSecPerMile != null ? (
                              <span>Pace {formatSecPerMile(s.actualPaceSecPerMile)}</span>
                            ) : null}
                            {s.actualDistanceMiles != null ? (
                              <span>{s.actualDistanceMiles.toFixed(2)} mi</span>
                            ) : null}
                            {s.actualDurationSeconds != null ? (
                              <span>{Math.round(s.actualDurationSeconds / 60)} min</span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
