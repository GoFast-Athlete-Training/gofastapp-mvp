"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ListOrdered,
} from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import {
  formatPaceTargetRangeForDisplay,
  formatPaceTargetSingleForDisplay,
  getTrainingPaces,
  parsePaceToSecondsPerMile,
  workoutTargetTypeLabel,
} from "@/lib/workout-generator/pace-calculator";
import { readWorkoutDayNav } from "@/lib/training/workout-day-nav";
import {
  backHrefFromGoTrainContext,
  backLabelFromGoTrainContext,
  backLabelFromPath,
  parseBackHrefParam,
  parseDateKeyFromTrainingDayPreviewPath,
  parseGoTrainNavContext,
} from "@/lib/training/workout-nav-query";
import {
  formatStructuredMilesTotal,
  formatStructuredMinutesTotal,
  segmentStructureBadge,
  structuredSegmentTotals,
} from "@/lib/training/segment-summary";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import { formatPlanDateDisplay, localYmd } from "@/lib/training/plan-utils";

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
  slug?: string | null;
  city_runs?: Array<{ id: string; date: string; createdAt?: string }>;
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
  const today = localYmd(new Date());
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

type EditableSegment = {
  clientKey: string;
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: string;
  repeatCount: string;
  paceLowSec: string;
  paceHighSec: string;
  notes: string;
};

