"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Send, CheckCircle2, AlertCircle, X } from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import api from "@/lib/api";
import {
  formatPaceTargetRangeForDisplay,
  formatStoredPaceAsMinPerMile,
} from "@/lib/workout-generator/pace-calculator";

interface WorkoutSegment {
  id: string;
  stepOrder: number;
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: number;
  targets?: Array<{
    type: string;
    valueLow?: number;
    valueHigh?: number;
    value?: number;
  }>;
  repeatCount?: number;
  notes?: string;
}

interface Workout {
  id: string;
  title: string;
  workoutType: string;
  description?: string;
  garminWorkoutId?: number | null;
  segments: WorkoutSegment[];
}

function formatTargetLine(target: NonNullable<WorkoutSegment["targets"]>[0]): string {
  const type = (target.type || "").toUpperCase();
  if (type === "PACE") {
    if (target.valueLow !== undefined && target.valueHigh !== undefined) {
      return formatPaceTargetRangeForDisplay(target.valueLow, target.valueHigh);
    }
    if (target.value !== undefined) {
      return `${formatStoredPaceAsMinPerMile(target.value)} /mi`;
    }
  }
  if (type === "HEART_RATE") {
    if (target.valueLow !== undefined && target.valueHigh !== undefined) {
      return `${target.valueLow}–${target.valueHigh} bpm`;
    }
    if (target.value !== undefined) return `${target.value} bpm`;
  }
  if (target.valueLow !== undefined && target.valueHigh !== undefined) {
    return `${target.valueLow} – ${target.valueHigh}`;
  }
  if (target.value !== undefined) return String(target.value);
  return "—";
}

