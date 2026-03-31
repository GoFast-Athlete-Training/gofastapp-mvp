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
  Pencil,
  Save,
  Copy,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
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

  const [isEditing, setIsEditing] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDateYmd, setEditDateYmd] = useState("");
  const [editDistanceMi, setEditDistanceMi] = useState("");
  const [editSegments, setEditSegments] = useState<EditableSegment[]>([]);
  const [repeatModalOpen, setRepeatModalOpen] = useState(false);
  const [repeatFirstDate, setRepeatFirstDate] = useState("");
  const [repeatOccurrences, setRepeatOccurrences] = useState(2);
  const [repeatIntervalDays, setRepeatIntervalDays] = useState(7);
  const [repeatSubmitting, setRepeatSubmitting] = useState(false);
  const [repeatError, setRepeatError] = useState<string | null>(null);

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

  const startEdit = useCallback(() => {
    if (!workout) return;
    setEditError(null);
    setEditTitle(workout.title);
    setEditDescription(workout.description ?? "");
    setEditDateYmd(workoutCalendarYmd(workout.date) ?? "");
    setEditDistanceMi(
      workout.estimatedDistanceInMeters != null &&
        workout.estimatedDistanceInMeters > 0
        ? (workout.estimatedDistanceInMeters / 1609.34).toFixed(2)
        : ""
    );
    const sorted = [...(workout.segments ?? [])].sort((a, b) => a.stepOrder - b.stepOrder);
    setEditSegments(sorted.map((s) => segmentToEditable(s)));
    setIsEditing(true);
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
    const title = editTitle.trim();
    if (!title) {
      setEditError("Title is required");
      return;
    }
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
        title,
        description: editDescription.trim() || null,
        date: editDateYmd.trim() ? editDateYmd.trim() : null,
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

  const openRepeatModal = () => {
    if (!workout) return;
    setRepeatError(null);
    setRepeatFirstDate(workoutCalendarYmd(workout.date) ?? ymdFromDate(new Date()));
    setRepeatOccurrences(2);
    setRepeatIntervalDays(7);
    setRepeatModalOpen(true);
  };

  const repeatPreviewDates = useMemo(() => {
    const ymd = repeatFirstDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return [];
    const base = new Date(Date.UTC(
      parseInt(ymd.slice(0, 4), 10),
      parseInt(ymd.slice(5, 7), 10) - 1,
      parseInt(ymd.slice(8, 10), 10),
      12,
      0,
      0
    ));
    if (Number.isNaN(base.getTime())) return [];
    const n = Math.min(13, Math.max(1, repeatOccurrences));
    const iv = Math.min(365, Math.max(1, repeatIntervalDays));
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(base.getTime());
      d.setUTCDate(d.getUTCDate() + i * iv);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [repeatFirstDate, repeatOccurrences, repeatIntervalDays]);

  const submitRepeat = async () => {
    if (!workout) return;
    const ymd = repeatFirstDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      setRepeatError("Pick a valid start date");
      return;
    }
    const n = Math.min(13, Math.max(1, repeatOccurrences));
    const repeatCount = n - 1;
    const iv = Math.min(365, Math.max(1, repeatIntervalDays));
    setRepeatSubmitting(true);
    setRepeatError(null);
    try {
      const res = await api.post(`/workouts/${workoutId}/duplicate`, {
        date: ymd,
        repeatCount,
        repeatIntervalDays: iv,
      });
      const ids = (res.data as { workoutIds?: string[] })?.workoutIds ?? [];
      setRepeatModalOpen(false);
      setGarminToast(
        ids.length > 1
          ? `Created ${ids.length} workouts. Open Go Train to see them.`
          : "Workout copy created."
      );
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setRepeatError(ax.response?.data?.error || "Could not create copies");
    } finally {
      setRepeatSubmitting(false);
    }
  };

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
              {!isLogged && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {!isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={startEdit}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
                      >
                        <Pencil className="w-4 h-4 shrink-0" />
                        Edit workout
                      </button>
                      <button
                        type="button"
                        onClick={openRepeatModal}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
                      >
                        <Copy className="w-4 h-4 shrink-0" />
                        Repeat / copy
                      </button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              )}
              {editError && (
                <p className="text-sm text-red-600 mb-2" role="alert">
                  {editError}
                </p>
              )}
              {!isEditing ? (
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 break-words">
                {displayWorkoutListTitle({
                  title: workout.title,
                  workoutType: workout.workoutType,
                  estimatedDistanceInMeters: workout.estimatedDistanceInMeters ?? null,
                })}
              </h1>
              ) : (
                <div className="space-y-3 mb-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Title
                    </span>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-lg font-semibold text-gray-900"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Scheduled date
                      </span>
                      <input
                        type="date"
                        value={editDateYmd}
                        onChange={(e) => setEditDateYmd(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Total distance (mi, optional)
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
                  </div>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Description
                    </span>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
                    />
                  </label>
                </div>
              )}
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
              {scheduleLabel && !isEditing && (
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
              {estMi && !isEditing && (
                <p className="text-sm text-gray-600 mb-2">About {estMi} total (planned)</p>
              )}
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium text-gray-700">From:</span>{" "}
                {planName || "Standalone run"}
              </p>
              {weekOnPlan && (
                <p className="text-sm text-gray-500 mb-3">{weekOnPlan} on your plan</p>
              )}
              {workout.description && !isEditing && (
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
          {!isEditing &&
            workout.workout_catalogue &&
            workout.workoutType !== "Intervals" &&
            workout.workoutType !== "Tempo" && (
              <p className="text-sm text-gray-500 mb-4">
                Step-by-step breakdown (used for Garmin sync). The coach prescription above is the
                human-readable plan.
              </p>
            )}

          {isEditing ? (
            <div className="space-y-4">
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
            </div>
          ) : workout.segments && workout.segments.length > 0 ? (
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

        {repeatModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="repeat-workout-title"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setRepeatModalOpen(false);
            }}
          >
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-4">
              <h2 id="repeat-workout-title" className="text-lg font-semibold text-gray-900">
                Repeat / copy workout
              </h2>
              <p className="text-sm text-gray-600">
                Create standalone copies with the same structure. They won&apos;t be tied to your
                plan calendar.
              </p>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-500">First date</span>
                <input
                  type="date"
                  value={repeatFirstDate}
                  onChange={(e) => setRepeatFirstDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-500">
                  Total occurrences (1–13)
                </span>
                <input
                  type="number"
                  min={1}
                  max={13}
                  value={repeatOccurrences}
                  onChange={(e) =>
                    setRepeatOccurrences(
                      Math.min(13, Math.max(1, parseInt(e.target.value, 10) || 1))
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-500">
                  Days between copies
                </span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={repeatIntervalDays}
                  onChange={(e) =>
                    setRepeatIntervalDays(
                      Math.min(365, Math.max(1, parseInt(e.target.value, 10) || 7))
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              {repeatPreviewDates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Preview</p>
                  <ul className="text-sm text-gray-800 list-disc pl-5 space-y-0.5">
                    {repeatPreviewDates.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              {repeatError && (
                <p className="text-sm text-red-600" role="alert">
                  {repeatError}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRepeatModalOpen(false)}
                  disabled={repeatSubmitting}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitRepeat()}
                  disabled={repeatSubmitting}
                  className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {repeatSubmitting ? "Creating…" : "Create copies"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
        </main>
      </div>
    </div>
  );
}
