"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Send, CheckCircle2, AlertCircle, X, Users } from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";
import InviteCityRunFromWorkoutModal from "@/components/cityruns/InviteCityRunFromWorkoutModal";
import {
  formatPaceTargetRangeForDisplay,
  formatPaceTargetSingleForDisplay,
  getTrainingPaces,
  parsePaceToSecondsPerMile,
  workoutTargetTypeLabel,
} from "@/lib/workout-generator/pace-calculator";
import {
  backHrefFromGoTrainContext,
  backLabelFromGoTrainContext,
  parseGoTrainNavContext,
} from "@/lib/training/workout-nav-query";
import {
  formatStructuredMilesTotal,
  formatStructuredMinutesTotal,
  segmentStructureBadge,
  structuredSegmentTotals,
} from "@/lib/training/segment-summary";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import { formatPlanDateDisplay, ymdFromDate } from "@/lib/training/plan-utils";

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
  actualPaceSecPerMile?: number | null;
  actualDistanceMiles?: number | null;
  actualDurationSeconds?: number | null;
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

interface WorkoutCatalogue {
  id: string;
  name: string;
  workoutType: string;
  intendedPhase: string[];
  progressionIndex: number;
  reps: number | null;
  repDistanceMeters: number | null;
  recoveryDistanceMeters: number | null;
  warmupMiles: number | null;
  cooldownMiles: number | null;
  repPaceOffsetSecPerMile: number | null;
  recoveryPaceOffsetSecPerMile: number | null;
  overallPaceOffsetSecPerMile: number | null;
  intendedHeartRateZone: string | null;
  intendedHRBpmLow: number | null;
  intendedHRBpmHigh: number | null;
  notes: string | null;
}