export default function WorkoutDetailPage() {
  const router = useRouter();
  const params = useParams();
  const workoutId = params.id as string;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<{
    success: boolean;
    message: string;
    garminWorkoutId?: number;
  } | null>(null);
  const [showCreatedBanner, setShowCreatedBanner] = useState(false);
  const [garminToast, setGarminToast] = useState<string | null>(null);

  const clearCreatedQuery = useCallback(() => {
    router.replace(`/workouts/${workoutId}`, { scroll: false });
  }, [router, workoutId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("created") === "1") {
      setShowCreatedBanner(true);
      clearCreatedQuery();
    }
  }, [clearCreatedQuery]);

  useEffect(() => {
    if (!garminToast) return;
    const t = setTimeout(() => setGarminToast(null), 8000);
    return () => clearTimeout(t);
  }, [garminToast]);

  useEffect(() => {
    fetchWorkout();
  }, [workoutId]);

  const fetchWorkout = async () => {
    try {
      const response = await api.get("workouts");
      const { workouts } = response.data;
      const found = workouts.find((w: Workout) => w.id === workoutId);
      if (found) {
        setWorkout(found);
      } else {
        setPushStatus({
          success: false,
          message: "Workout not found",
        });
      }
    } catch (error: unknown) {
      console.error("Error fetching workout:", error);
      const err = error as { response?: { data?: { error?: string } } };
      setPushStatus({
        success: false,
        message: err.response?.data?.error || "Failed to fetch workout",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePushToGarmin = async () => {
    if (!workout) return;

    setPushing(true);
    setPushStatus(null);

    try {
      const response = await api.post(`workouts/${workoutId}/push-to-garmin`);
      const { garminWorkoutId } = response.data as { garminWorkoutId?: number };

      setPushStatus({
        success: true,
        message: "Workout sent to Garmin successfully.",
        garminWorkoutId,
      });
      setGarminToast(
        garminWorkoutId
          ? `Synced to Garmin. Open Garmin Connect to view it on your device (workout #${garminWorkoutId}).`
          : "Synced to Garmin. Open Garmin Connect on your watch or phone to use this workout."
      );
      setWorkout((prev) =>
        prev ? { ...prev, garminWorkoutId: garminWorkoutId ?? prev.garminWorkoutId } : prev
      );
    } catch (error: unknown) {
      console.error("Error pushing to Garmin:", error);
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      setPushStatus({
        success: false,
        message:
          err.response?.data?.error ||
          err.response?.data?.details ||
          "Failed to push workout to Garmin",
      });
    } finally {
      setPushing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Workout not found</p>
            <Link
              href="/workouts"
              className="mt-4 inline-block text-orange-600 hover:text-orange-700"
            >
              Back to Workouts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const alreadyOnGarmin =
    workout.garminWorkoutId != null && workout.garminWorkoutId !== undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />

      {/* Post-create success */}
      {showCreatedBanner && (
        <div
          className="bg-green-600 text-white px-4 py-3 shadow-md"
          role="status"
          aria-live="polite"
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm sm:text-base font-medium">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              Workout saved. You can send it to Garmin when you&apos;re ready.
            </div>
            <button
              type="button"
              onClick={() => setShowCreatedBanner(false)}
              className="p-1 rounded-md hover:bg-white/10 shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Garmin push toast */}
      {garminToast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-green-200 bg-white px-4 py-3 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-800 flex-1">{garminToast}</p>
            <button
              type="button"
              onClick={() => setGarminToast(null)}
              className="text-gray-400 hover:text-gray-700 p-0.5"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/workouts"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Workouts
        </Link>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 break-words">
                {workout.title}
              </h1>
              {workout.description && (
                <p className="text-gray-600 mb-4 break-words">{workout.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                  {workout.workoutType}
                </span>
                {alreadyOnGarmin && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-800 rounded-full text-sm font-medium border border-green-200">
                    <CheckCircle2 className="w-4 h-4" />
                    On Garmin
                    {workout.garminWorkoutId != null ? ` (#${workout.garminWorkoutId})` : ""}
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 w-full sm:w-auto">
              {alreadyOnGarmin ? (
                <button
                  type="button"
                  disabled
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium cursor-not-allowed border border-gray-200"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Sent to Garmin
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePushToGarmin}
                  disabled={pushing}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pushing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send to Garmin
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {pushStatus && (
            <div
              className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                pushStatus.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
              role={pushStatus.success ? "status" : "alert"}
            >
              {pushStatus.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium ${
                    pushStatus.success ? "text-green-800" : "text-red-800"
                  }`}
                >
                  {pushStatus.message}
                </p>
                {pushStatus.garminWorkoutId != null && pushStatus.success && (
                  <p className="text-sm text-green-700 mt-1">
                    Garmin workout id: {pushStatus.garminWorkoutId}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Segments</h2>

          {workout.segments && workout.segments.length > 0 ? (
            <div className="space-y-4">
              {workout.segments
                .sort((a, b) => a.stepOrder - b.stepOrder)
                .map((segment) => (
                  <div
                    key={segment.id}
                    className="border border-gray-200 rounded-lg p-4 sm:p-5 bg-gray-50"
                  >
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {segment.stepOrder}. {segment.title}
                      </h3>
                      {segment.repeatCount != null && segment.repeatCount > 1 && (
                        <p className="text-sm text-gray-600 mt-1">
                          Repeat {segment.repeatCount}×
                        </p>
                      )}
                    </div>

                    <dl className="space-y-4">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                          Duration
                        </dt>
                        <dd className="text-base text-gray-900 font-medium">
                          {segment.durationType === "DISTANCE"
                            ? `${segment.durationValue} miles`
                            : `${segment.durationValue} minutes`}
                        </dd>
                      </div>

                      {segment.targets && segment.targets.length > 0 && (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Targets
                          </dt>
                          <dd className="space-y-2">
                            {segment.targets.map((target, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-base"
                              >
                                <span className="text-gray-600 shrink-0 sm:min-w-[7rem]">
                                  {(target.type || "Target").toUpperCase()}
                                </span>
                                <span className="text-gray-900 font-medium break-words">
                                  {formatTargetLine(target)}
                                </span>
                              </div>
                            ))}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {segment.notes && (
                      <p className="text-sm text-gray-600 mt-4 italic border-t border-gray-200 pt-3">
                        {segment.notes}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-600">No segments defined</p>
          )}
        </div>
      </div>
    </div>
  );
}
