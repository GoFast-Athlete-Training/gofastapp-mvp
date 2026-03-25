"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Send, CheckCircle2, AlertCircle, X, Plug, Users } from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
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

interface MatchedActivitySummary {
  id: string;
  activityName: string | null;
  activityType: string | null;
  startTime: string | null;
  ingestionStatus: string;
  distance: number | null;
  duration: number | null;
  averageSpeed: number | null;
}

interface Workout {
  id: string;
  title: string;
  workoutType: string;
  description?: string;
  date?: string | null;
  garminWorkoutId?: number | null;
  segments: WorkoutSegment[];
  matchedActivityId?: string | null;
  actualDistanceMeters?: number | null;
  actualAvgPaceSecPerMile?: number | null;
  actualDurationSeconds?: number | null;
  derivedPerformanceDeltaSeconds?: number | null;
  derivedPerformanceDirection?: string | null;
  evaluationEligibleFlag?: boolean;
  matched_activity?: MatchedActivitySummary | null;
  training_plans?: {
    id: string;
    name: string;
    totalWeeks: number;
    currentFiveKPace?: string | null;
    lifecycleStatus?: string;
  } | null;
}

function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")} /mi`;
}

function formatWorkoutScheduleLong(iso: string | null | undefined): string | null {
  if (iso == null || iso === "") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
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
  const [connectingGarminTest, setConnectingGarminTest] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMeetup, setShareMeetup] = useState("Meetup details TBD — see run description");
  const [shareRunDate, setShareRunDate] = useState("");
  const [shareMeetupCity, setShareMeetupCity] = useState("");
  const [shareMeetupState, setShareMeetupState] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareRunId, setShareRunId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!showShareModal || !workout) return;
    const d = workout.date ? new Date(workout.date) : new Date();
    setShareRunDate(
      !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    );
    setShareError(null);
    setShareRunId(null);
    const aid = LocalStorageAPI.getAthleteId();
    if (!aid) return;
    (async () => {
      try {
        const { data } = await api.get(`/athlete/${aid}`);
        const a = data?.athlete;
        if (a) {
          setShareMeetupCity(a.city || "");
          setShareMeetupState(a.state || "");
        }
      } catch {
        /* ignore */
      }
    })();
  }, [showShareModal, workout]);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const t = ev.data?.type;
      if (t === "GARMIN_TEST_OAUTH_SUCCESS") {
        setGarminToast("Garmin test account linked. You can send this workout to Garmin.");
      }
      if (t === "GARMIN_TEST_OAUTH_ERROR") {
        setPushStatus({
          success: false,
          message: typeof ev.data?.error === "string" ? ev.data.error : "Garmin test connection failed.",
        });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const fetchWorkout = async () => {
    try {
      const response = await api.get<{ workout: Workout }>(`/training/workout/${workoutId}`);
      const w = response.data?.workout;
      if (w) {
        setWorkout(w);
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
      void fetchWorkout();
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

  const openShareJoinModal = () => {
    setShowShareModal(true);
  };

  const submitShareAsCityRun = async () => {
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId || !workout) {
      setShareError("Sign in and open this page from the app so your athlete id is available.");
      return;
    }
    if (!shareMeetupCity.trim()) {
      setShareError("City is required so the run can be listed (same as city runs).");
      return;
    }
    setShareBusy(true);
    setShareError(null);
    try {
      const dateIso = new Date(`${shareRunDate}T12:00:00`).toISOString();
      const { data } = await api.post("runs/create", {
        athleteGeneratedId: athleteId,
        title: workout.title,
        date: dateIso,
        meetUpPoint: shareMeetup.trim() || "Meetup TBD",
        meetUpCity: shareMeetupCity.trim() || undefined,
        meetUpState: shareMeetupState.trim() || undefined,
        cityName: shareMeetupCity.trim() || undefined,
        state: shareMeetupState.trim() || undefined,
        workoutId: workout.id,
        workoutDescription: (workout.description || "").slice(0, 2000),
      });
      if (data?.success && data?.cityRunId) {
        setShareRunId(data.cityRunId as string);
      } else {
        setShareError(
          (data as { error?: string })?.error || "Could not create run"
        );
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setShareError(err.response?.data?.error || "Could not create run");
    } finally {
      setShareBusy(false);
    }
  };

  const handleConnectGarminTest = async () => {
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      setPushStatus({
        success: false,
        message: "Missing athlete id. Open the app from a signed-in session so your profile loads.",
      });
      return;
    }
    setConnectingGarminTest(true);
    setPushStatus(null);
    try {
      const { data } = await api.get<{
        success?: boolean;
        authUrl?: string;
        error?: string;
      }>("auth/garmin-test/authorize", { params: { athleteId } });
      if (!data.success || !data.authUrl) {
        setPushStatus({
          success: false,
          message: data.error || "Could not start Garmin test OAuth.",
        });
        return;
      }
      window.open(data.authUrl, "garmin-test-oauth", "width=600,height=700,scrollbars=yes");
    } catch (e: unknown) {
      console.error("Garmin test authorize:", e);
      const err = e as { response?: { data?: { error?: string } } };
      setPushStatus({
        success: false,
        message: err.response?.data?.error || "Could not start Garmin test OAuth.",
      });
    } finally {
      setConnectingGarminTest(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopNav />
        <div className="flex flex-1 overflow-hidden">
          <AthleteSidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopNav />
        <div className="flex flex-1 overflow-hidden">
          <AthleteSidebar />
          <main className="flex-1 overflow-y-auto">
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
          </main>
        </div>
      </div>
    );
  }

  const alreadyOnGarmin =
    workout.garminWorkoutId != null && workout.garminWorkoutId !== undefined;

  const scheduleLabel = formatWorkoutScheduleLong(workout.date);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto relative">
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
              {scheduleLabel && (
                <p className="text-lg text-gray-700 font-medium mb-2">{scheduleLabel}</p>
              )}
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
                {workout.matchedActivityId && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-900 rounded-full text-sm font-medium border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4" />
                    Logged (matched activity)
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 w-full sm:w-auto flex flex-col gap-2">
              <button
                type="button"
                onClick={openShareJoinModal}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 border border-sky-600 text-sky-700 bg-white hover:bg-sky-50 rounded-lg font-medium transition-colors"
              >
                <Users className="w-5 h-5" />
                Share / Join me
              </button>
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
              <button
                type="button"
                onClick={handleConnectGarminTest}
                disabled={connectingGarminTest}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connectingGarminTest ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
                    Opening…
                  </>
                ) : (
                  <>
                    <Plug className="w-4 h-4" />
                    Connect Garmin (Test)
                  </>
                )}
              </button>
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

        {showShareModal && (
          <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-join-title"
          >
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6">
              <div className="flex items-start justify-between gap-2 mb-4">
                <h2 id="share-join-title" className="text-lg font-semibold text-gray-900">
                  Create a joinable run
                </h2>
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Creates a CityRun linked to this workout so friends can RSVP on{" "}
                <span className="font-medium">/gorun</span> like any other run.
              </p>
              {shareRunId ? (
                <div className="space-y-3">
                  <p className="text-green-800 font-medium text-sm">Run created.</p>
                  <Link
                    href={`/gorun/${shareRunId}`}
                    className="inline-block text-orange-600 hover:text-orange-700 font-semibold text-sm"
                  >
                    Open run & RSVP →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    className="block w-full mt-2 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Run date
                    </label>
                    <input
                      type="date"
                      value={shareRunDate}
                      onChange={(e) => setShareRunDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Meet-up description
                    </label>
                    <textarea
                      value={shareMeetup}
                      onChange={(e) => setShareMeetup(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={shareMeetupCity}
                        onChange={(e) => setShareMeetupCity(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={shareMeetupState}
                        onChange={(e) => setShareMeetupState(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    City/state set the run&apos;s public location slug. Prefilled from your profile when possible.
                  </p>
                  {shareError && (
                    <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {shareError}
                    </p>
                  )}
                  <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowShareModal(false)}
                      className="flex-1 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitShareAsCityRun}
                      disabled={shareBusy}
                      className="flex-1 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50"
                    >
                      {shareBusy ? "Creating…" : "Create CityRun"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {(workout.matchedActivityId || workout.matched_activity) && (
          <div className="bg-white rounded-lg border border-emerald-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Completed run</h2>
            <p className="text-sm text-gray-600 mb-4">
              This plan workout was linked to an activity from your watch (Garmin sync). Targets below
              are compared when pace data is available.
            </p>
            {workout.matched_activity && (
              <div className="text-sm text-gray-700 mb-4 space-y-1">
                <p>
                  <span className="font-medium text-gray-900">Activity:</span>{" "}
                  {workout.matched_activity.activityName || "Run"} ·{" "}
                  {workout.matched_activity.startTime
                    ? new Date(workout.matched_activity.startTime).toLocaleString()
                    : "—"}
                </p>
                <p>
                  <span className="font-medium text-gray-900">Ingest status:</span>{" "}
                  {workout.matched_activity.ingestionStatus}
                </p>
              </div>
            )}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {workout.actualDistanceMeters != null && workout.actualDistanceMeters > 0 && (
                <div>
                  <dt className="text-gray-500">Distance</dt>
                  <dd className="font-medium text-gray-900">
                    {(workout.actualDistanceMeters / 1609.34).toFixed(2)} mi
                  </dd>
                </div>
              )}
              {formatSecPerMile(workout.actualAvgPaceSecPerMile) && (
                <div>
                  <dt className="text-gray-500">Avg pace</dt>
                  <dd className="font-medium text-gray-900">
                    {formatSecPerMile(workout.actualAvgPaceSecPerMile)}
                  </dd>
                </div>
              )}
              {workout.actualDurationSeconds != null && workout.actualDurationSeconds > 0 && (
                <div>
                  <dt className="text-gray-500">Duration</dt>
                  <dd className="font-medium text-gray-900">
                    {Math.round(workout.actualDurationSeconds / 60)} min
                  </dd>
                </div>
              )}
              {workout.derivedPerformanceDeltaSeconds != null && (
                <div>
                  <dt className="text-gray-500">Vs main target (pace)</dt>
                  <dd className="font-medium text-gray-900">
                    {workout.derivedPerformanceDeltaSeconds > 0
                      ? `${workout.derivedPerformanceDeltaSeconds}s/mi faster than target`
                      : workout.derivedPerformanceDeltaSeconds < 0
                        ? `${Math.abs(workout.derivedPerformanceDeltaSeconds)}s/mi slower than target`
                        : "On target"}
                    {workout.derivedPerformanceDirection
                      ? ` (${workout.derivedPerformanceDirection})`
                      : ""}
                  </dd>
                </div>
              )}
            </dl>
            {workout.training_plans?.currentFiveKPace && (
              <p className="text-xs text-gray-500 mt-4">
                Plan baseline 5K (snapshot): {workout.training_plans.currentFiveKPace}
              </p>
            )}
          </div>
        )}

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
        </main>
      </div>
    </div>
  );
}