function newClientKey(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `k_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function segmentToEditable(s: WorkoutSegment): EditableSegment {
  const pace = s.targets?.find((t) => (t.type || "").toUpperCase() === "PACE");
  return {
    clientKey: s.id?.trim() ? s.id : newClientKey(),
    title: s.title,
    durationType: s.durationType === "TIME" ? "TIME" : "DISTANCE",
    durationValue: String(s.durationValue),
    repeatCount:
      s.repeatCount != null && Number(s.repeatCount) > 1 ? String(s.repeatCount) : "",
    paceLowSec:
      pace?.valueLow != null && Number.isFinite(Number(pace.valueLow))
        ? String(Math.round(Number(pace.valueLow)))
        : "",
    paceHighSec:
      pace?.valueHigh != null && Number.isFinite(Number(pace.valueHigh))
        ? String(Math.round(Number(pace.valueHigh)))
        : "",
    notes: s.notes ?? "",
  };
}

function editableSegmentsToApiPayload(segments: EditableSegment[]) {
  return segments.map((s, i) => {
    const durationValue = parseFloat(s.durationValue);
    if (!Number.isFinite(durationValue) || durationValue < 0) {
      throw new Error(`Segment ${i + 1}: invalid duration`);
    }
    const title = s.title.trim();
    if (!title) {
      throw new Error(`Segment ${i + 1}: title is required`);
    }
    let repeatCount: number | null = null;
    if (s.repeatCount.trim()) {
      const r = parseInt(s.repeatCount, 10);
      if (Number.isFinite(r) && r > 1) repeatCount = r;
    }
    const low = s.paceLowSec.trim() ? Number(s.paceLowSec) : NaN;
    const high = s.paceHighSec.trim() ? Number(s.paceHighSec) : NaN;
    let targets: unknown = null;
    if (Number.isFinite(low) && Number.isFinite(high)) {
      targets = [{ type: "PACE", valueLow: low, valueHigh: high }];
    } else if (Number.isFinite(low)) {
      targets = [{ type: "PACE", value: low }];
    }
    return {
      stepOrder: i + 1,
      title,
      durationType: s.durationType,
      durationValue,
      repeatCount,
      notes: s.notes.trim() || null,
      targets,
    };
  });
}

/** "m:ss" per mile → seconds per mile */
function parsePaceMinSecPerMileInput(s: string): number | null {
  const t = s.trim();
  const m = /^(\d+):(\d{1,2})$/.exec(t);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec >= 60) return null;
  return min * 60 + sec;
}

function paceInputValueFromSecPerMile(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getPaceSecsFromSegment(seg: WorkoutSegment): {
  low: number | null;
  high: number | null;
} {
  const pace = seg.targets?.find((t) => (t.type || "").toUpperCase() === "PACE");
  if (!pace) return { low: null, high: null };
  if (pace.valueLow != null && Number.isFinite(Number(pace.valueLow))) {
    const low = Number(pace.valueLow);
    const high =
      pace.valueHigh != null && Number.isFinite(Number(pace.valueHigh))
        ? Number(pace.valueHigh)
        : null;
    return { low, high };
  }
  if (pace.value != null && Number.isFinite(Number(pace.value))) {
    const v = Number(pace.value);
    return { low: v, high: null };
  }
  return { low: null, high: null };
}

type SegmentQuickOverride = {
  repeatCount?: number;
  paceLowSec?: number;
  paceHighSec?: number;
};

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

  const [isEditing, setIsEditing] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editDistanceMi, setEditDistanceMi] = useState("");
  const [garminConnected, setGarminConnected] = useState<boolean | null>(null);
  const [editSegments, setEditSegments] = useState<EditableSegment[]>([]);
  const [quickOrderIds, setQuickOrderIds] = useState<string[]>([]);
  const [segmentOverrides, setSegmentOverrides] = useState<
    Record<string, SegmentQuickOverride>
  >({});
  const [savingQuick, setSavingQuick] = useState(false);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);

  const sortedSegments = useMemo(() => {
    if (!workout?.segments?.length) return [];
    return [...workout.segments].sort((a, b) => a.stepOrder - b.stepOrder);
  }, [workout?.segments]);

  const simpleBackHref = useMemo(
    () => parseBackHrefParam(searchParams),
    [searchParams]
  );
  const goTrainCtx = useMemo(
    () => parseGoTrainNavContext(searchParams),
    [searchParams]
  );

  const navFromStash = useMemo(
    () => readWorkoutDayNav(workoutId),
    [workoutId]
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

  useEffect(() => {
    if (!workout?.id) return;
    setQuickOrderIds([]);
    setSegmentOverrides({});
    setQuickEditError(null);
  }, [workout?.id]);

  useEffect(() => {
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      setGarminConnected(false);
      return;
    }
    let cancelled = false;
    api
      .get<{ athlete?: { garmin_connected?: boolean } }>(`/athlete/${athleteId}`)
      .then((res) => {
        if (cancelled) return;
        const c = res.data?.athlete?.garmin_connected;
        setGarminConnected(typeof c === "boolean" ? c : false);
      })
      .catch(() => {
        if (!cancelled) setGarminConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  const startEdit = useCallback(() => {
    if (!workout) return;
    setEditError(null);
    setEditDistanceMi(
      workout.estimatedDistanceInMeters != null &&
        workout.estimatedDistanceInMeters > 0
        ? (workout.estimatedDistanceInMeters / 1609.34).toFixed(2)
        : ""
    );
    const sorted = [...(workout.segments ?? [])].sort((a, b) => a.stepOrder - b.stepOrder);
    setEditSegments(sorted.map((s) => segmentToEditable(s)));
    setIsEditing(true);
    requestAnimationFrame(() => {
      document
        .getElementById("segment-sequencer")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [workout]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditError(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const wantEdit = searchParams.get("edit") === "1";
    if (!wantEdit || !workout) return;
    startEdit();
    const q = new URLSearchParams(searchParams.toString());
    q.delete("edit");
    const qs = q.toString();
    router.replace(qs ? `/workouts/${workoutId}?${qs}` : `/workouts/${workoutId}`, {
      scroll: false,
    });
  }, [workout, workoutId, searchParams, router, startEdit]);

  const saveEdits = async () => {
    if (!workout) return;
    let payload: ReturnType<typeof editableSegmentsToApiPayload>;
    try {
      if (editSegments.length === 0) {
        setEditError("Add at least one segment");
        return;
      }
      payload = editableSegmentsToApiPayload(editSegments);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Invalid segments");
      return;
    }

    setSavingEdits(true);
    setEditError(null);

    let estimatedDistanceInMeters: number | null;
    const mi = parseFloat(editDistanceMi);
    if (editDistanceMi.trim() === "") {
      estimatedDistanceInMeters = null;
    } else if (Number.isFinite(mi) && mi >= 0) {
      estimatedDistanceInMeters = mi * 1609.34;
    } else {
      setSavingEdits(false);
      setEditError("Total distance must be a valid number (miles) or empty");
      return;
    }

    try {
      const patchBody: Record<string, unknown> = {
        title: workout.title,
        description: workout.description?.trim() || null,
        date: workoutCalendarYmd(workout.date) ?? null,
        estimatedDistanceInMeters,
      };

      const patchRes = await api.patch(`/workouts/${workoutId}`, patchBody);
      const warn = (patchRes.data as { dateChangeWarning?: string })?.dateChangeWarning;
      if (warn) {
        setGarminToast(warn);
      }

      await api.put(`/workouts/${workoutId}/segments`, payload);

      setIsEditing(false);
      await fetchWorkout();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setEditError(ax.response?.data?.error || "Failed to save changes");
    } finally {
      setSavingEdits(false);
    }
  };

  const addEditSegment = () => {
    setEditSegments((prev) => [
      ...prev,
      {
        clientKey: newClientKey(),
        title: "Segment",
        durationType: "DISTANCE",
        durationValue: "1",
        repeatCount: "",
        paceLowSec: "",
        paceHighSec: "",
        notes: "",
      },
    ]);
  };

  const removeEditSegment = (key: string) => {
    setEditSegments((prev) => prev.filter((s) => s.clientKey !== key));
  };

  const moveEditSegment = (key: string, dir: -1 | 1) => {
    setEditSegments((prev) => {
      const i = prev.findIndex((s) => s.clientKey === key);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const t = next[i]!;
      next[i] = next[j]!;
      next[j] = t;
      return next;
    });
  };

  const getQuickOrderedSegments = useCallback((): WorkoutSegment[] => {
    const base = sortedSegments;
    if (base.length === 0) return [];
    const ids = quickOrderIds.length > 0 ? quickOrderIds : base.map((s) => s.id);
    const map = new Map(base.map((s) => [s.id, s]));
    return ids.map((id) => map.get(id)).filter((s): s is WorkoutSegment => s != null);
  }, [sortedSegments, quickOrderIds]);

  const defaultSegmentOrderIds = useMemo(
    () => sortedSegments.map((s) => s.id),
    [sortedSegments]
  );

  const quickOrderDirty = useMemo(() => {
    if (quickOrderIds.length === 0) return false;
    if (quickOrderIds.length !== defaultSegmentOrderIds.length) return true;
    return quickOrderIds.some((id, i) => id !== defaultSegmentOrderIds[i]);
  }, [quickOrderIds, defaultSegmentOrderIds]);

  const quickOverridesDirty = Object.keys(segmentOverrides).length > 0;
  const quickEditDirty = quickOrderDirty || quickOverridesDirty;

  const swapQuickSegment = useCallback(
    (displayIndex: number, dir: -1 | 1) => {
      const base = sortedSegments.map((s) => s.id);
      const ids = quickOrderIds.length > 0 ? [...quickOrderIds] : [...base];
      const j = displayIndex + dir;
      if (j < 0 || j >= ids.length) return;
      const a = ids[displayIndex]!;
      const b = ids[j]!;
      ids[displayIndex] = b;
      ids[j] = a;
      setQuickOrderIds(ids);
    },
    [sortedSegments, quickOrderIds]
  );

  const adjustQuickRepeat = useCallback(
    (segmentId: string, delta: number) => {
      setSegmentOverrides((prev) => {
        const seg = sortedSegments.find((s) => s.id === segmentId);
        if (!seg) return prev;
        const prevOv = prev[segmentId];
        const current = prevOv?.repeatCount ?? seg.repeatCount ?? 1;
        const next = Math.min(20, Math.max(1, current + delta));
        return { ...prev, [segmentId]: { ...prevOv, repeatCount: next } };
      });
    },
    [sortedSegments]
  );

  const updateQuickPaceField = useCallback(
    (segmentId: string, field: "low" | "high", raw: string) => {
      const parsed = parsePaceMinSecPerMileInput(raw);
      setSegmentOverrides((prev) => {
        const o = { ...prev[segmentId] };
        if (parsed == null) {
          if (field === "low") delete o.paceLowSec;
          else delete o.paceHighSec;
        } else if (field === "low") {
          o.paceLowSec = parsed;
        } else {
          o.paceHighSec = parsed;
        }
        const hasAny =
          o.repeatCount != null || o.paceLowSec != null || o.paceHighSec != null;
        if (!hasAny) {
          const { [segmentId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [segmentId]: o };
      });
    },
    []
  );

  const saveQuickSegments = useCallback(async () => {
    if (!workout) return;
    setSavingQuick(true);
    setQuickEditError(null);
    try {
      const ordered = getQuickOrderedSegments();
      if (ordered.length === 0) {
        setQuickEditError("No segments to save");
        return;
      }
      const editable: EditableSegment[] = ordered.map((seg) => {
        const o = segmentOverrides[seg.id];
        const base = segmentToEditable(seg);
        let repeatCount = base.repeatCount;
        if (o?.repeatCount != null) {
          repeatCount = o.repeatCount > 1 ? String(o.repeatCount) : "";
        }
        let paceLowSec = base.paceLowSec;
        let paceHighSec = base.paceHighSec;
        if (o?.paceLowSec != null) paceLowSec = String(Math.round(o.paceLowSec));
        if (o?.paceHighSec != null) paceHighSec = String(Math.round(o.paceHighSec));
        return { ...base, repeatCount, paceLowSec, paceHighSec };
      });
      const payload = editableSegmentsToApiPayload(editable);
      await api.put(`/workouts/${workoutId}/segments`, payload);
      setQuickOrderIds([]);
      setSegmentOverrides({});
      const response = await api.get<{ workout: Workout }>(`/training/workout/${workoutId}`);
      const w = response.data?.workout;
      if (w) setWorkout(w);
      setGarminToast("Workout steps saved.");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setQuickEditError(ax.response?.data?.error || "Could not save segments");
    } finally {
      setSavingQuick(false);
    }
  }, [workout, getQuickOrderedSegments, segmentOverrides, workoutId]);

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
        message: "Workout pushed to Garmin.",
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

  const planPreviewBackFromStash =
    navFromStash?.source === "plan-preview" ? navFromStash.backPath : null;
  const fromGoTrainStash = navFromStash?.source === "go-train";

  const backHref =
    simpleBackHref ??
    planPreviewBackFromStash ??
    (goTrainCtx ? backHrefFromGoTrainContext(goTrainCtx) : null) ??
    "/workouts";
  const backLabel = simpleBackHref
    ? backLabelFromPath(simpleBackHref)
    : planPreviewBackFromStash
      ? backLabelFromPath(planPreviewBackFromStash)
      : goTrainCtx
        ? backLabelFromGoTrainContext(goTrainCtx)
        : "Back to Go Train";

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

  const planDateKeyFromNav =
    goTrainCtx?.dateKey ??
    (simpleBackHref ? parseDateKeyFromTrainingDayPreviewPath(simpleBackHref) : null) ??
    (planPreviewBackFromStash
      ? parseDateKeyFromTrainingDayPreviewPath(planPreviewBackFromStash)
      : null);
  const isContextToday =
    planDateKeyFromNav != null && planDateKeyFromNav === localYmd(new Date());
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

  const simpleBackPathOnly = simpleBackHref?.split("?")[0] ?? null;
  const planPreviewPathOnly = planPreviewBackFromStash?.split("?")[0] ?? "";
  const executionFraming = Boolean(
    goTrainCtx ||
      fromGoTrainStash ||
      (simpleBackHref &&
        (simpleBackPathOnly === "/workouts" ||
          simpleBackPathOnly?.startsWith("/training/day/"))) ||
      planPreviewPathOnly.startsWith("/training/day/")
  );
  const detailEyebrow =
    goTrainCtx || fromGoTrainStash || simpleBackPathOnly === "/workouts"
      ? "Go Train"
      : simpleBackPathOnly?.startsWith("/training/day/") ||
          planPreviewPathOnly.startsWith("/training/day/")
        ? "Workout"
        : "Workout detail";

  const weekLineDisplay = navWeekLine ?? weekOnPlan;
  const dateLineDisplay = navDateLine ?? scheduleLabel;
  const weekAndDateLine = [weekLineDisplay, dateLineDisplay].filter(Boolean).join(" · ");

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
              Workout saved. Connect Garmin in Settings, then use Push to Garmin on this page.
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

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="min-w-0">
              <p
                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                  executionFraming ? "text-orange-800" : "text-gray-500"
                }`}
              >
                {detailEyebrow}
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
              </div>
              {weekAndDateLine ? (
                <p className="text-base text-gray-800 font-medium mb-2">{weekAndDateLine}</p>
              ) : null}
              {executionFraming ? (
                <>
                  <p className="text-sm font-semibold text-orange-900 mb-1">
                    {isContextToday ? "Here&apos;s your work for today." : "Let&apos;s go do this!"}
                  </p>
                  <a
                    href="#segment-sequencer"
                    className="inline-flex text-sm font-semibold text-orange-700 hover:text-orange-900 underline-offset-2 hover:underline mb-3"
                  >
                    Jump to segment sequencer
                  </a>
                </>
              ) : null}
              {estMi && !executionFraming ? (
                <p className="text-sm text-gray-600 mb-2">About {estMi} total (planned)</p>
              ) : null}
              <p className="text-sm text-gray-600 mb-3">
                {planName ? planName : "Standalone run"}
              </p>
              {workout.description && (
                <p className="text-gray-600 text-sm border-t border-gray-100 pt-3 break-words">
                  {workout.description}
                </p>
              )}
          </div>
        </div>

        {!isLogged && (
          <div
            id="workout-garmin"
            className="rounded-lg border border-gray-200 bg-gray-50/90 px-4 py-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between scroll-mt-24"
          >
            <div className="text-sm text-gray-700 min-w-0">
              {garminConnected === null ? (
                <span className="text-gray-500">Checking Garmin connection…</span>
              ) : !garminConnected ? (
                <>
                  <span className="font-medium text-gray-900">Garmin not connected.</span>{" "}
                  Connect in Settings to push this workout to your watch.
                </>
              ) : alreadyOnGarmin ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span>
                    On Garmin
                    {workout.garminWorkoutId != null ? ` (workout #${workout.garminWorkoutId})` : ""}
                  </span>
                </span>
              ) : (
                <span>Garmin is connected—you can push this workout to your watch.</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 justify-start sm:justify-end">
              {garminConnected === true && !alreadyOnGarmin && (
                <button
                  type="button"
                  onClick={handlePushToGarmin}
                  disabled={pushing}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                >
                  {pushing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Push to Garmin
                    </>
                  )}
                </button>
              )}
              {!garminConnected && garminConnected !== null && (
                <Link
                  href="/settings/garmin"
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700"
                >
                  Connect Garmin
                </Link>
              )}
              {garminConnected && (
                <Link
                  href="/settings/garmin"
                  className="text-sm font-medium text-gray-600 hover:text-orange-700 underline-offset-2 hover:underline"
                >
                  Garmin settings
                </Link>
              )}
            </div>
          </div>
        )}

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

        <div
          id="segment-sequencer"
          className="bg-white rounded-lg border border-gray-200 p-6 mb-6 scroll-mt-24"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-900">Segment sequencer</h2>
            {isEditing && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveEdits()}
                  disabled={savingEdits}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 shrink-0" />
                  {savingEdits ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={savingEdits}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          {isEditing && (
            <p className="text-sm text-gray-600 mb-3">
              Add blocks, set repeat counts (e.g. 4×800 → 5×800), and reorder—then save.
            </p>
          )}
          {editError && (
            <p className="text-sm text-red-600 mb-3" role="alert">
              {editError}
            </p>
          )}
          {!isEditing &&
            workout.workout_catalogue &&
            workout.workoutType !== "Intervals" &&
            workout.workoutType !== "Tempo" && (
              <p className="text-sm text-gray-500 mb-4">
                Step-by-step structure for your watch and Garmin—use{" "}
                <span className="font-medium text-gray-700">Segment sequencer</span> below to add
                steps or change repeats. A fuller coach prescription may appear further down the
                page.
              </p>
            )}

          {isEditing ? (
            <div className="space-y-4">
              <label className="block max-w-xs">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Day total (planned miles, optional)
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editDistanceMi}
                  onChange={(e) => setEditDistanceMi(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. 6.5"
                />
              </label>
              <button
                type="button"
                onClick={addEditSegment}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-orange-300 bg-orange-50/50 text-sm font-medium text-orange-900 hover:bg-orange-50"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Add segment
              </button>
              {editSegments.map((segment, segIdx) => (
                <div
                  key={segment.clientKey}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">#{segIdx + 1}</span>
                    <div className="flex gap-1 ml-auto">
                      <button
                        type="button"
                        aria-label="Move up"
                        onClick={() => moveEditSegment(segment.clientKey, -1)}
                        disabled={segIdx === 0}
                        className="p-2 rounded border border-gray-200 bg-white disabled:opacity-40"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        onClick={() => moveEditSegment(segment.clientKey, 1)}
                        disabled={segIdx === editSegments.length - 1}
                        className="p-2 rounded border border-gray-200 bg-white disabled:opacity-40"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove segment"
                        onClick={() => removeEditSegment(segment.clientKey)}
                        className="p-2 rounded border border-red-200 bg-white text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-gray-500">Title</span>
                    <input
                      type="text"
                      value={segment.title}
                      onChange={(e) =>
                        setEditSegments((prev) =>
                          prev.map((s) =>
                            s.clientKey === segment.clientKey
                              ? { ...s, title: e.target.value }
                              : s
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase text-gray-500">Type</span>
                      <select
                        value={segment.durationType}
                        onChange={(e) =>
                          setEditSegments((prev) =>
                            prev.map((s) =>
                              s.clientKey === segment.clientKey
                                ? {
                                    ...s,
                                    durationType:
                                      e.target.value === "TIME" ? "TIME" : "DISTANCE",
                                  }
                                : s
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="DISTANCE">Distance</option>
                        <option value="TIME">Time</option>
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-semibold uppercase text-gray-500">
                        {segment.durationType === "DISTANCE" ? "Miles" : "Minutes"}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={segment.durationValue}
                        onChange={(e) =>
                          setEditSegments((prev) =>
                            prev.map((s) =>
                              s.clientKey === segment.clientKey
                                ? { ...s, durationValue: e.target.value }
                                : s
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase text-gray-500">
                        Repeat block (×)
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="optional"
                        value={segment.repeatCount}
                        onChange={(e) =>
                          setEditSegments((prev) =>
                            prev.map((s) =>
                              s.clientKey === segment.clientKey
                                ? { ...s, repeatCount: e.target.value }
                                : s
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase text-gray-500">
                        Pace low (sec/mi)
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="optional"
                        value={segment.paceLowSec}
                        onChange={(e) =>
                          setEditSegments((prev) =>
                            prev.map((s) =>
                              s.clientKey === segment.clientKey
                                ? { ...s, paceLowSec: e.target.value }
                                : s
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase text-gray-500">
                        Pace high (sec/mi)
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="optional"
                        value={segment.paceHighSec}
                        onChange={(e) =>
                          setEditSegments((prev) =>
                            prev.map((s) =>
                              s.clientKey === segment.clientKey
                                ? { ...s, paceHighSec: e.target.value }
                                : s
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-gray-500">Notes</span>
                    <input
                      type="text"
                      value={segment.notes}
                      onChange={(e) =>
                        setEditSegments((prev) =>
                          prev.map((s) =>
                            s.clientKey === segment.clientKey
                              ? { ...s, notes: e.target.value }
                              : s
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              ))}
              {editSegments.length === 0 && (
                <p className="text-sm text-gray-600">Add at least one segment to save.</p>
              )}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => void saveEdits()}
                  disabled={savingEdits}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 shrink-0" />
                  {savingEdits ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={savingEdits}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : workout.segments && workout.segments.length > 0 ? (
            <div className="space-y-4">
              {(isLogged ? sortedSegments : getQuickOrderedSegments()).map((segment, segIdx) => {
                const displayList = isLogged ? sortedSegments : getQuickOrderedSegments();
                const structBadge = segmentStructureBadge(
                  segment.title,
                  segIdx,
                  displayList.length
                );
                const o = segmentOverrides[segment.id];
                const effRepeat = o?.repeatCount ?? segment.repeatCount ?? 1;
                const showRepeatStepper = !isLogged && effRepeat >= 2;
                const { low: baseLow, high: baseHigh } = getPaceSecsFromSegment(segment);
                const effLow = o?.paceLowSec ?? baseLow;
                const effHigh = o?.paceHighSec ?? baseHigh;
                const hasPaceTarget = baseLow != null || baseHigh != null;
                return (
                  <div
                    key={segment.id}
                    className="border border-gray-200 rounded-lg p-4 sm:p-5 bg-gray-50"
                  >
                    <div className="mb-4">
                      <div className="flex flex-wrap items-start gap-2">
                        {!isLogged && (
                          <div className="flex gap-1 shrink-0 pt-1">
                            <button
                              type="button"
                              aria-label="Move segment up"
                              onClick={() => swapQuickSegment(segIdx, -1)}
                              disabled={segIdx === 0}
                              className="p-2 rounded border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Move segment down"
                              onClick={() => swapQuickSegment(segIdx, 1)}
                              disabled={segIdx === displayList.length - 1}
                              className="p-2 rounded border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        <h3 className="font-semibold text-gray-900 text-lg flex flex-wrap items-center gap-2 min-w-0">
                          <span>
                            {segIdx + 1}. {segment.title}
                          </span>
                          {structBadge ? (
                            <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                              {structBadge}
                            </span>
                          ) : null}
                        </h3>
                      </div>
                      {showRepeatStepper && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-gray-800">Repeats</span>
                          <button
                            type="button"
                            onClick={() => adjustQuickRepeat(segment.id, -1)}
                            disabled={effRepeat <= 1}
                            className="h-8 w-8 rounded-lg border border-gray-300 bg-white font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="min-w-[2rem] text-center font-semibold text-gray-900">
                            {effRepeat}×
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustQuickRepeat(segment.id, 1)}
                            disabled={effRepeat >= 20}
                            className="h-8 w-8 rounded-lg border border-gray-300 bg-white font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40"
                          >
                            +
                          </button>
                          <span className="text-gray-500 text-xs">
                            this block before the next step
                          </span>
                        </div>
                      )}
                      {isLogged &&
                        segment.repeatCount != null &&
                        segment.repeatCount > 1 && (
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium text-gray-800">Repeats: </span>
                            {segment.repeatCount}× this block (do the step this many times
                            before moving on)
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
                            {segment.targets.map((target, idx) => {
                              const t = (target.type || "").toUpperCase();
                              if (!isLogged && t === "PACE" && hasPaceTarget) {
                                return (
                                  <div key={idx} className="space-y-2">
                                    <span className="text-gray-600 text-sm block">
                                      {workoutTargetTypeLabel(target.type || "Target")}
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                                      <label className="block text-sm">
                                        <span className="text-xs font-medium text-gray-500 block mb-1">
                                          Pace low (min:ss /mi)
                                        </span>
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={paceInputValueFromSecPerMile(effLow ?? undefined)}
                                          onChange={(e) =>
                                            updateQuickPaceField(
                                              segment.id,
                                              "low",
                                              e.target.value
                                            )
                                          }
                                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                          placeholder="e.g. 7:30"
                                        />
                                      </label>
                                      <label className="block text-sm">
                                        <span className="text-xs font-medium text-gray-500 block mb-1">
                                          Pace high (min:ss /mi)
                                        </span>
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={paceInputValueFromSecPerMile(
                                            effHigh ?? undefined
                                          )}
                                          onChange={(e) =>
                                            updateQuickPaceField(
                                              segment.id,
                                              "high",
                                              e.target.value
                                            )
                                          }
                                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                          placeholder={
                                            baseHigh != null ? "e.g. 8:00" : "optional"
                                          }
                                        />
                                      </label>
                                    </div>
                                  </div>
                                );
                              }
                              return (
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
                              );
                            })}
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
              {!isLogged && quickEditDirty && (
                <div className="mt-2 flex flex-col sm:flex-row flex-wrap gap-2 border-t border-gray-200 pt-4">
                  {quickEditError && (
                    <p className="text-sm text-red-600 w-full" role="alert">
                      {quickEditError}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={savingQuick}
                    onClick={() => void saveQuickSegments()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 shrink-0" />
                    {savingQuick ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    disabled={savingQuick}
                    onClick={() => {
                      setQuickOrderIds([]);
                      setSegmentOverrides({});
                      setQuickEditError(null);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600">No segments defined</p>
          )}
          {!isLogged && !isEditing && (
            <div className="border-t border-gray-200 mt-6 pt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                <ListOrdered className="w-4 h-4 shrink-0" aria-hidden />
                Segment sequencer
              </button>
            </div>
          )}
        </div>
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
                The structured steps above are what sync to your watch. If your plan lists more mileage
                than those steps add up to, cover the difference with{" "}
                <span className="font-medium text-gray-800">easy running</span> before and/or
                after—common on quality days (e.g. short 5K-effort segment plus cool-down, with extra
                easy miles to hit the day total).
              </p>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Social</p>
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
            {workout.city_runs && workout.city_runs.length > 0 ? (
              <Link
                href={`/gorun/${workout.city_runs[0].id}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 border border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 rounded-lg font-medium transition-colors"
              >
                <Users className="w-5 h-5" />
                Manage Your Run
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => router.push(`/workouts/${workout.id}/let-others-join`)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 border border-sky-600 text-sky-700 bg-white hover:bg-sky-50 rounded-lg font-medium transition-colors"
            >
              <Users className="w-5 h-5" />
              {workout.city_runs && workout.city_runs.length > 0
                ? "Add Another Meetup"
                : "Let Others Join this Workout"}
            </button>
          </div>
          {workout.slug ? (
            <p className="mt-2 text-xs text-gray-600">
              Training share page:{" "}
              <Link
                href={`/mytrainingruns/${workout.slug}`}
                className="text-sky-700 font-medium underline"
              >
                /mytrainingruns/{workout.slug}
              </Link>
            </p>
          ) : null}
          <p className="mt-1.5 text-xs text-gray-500">
            Set a meetup spot and time; friends get a CityRun link to RSVP and a page that shows your
            workout structure.
          </p>
        </div>

      </div>
        </main>
      </div>
    </div>
  );
}