interface Workout {
  id: string;
  title: string;
  workoutType: string;
  description?: string;
  date?: string | null;
  garminWorkoutId?: number | null;
  catalogueWorkoutId?: string | null;
  workout_catalogue?: WorkoutCatalogue | null;
  estimatedDistanceInMeters?: number | null;
  segments: WorkoutSegment[];
  matchedActivityId?: string | null;
  actualDistanceMeters?: number | null;
  actualAvgPaceSecPerMile?: number | null;
  actualDurationSeconds?: number | null;
  derivedPerformanceDeltaSeconds?: number | null;
  derivedPerformanceDirection?: string | null;
  evaluationEligibleFlag?: boolean;
  matched_activity?: MatchedActivitySummary | null;
  planId?: string | null;
  weekNumber?: number | null;
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

/** Plan/workout dates are calendar days; avoid UTC-midnight → wrong local weekday (see formatPlanDateDisplay). */
function formatWorkoutScheduleLong(iso: string | null | undefined): string | null {
  if (iso == null || iso === "") return null;
  const raw = iso.trim();
  const ymdPrefix =
    raw.length >= 10 && raw[4] === "-" && raw[7] === "-" ? raw.slice(0, 10) : null;
  if (ymdPrefix) {
    return formatPlanDateDisplay(ymdPrefix, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return formatPlanDateDisplay(d.toISOString().slice(0, 10), {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function workoutCalendarYmd(iso: string | null | undefined): string | null {
  if (iso == null || iso === "") return null;
  const raw = iso.trim();
  if (raw.length >= 10 && raw[4] === "-" && raw[7] === "-") return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function dayRelativeToToday(workoutDate: string | null | undefined): "today" | "past" | "future" | "none" {
  const ymd = workoutCalendarYmd(workoutDate);
  if (!ymd) return "none";
  const today = ymdFromDate(new Date());
  if (ymd === today) return "today";
  if (ymd < today) return "past";
  return "future";
}

function estimatedMiDisplay(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return null;
  const mi = meters / 1609.34;
  if (mi >= 10) return `${Math.round(mi)} mi`;
  if (mi >= 1) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi * 5280)} ft`;
}

function paceSecFromAnchor(
  anchor: number,
  offset: number | null | undefined,
  zoneSec: number
): number {
  if (offset == null) return zoneSec;
  return Math.max(1, anchor + offset);
}

function formatPaceMinPerMileFromSec(secPerMile: number): string {
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, "0")} /mi`;
}

function CataloguePrescriptionCard({
  catalogue,
  fiveKPaceSnapshot,
  estimatedDistanceInMeters,
}: {
  catalogue: WorkoutCatalogue;
  fiveKPaceSnapshot: string | null | undefined;
  estimatedDistanceInMeters: number | null | undefined;
}) {
  let anchor: number;
  try {
    if (!fiveKPaceSnapshot?.trim()) {
      return (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Coach prescription</h2>
          <p className="text-sm text-amber-900">
            Set your current 5K pace on your profile (and ensure your plan has a baseline) to see
            target paces for this catalogue workout.
          </p>
        </div>
      );
    }
    anchor = parsePaceToSecondsPerMile(fiveKPaceSnapshot);
  } catch {
    return (
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-6 mb-6">
        <p className="text-sm text-amber-900">Could not read plan 5K pace snapshot for targets.</p>
      </div>
    );
  }

  const p = getTrainingPaces(anchor);
  const totalMi =
    estimatedDistanceInMeters != null && estimatedDistanceInMeters > 0
      ? estimatedDistanceInMeters / 1609.34
      : null;

  const meta = (
    <div className="text-xs text-gray-500 mt-3 space-y-1">
      <p>
        Phases: {catalogue.intendedPhase?.join(", ") || "—"} · Progression #
        {catalogue.progressionIndex}
      </p>
      {catalogue.intendedHeartRateZone && (
        <p>Heart rate: {catalogue.intendedHeartRateZone}</p>
      )}
      {catalogue.notes && <p className="text-gray-600">{catalogue.notes}</p>}
    </div>
  );

  if (catalogue.workoutType === "Intervals") {
    const reps = catalogue.reps ?? 6;
    const repM = catalogue.repDistanceMeters ?? 800;
    const recM = catalogue.recoveryDistanceMeters ?? 400;
    const intSec = paceSecFromAnchor(anchor, catalogue.repPaceOffsetSecPerMile, p.interval);
    const recSec = paceSecFromAnchor(anchor, catalogue.recoveryPaceOffsetSecPerMile, p.recovery);
    return (
      <div className="border border-sky-200 bg-sky-50/60 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Coach prescription</h2>
        <p className="text-lg font-medium text-sky-900 mb-4">{catalogue.name}</p>
        {totalMi != null && (
          <p className="text-sm text-gray-700 mb-3">
            Session distance (approx.): {totalMi.toFixed(1)} mi
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-sky-100 rounded-lg overflow-hidden">
            <thead className="bg-sky-100/80">
              <tr>
                <th className="text-left p-2 font-semibold">Part</th>
                <th className="text-left p-2 font-semibold">Structure</th>
                <th className="text-left p-2 font-semibold">Target pace</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-sky-100">
                <td className="p-2">Main set</td>
                <td className="p-2">
                  {reps} × {repM}m hard, {recM}m recovery
                </td>
                <td className="p-2">
                  {formatPaceMinPerMileFromSec(intSec)} /{" "}
                  {formatPaceMinPerMileFromSec(recSec)} recovery
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {meta}
      </div>
    );
  }

  if (catalogue.workoutType === "Easy") {
    const easySec = paceSecFromAnchor(anchor, catalogue.overallPaceOffsetSecPerMile, p.easy);
    return (
      <div className="border border-slate-200 bg-slate-50 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Coach prescription</h2>
        <p className="text-lg font-medium text-gray-900 mb-2">{catalogue.name}</p>
        {totalMi != null && (
          <p className="text-base text-gray-800">
            {totalMi.toFixed(1)} mi easy · ~{formatPaceMinPerMileFromSec(easySec)}
          </p>
        )}
        {totalMi == null && (
          <p className="text-sm text-gray-600">Easy run — pace ~{formatPaceMinPerMileFromSec(easySec)}</p>
        )}
        {meta}
      </div>
    );
  }

  if (catalogue.workoutType === "Tempo") {
    const tempoSec = paceSecFromAnchor(anchor, catalogue.overallPaceOffsetSecPerMile, p.tempo);
    const easySec = paceSecFromAnchor(anchor, catalogue.recoveryPaceOffsetSecPerMile, p.easy);
    return (
      <div className="border border-indigo-200 bg-indigo-50/50 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Coach prescription</h2>
        <p className="text-lg font-medium text-indigo-950 mb-2">{catalogue.name}</p>
        <ul className="text-sm text-gray-800 list-disc pl-5 space-y-1">
          <li>Warmup / cooldown: easy ~{formatPaceMinPerMileFromSec(easySec)}</li>
          <li>Tempo block: ~{formatPaceMinPerMileFromSec(tempoSec)}</li>
          {totalMi != null && <li>Total scheduled distance ~{totalMi.toFixed(1)} mi</li>}
        </ul>
        {meta}
      </div>
    );
  }

  // LongRun
  const longSec = paceSecFromAnchor(anchor, catalogue.overallPaceOffsetSecPerMile, p.longRun);
  const mpSec = paceSecFromAnchor(anchor, null, p.marathon);
  return (
    <div className="border border-orange-200 bg-orange-50/50 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Coach prescription</h2>
      <p className="text-lg font-medium text-orange-950 mb-2">{catalogue.name}</p>
      <ul className="text-sm text-gray-800 list-disc pl-5 space-y-1">
        <li>Long segment: ~{formatPaceMinPerMileFromSec(longSec)}</li>
        <li>Marathon-pace finish: ~{formatPaceMinPerMileFromSec(mpSec)}</li>
        {totalMi != null && <li>Total ~{totalMi.toFixed(1)} mi</li>}
      </ul>
      {meta}
    </div>
  );
}

function formatTargetLine(target: NonNullable<WorkoutSegment["targets"]>[0]): string {
  const type = (target.type || "").toUpperCase();
  if (type === "PACE") {
    if (target.valueLow !== undefined && target.valueHigh !== undefined) {
      return formatPaceTargetRangeForDisplay(target.valueLow, target.valueHigh);
    }
    if (target.value !== undefined && Number.isFinite(Number(target.value))) {
      return formatPaceTargetSingleForDisplay(Number(target.value));
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
  const searchParams = useSearchParams();
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
  const [showInviteModal, setShowInviteModal] = useState(false);

  const goTrainCtx = useMemo(
    () => parseGoTrainNavContext(searchParams),
    [searchParams]
  );

  const clearCreatedQuery = useCallback(() => {
    const q = new URLSearchParams(searchParams.toString());
    q.delete("created");
    const qs = q.toString();
    router.replace(qs ? `/workouts/${workoutId}?${qs}` : `/workouts/${workoutId}`, {
      scroll: false,
    });
  }, [router, workoutId, searchParams]);

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
        message: "Workout is set up on Garmin.",
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
                  Back to Go Train
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
  const isLogged = Boolean(workout.matchedActivityId ?? workout.matched_activity);
  const dayRel = dayRelativeToToday(workout.date);
  const estMi = estimatedMiDisplay(workout.estimatedDistanceInMeters);
  const planName = workout.training_plans?.name?.trim();
  const weekOnPlan =
    workout.weekNumber != null &&
    Number.isFinite(workout.weekNumber) &&
    workout.training_plans?.totalWeeks != null
      ? `Week ${workout.weekNumber} of ${workout.training_plans.totalWeeks}`
      : null;

  const backHref = goTrainCtx ? backHrefFromGoTrainContext(goTrainCtx) : "/workouts";
  const backLabel = goTrainCtx ? backLabelFromGoTrainContext(goTrainCtx) : "Back to Go Train";

  const sortedSegments = [...(workout.segments ?? [])].sort(
    (a, b) => a.stepOrder - b.stepOrder
  );
  const structuredTotals = structuredSegmentTotals(sortedSegments);
  const structuredParts = [
    formatStructuredMilesTotal(structuredTotals.miles),
    formatStructuredMinutesTotal(structuredTotals.minutes),
  ].filter(Boolean);
  const structuredMiLine = structuredParts.join(" · ");

  const planDayMi =
    workout.estimatedDistanceInMeters != null &&
    workout.estimatedDistanceInMeters > 0
      ? workout.estimatedDistanceInMeters / 1609.34
      : null;
  const showVolumeGapNote =
    planDayMi != null &&
    structuredTotals.miles > 0 &&
    planDayMi - structuredTotals.miles >= 0.35;

  const planDateKeyFromNav = goTrainCtx?.dateKey ?? null;
  const isContextToday =
    planDateKeyFromNav != null && planDateKeyFromNav === ymdFromDate(new Date());
  const navWeekLine =
    goTrainCtx?.weekNumber != null &&
    goTrainCtx?.totalWeeks != null &&
    Number.isFinite(goTrainCtx.weekNumber) &&
    Number.isFinite(goTrainCtx.totalWeeks)
      ? `Week ${goTrainCtx.weekNumber} of ${goTrainCtx.totalWeeks}`
      : null;
  const navDateLine =
    planDateKeyFromNav != null
      ? formatPlanDateDisplay(planDateKeyFromNav, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
      : null;

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
              Workout saved. You can set it up on Garmin when you&apos;re ready.
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
          href={backHref}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          {backLabel}
        </Link>

        {goTrainCtx && (
          <div className="rounded-2xl border-2 border-orange-200 bg-gradient-to-b from-orange-50/90 to-white p-6 mb-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">
              Go Train
            </p>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">
              {isContextToday
                ? "Here’s your work for today"
                : "Your planned workout"}
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              {[navWeekLine || weekOnPlan, navDateLine || scheduleLabel]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="mt-3 text-sm font-semibold text-orange-900">
              Let&apos;s go do this!
            </p>
            <a
              href="#run-setup"
              className="mt-4 inline-flex text-sm font-semibold text-orange-700 hover:text-orange-900 underline-offset-2 hover:underline"
            >
              Jump to watch setup
            </a>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Workout detail
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 break-words">
                {displayWorkoutListTitle({
                  title: workout.title,
                  workoutType: workout.workoutType,
                  estimatedDistanceInMeters: workout.estimatedDistanceInMeters ?? null,
                })}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {isLogged ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-900 rounded-full text-sm font-medium border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4" />
                    Completed
                  </span>
                ) : dayRel === "today" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 text-orange-900 rounded-full text-sm font-medium border border-orange-200">
                    Today&apos;s workout
                  </span>
                ) : dayRel === "future" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-sky-50 text-sky-900 rounded-full text-sm font-medium border border-sky-200">
                    Planned
                  </span>
                ) : dayRel === "past" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium border border-gray-200">
                    Past session
                  </span>
                ) : null}
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
              {scheduleLabel && (
                <p className="text-lg text-gray-800 font-medium mb-1">
                  {isLogged || dayRel === "today"
                    ? scheduleLabel
                    : dayRel === "future"
                      ? `Planned for ${scheduleLabel}`
                      : dayRel === "past"
                        ? `Scheduled for ${scheduleLabel}`
                        : scheduleLabel}
                </p>
              )}
              {estMi && (
                <p className="text-sm text-gray-600 mb-2">About {estMi} total (planned)</p>
              )}
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium text-gray-700">From:</span>{" "}
                {planName || "Standalone run"}
              </p>
              {weekOnPlan && (
                <p className="text-sm text-gray-500 mb-3">{weekOnPlan} on your plan</p>
              )}
              {workout.description && (
                <p className="text-gray-600 text-sm border-t border-gray-100 pt-3 break-words">
                  {workout.description}
                </p>
              )}
            </div>

            <div
              id="run-setup"
              className="scroll-mt-24 shrink-0 w-full sm:w-auto sm:min-w-[220px] flex flex-col gap-4"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Run setup
                </p>
                {!isLogged ? (
                  <>
                    {alreadyOnGarmin ? (
                      <button
                        type="button"
                        disabled
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg font-medium cursor-not-allowed border border-gray-200"
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        On Garmin already
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePushToGarmin}
                        disabled={pushing}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pushing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            Set up on Garmin
                          </>
                        )}
                      </button>
                    )}
                    <Link
                      href="/settings/garmin"
                      className="mt-2 block text-center text-sm font-medium text-gray-600 hover:text-orange-700"
                    >
                      Garmin and device settings
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-gray-600 leading-relaxed">
                    This session is logged. Garmin setup isn&apos;t needed here—see the summary
                    below.
                  </p>
                )}
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Social
                </p>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-sky-600 text-sky-700 bg-white hover:bg-sky-50 rounded-lg font-medium transition-colors"
                >
                  <Users className="w-5 h-5" />
                  Invite others to this workout
                </button>
                <p className="mt-1.5 text-xs text-gray-500">
                  Creates a CityRun linked to this workout with a shareable link and RSVP on /gorun.
                </p>
              </div>
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

        <div className="bg-white rounded-lg border border-dashed border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900">Notes for this run</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Space for things to think about, encouragement, or coach notes—coming soon.
          </p>
        </div>

        <InviteCityRunFromWorkoutModal
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          workout={workout}
        />

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

        {workout.workout_catalogue &&
          workout.workoutType !== "Intervals" &&
          workout.workoutType !== "Tempo" && (
          <CataloguePrescriptionCard
            catalogue={workout.workout_catalogue}
            fiveKPaceSnapshot={workout.training_plans?.currentFiveKPace}
            estimatedDistanceInMeters={workout.estimatedDistanceInMeters ?? null}
          />
        )}

        {(planDayMi != null || structuredMiLine !== "") && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Volume</h2>
            <ul className="text-sm text-gray-800 space-y-2 list-none p-0 m-0">
              {planDayMi != null && (
                <li>
                  <span className="font-medium text-gray-900">Day total (plan): </span>
                  ~{planDayMi.toFixed(1)} mi
                </li>
              )}
              {structuredMiLine.length > 0 && (
                <li>
                  <span className="font-medium text-gray-900">Structured steps (watch): </span>
                  {structuredMiLine}
                </li>
              )}
            </ul>
            {showVolumeGapNote && (
              <p className="text-sm text-gray-600 mt-4 border-t border-gray-100 pt-4 leading-relaxed">
                The steps below are the main pieces for your watch. If your plan lists more mileage
                than these steps add up to, cover the difference with{" "}
                <span className="font-medium text-gray-800">easy running</span> before and/or
                after—common on quality days (e.g. short 5K-effort segment plus cool-down, with extra
                easy miles to hit the day total).
              </p>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Segments</h2>
          {workout.workout_catalogue &&
            workout.workoutType !== "Intervals" &&
            workout.workoutType !== "Tempo" && (
            <p className="text-sm text-gray-500 mb-4">
              Step-by-step breakdown (used for Garmin sync). The coach prescription above is the
              human-readable plan.
            </p>
          )}

          {workout.segments && workout.segments.length > 0 ? (
            <div className="space-y-4">
              {sortedSegments.map((segment, segIdx) => {
                const structBadge = segmentStructureBadge(
                  segment.title,
                  segIdx,
                  sortedSegments.length
                );
                return (
                  <div
                    key={segment.id}
                    className="border border-gray-200 rounded-lg p-4 sm:p-5 bg-gray-50"
                  >
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 text-lg flex flex-wrap items-center gap-2">
                        <span>
                          {segment.stepOrder}. {segment.title}
                        </span>
                        {structBadge ? (
                          <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                            {structBadge}
                          </span>
                        ) : null}
                      </h3>
                      {segment.repeatCount != null && segment.repeatCount > 1 && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium text-gray-800">Repeats: </span>
                          {segment.repeatCount}× this block (do the step this many times before
                          moving on)
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
                            Prescribed
                          </dt>
                          <dd className="space-y-2">
                            {segment.targets.map((target, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-base"
                              >
                                <span className="text-gray-600 shrink-0 sm:min-w-[7rem]">
                                  {workoutTargetTypeLabel(target.type || "Target")}
                                </span>
                                <span className="text-gray-900 font-medium break-words">
                                  {formatTargetLine(target)}
                                </span>
                              </div>
                            ))}
                          </dd>
                        </div>
                      )}
                      {(segment.actualPaceSecPerMile != null ||
                        segment.actualDistanceMiles != null ||
                        segment.actualDurationSeconds != null) && (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Actual (from matched activity)
                          </dt>
                          <dd className="space-y-1 text-base text-gray-900">
                            {segment.actualPaceSecPerMile != null && (
                              <p>
                                <span className="text-gray-600">Pace: </span>
                                <span className="font-medium">
                                  {formatSecPerMile(segment.actualPaceSecPerMile)}
                                </span>
                              </p>
                            )}
                            {segment.actualDistanceMiles != null && (
                              <p>
                                <span className="text-gray-600">Distance: </span>
                                <span className="font-medium">
                                  {segment.actualDistanceMiles.toFixed(2)} mi
                                </span>
                              </p>
                            )}
                            {segment.actualDurationSeconds != null && (
                              <p>
                                <span className="text-gray-600">Time: </span>
                                <span className="font-medium">
                                  {Math.round(segment.actualDurationSeconds / 60)} min
                                </span>
                              </p>
                            )}
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
                );
              })}
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
