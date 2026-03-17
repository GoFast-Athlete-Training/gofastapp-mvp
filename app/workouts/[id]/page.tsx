"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Send, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import api from "@/lib/api";

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
  stravaUrl?: string;
  segments: WorkoutSegment[];
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
    } catch (error: any) {
      console.error("Error fetching workout:", error);
      setPushStatus({
        success: false,
        message: error.response?.data?.error || "Failed to fetch workout",
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
      const { garminWorkoutId } = response.data;

      setPushStatus({
        success: true,
        message: "Successfully pushed to Garmin!",
        garminWorkoutId,
      });
    } catch (error: any) {
      console.error("Error pushing to Garmin:", error);
      setPushStatus({
        success: false,
        message:
          error.response?.data?.error ||
          error.response?.data?.details ||
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

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Back Button */}
        <Link
          href="/workouts"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Workouts
        </Link>

        {/* Workout Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{workout.title}</h1>
              {workout.description && (
                <p className="text-gray-600 mb-4">{workout.description}</p>
              )}
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                  {workout.workoutType}
                </span>
                {workout.stravaUrl && (
                  <a
                    href={workout.stravaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h-5.677L2.098 24.188H7.87l-1.149-2.774 5.15-10.172h-3.066l-1.149-2.774z"/>
                    </svg>
                    View Strava Route
                  </a>
                )}
              </div>
            </div>

            {/* Send to Garmin Button */}
            <button
              onClick={handlePushToGarmin}
              disabled={pushing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pushing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send to Garmin
                </>
              )}
            </button>
          </div>

          {/* Push Status */}
          {pushStatus && (
            <div
              className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                pushStatus.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              {pushStatus.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    pushStatus.success ? "text-green-800" : "text-red-800"
                  }`}
                >
                  {pushStatus.message}
                </p>
                {pushStatus.garminWorkoutId && (
                  <p className="text-sm text-green-700 mt-1">
                    Garmin Workout ID: {pushStatus.garminWorkoutId}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Segments */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Segments</h2>

          {workout.segments && workout.segments.length > 0 ? (
            <div className="space-y-4">
              {workout.segments
                .sort((a, b) => a.stepOrder - b.stepOrder)
                .map((segment) => (
                  <div
                    key={segment.id}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {segment.stepOrder}. {segment.title}
                        </h3>
                        {segment.repeatCount && segment.repeatCount > 1 && (
                          <span className="text-sm text-gray-600 mt-1">
                            Repeat {segment.repeatCount}x
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {/* Duration */}
                      <div>
                        <span className="text-gray-600">Duration: </span>
                        <span className="font-medium text-gray-900">
                          {segment.durationType === "DISTANCE"
                            ? `${segment.durationValue} miles`
                            : `${segment.durationValue} minutes`}
                        </span>
                      </div>

                      {/* Targets */}
                      {segment.targets && segment.targets.length > 0 && (
                        <div>
                          <span className="text-gray-600">Targets: </span>
                          <div className="mt-1 space-y-1">
                            {segment.targets.map((target, idx) => (
                              <div key={idx} className="text-gray-900">
                                <span className="font-medium">{target.type}:</span>{" "}
                                {target.valueLow !== undefined &&
                                target.valueHigh !== undefined
                                  ? `${target.valueLow} - ${target.valueHigh}`
                                  : target.value !== undefined
                                  ? target.value
                                  : "—"}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {segment.notes && (
                      <p className="text-sm text-gray-600 mt-3 italic">{segment.notes}</p>
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
