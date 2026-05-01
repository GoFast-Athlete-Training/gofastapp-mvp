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
  CopyPlus,
  RefreshCw,
  Watch,
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
  normalizePaceTargetEncodingVersion,
  parsePaceToSecondsPerMile,
  secondsPerMileToSecondsPerKm,
  storedPaceSecondsKmToSecondsPerMile,
  workoutTargetTypeLabel,
} from "@/lib/workout-generator/pace-calculator";
import { describeBetweenRepRecovery } from "@/lib/training/catalogue-interval-recovery";
import { PaceMiSplitEditor } from "@/components/workout/PaceMiSplitEditor";
import { parseSplitPaceToSecPerMile, secPerMileToSplitStrings } from "@/lib/workout/pace-mi-split";
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
import {
  displayWorkoutListTitle,
  formatPlannedWorkoutTitle,
} from "@/lib/training/workout-display-title";
import {
  paceRangeDeltaMessage,
  paceVsTargetBadgeText,
  paceVsTargetLabel,
  formatPaceTargetRangeDisplay,
  singleTargetPaceDeltaMessage,
  type PaceVsTargetLabel,
} from "@/lib/training/pace-comparison-display";
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
  paceTargetEncodingVersion?: number;
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
  slug?: string | null;
  workoutType: string;
  workBaseReps: number | null;
  workBaseRepMeters: number | null;
  recoveryDistanceMeters: number | null;
  recoveryDurationSeconds: number | null;
  warmupMiles: number | null;
  cooldownMiles: number | null;
  workBasePaceOffsetSecPerMile: number | null;
  recoveryPaceOffsetSecPerMile: number | null;
  workPaceOffsetSecPerMile: number | null;
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
  garminScheduleId?: number | null;
  catalogueWorkoutId?: string | null;
  workout_catalogue?: WorkoutCatalogue | null;
  estimatedDistanceInMeters?: number | null;
  segments: WorkoutSegment[];
  matchedActivityId?: string | null;
  actualDistanceMeters?: number | null;
  actualAvgPaceSecPerMile?: number | null;
  actualDurationSeconds?: number | null;
  paceDeltaSecPerMile?: number | null;
  targetPaceSecPerMile?: number | null;
  targetPaceSecPerMileHigh?: number | null;
  hrDeltaBpm?: number | null;
  creditedFiveKPaceSecPerMile?: number | null;
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
      <p>Slug: {catalogue.slug?.trim() || "—"}</p>
      {catalogue.intendedHeartRateZone && (
        <p>Heart rate: {catalogue.intendedHeartRateZone}</p>
      )}
      {catalogue.notes && <p className="text-gray-600">{catalogue.notes}</p>}
    </div>
  );

  if (catalogue.workoutType === "Intervals") {
    const reps = catalogue.workBaseReps ?? 6;
    const repM = catalogue.workBaseRepMeters ?? 800;
    const recoveryLabel = describeBetweenRepRecovery({
      recoveryDurationSeconds: catalogue.recoveryDurationSeconds ?? null,
      recoveryDistanceMeters: catalogue.recoveryDistanceMeters ?? null,
    });
    const intSec = paceSecFromAnchor(anchor, catalogue.workBasePaceOffsetSecPerMile, p.interval);
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
                  {reps} × {repM}m hard, {recoveryLabel}
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
    const easySec = paceSecFromAnchor(anchor, catalogue.workPaceOffsetSecPerMile, p.easy);
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

  if (catalogue.workoutType === "Tempo" || catalogue.workoutType === "SpeedDuration") {
    const tempoSec = paceSecFromAnchor(anchor, catalogue.workPaceOffsetSecPerMile, p.tempo);
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
  const longSec = paceSecFromAnchor(anchor, catalogue.workPaceOffsetSecPerMile, p.longRun);
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
  /** Pace low: minutes per mile (integer string). */
  paceLowMin: string;
  /** Pace low: seconds 0–59. */
  paceLowSec: string;
  paceHighMin: string;
  paceHighSec: string;
  notes: string;
};

function segmentPaceEncoding(seg: WorkoutSegment) {
  return normalizePaceTargetEncodingVersion(seg.paceTargetEncodingVersion);
}

function newClientKey(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `k_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function segmentToEditable(s: WorkoutSegment): EditableSegment {
  const enc = segmentPaceEncoding(s);
  const pace = s.targets?.find((t) => (t.type || "").toUpperCase() === "PACE");
  let paceLowMin = "";
  let paceLowSec = "";
  let paceHighMin = "";
  let paceHighSec = "";
  if (pace?.valueLow != null && Number.isFinite(Number(pace.valueLow))) {
    const lowTotal = Math.round(
      storedPaceSecondsKmToSecondsPerMile(Number(pace.valueLow), enc)
    );
    const lo = secPerMileToSplitStrings(lowTotal);
    paceLowMin = lo.min;
    paceLowSec = lo.sec;
  } else if (pace?.value != null && Number.isFinite(Number(pace.value))) {
    const lowTotal = Math.round(
      storedPaceSecondsKmToSecondsPerMile(Number(pace.value), enc)
    );
    const lo = secPerMileToSplitStrings(lowTotal);
    paceLowMin = lo.min;
    paceLowSec = lo.sec;
  }
  if (pace?.valueHigh != null && Number.isFinite(Number(pace.valueHigh))) {
    const highTotal = Math.round(
      storedPaceSecondsKmToSecondsPerMile(Number(pace.valueHigh), enc)
    );
    const hi = secPerMileToSplitStrings(highTotal);
    paceHighMin = hi.min;
    paceHighSec = hi.sec;
  }
  return {
    clientKey: s.id?.trim() ? s.id : newClientKey(),
    title: s.title,
    durationType: s.durationType === "TIME" ? "TIME" : "DISTANCE",
    durationValue: String(s.durationValue),
    repeatCount:
      s.repeatCount != null && Number(s.repeatCount) > 1 ? String(s.repeatCount) : "",
    paceLowMin,
    paceLowSec,
    paceHighMin,
    paceHighSec,
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
    const lowSecMi = parseSplitPaceToSecPerMile(
      s.paceLowMin,
      s.paceLowSec,
      `Segment ${i + 1}`,
      "low"
    );
    const highSecMi = parseSplitPaceToSecPerMile(
      s.paceHighMin,
      s.paceHighSec,
      `Segment ${i + 1}`,
      "high"
    );
    const low = Number.isFinite(lowSecMi) ? secondsPerMileToSecondsPerKm(lowSecMi) : NaN;
    const high = Number.isFinite(highSecMi)
      ? secondsPerMileToSecondsPerKm(highSecMi)
      : NaN;
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

function getPaceSecsFromSegment(seg: WorkoutSegment): {
  low: number | null;
  high: number | null;
} {
  const enc = segmentPaceEncoding(seg);
  const pace = seg.targets?.find((t) => (t.type || "").toUpperCase() === "PACE");
  if (!pace) return { low: null, high: null };
  if (pace.valueLow != null && Number.isFinite(Number(pace.valueLow))) {
    const low = Math.round(
      storedPaceSecondsKmToSecondsPerMile(Number(pace.valueLow), enc)
    );
    const high =
      pace.valueHigh != null && Number.isFinite(Number(pace.valueHigh))
        ? Math.round(
            storedPaceSecondsKmToSecondsPerMile(Number(pace.valueHigh), enc)
          )
        : null;
    return { low, high };
  }
  if (pace.value != null && Number.isFinite(Number(pace.value))) {
    const v = Math.round(
      storedPaceSecondsKmToSecondsPerMile(Number(pace.value), enc)
    );
    return { low: v, high: null };
  }
  return { low: null, high: null };
}

type SegmentQuickOverride = {
  repeatCount?: number;
  /** Set when user edits quick pace; undefined means use segment value for that part. */
  quickPaceLowMin?: string;
  quickPaceLowSec?: string;
  quickPaceHighMin?: string;
  quickPaceHighSec?: string;
};

function quickPaceDisplayStrings(
  seg: WorkoutSegment,
  o?: SegmentQuickOverride
): {
  lowMin: string;
  lowSec: string;
  highMin: string;
  highSec: string;
} {
  const { low: baseLow, high: baseHigh } = getPaceSecsFromSegment(seg);
  return {
    lowMin:
      o?.quickPaceLowMin !== undefined
        ? o.quickPaceLowMin
        : baseLow != null
          ? String(Math.floor(baseLow / 60))
          : "",
    lowSec:
      o?.quickPaceLowSec !== undefined
        ? o.quickPaceLowSec
        : baseLow != null
          ? String(Math.round(baseLow % 60)).padStart(2, "0")
          : "",
    highMin:
      o?.quickPaceHighMin !== undefined
        ? o.quickPaceHighMin
        : baseHigh != null
          ? String(Math.floor(baseHigh / 60))
          : "",
    highSec:
      o?.quickPaceHighSec !== undefined
        ? o.quickPaceHighSec
        : baseHigh != null
          ? String(Math.round(baseHigh % 60)).padStart(2, "0")
          : "",
  };
}

/** Warmup / cooldown: allow "conversational" pace (distance only, no pace prescription). */
function segmentEligibleConversationalPace(title: string): boolean {
  const t = (title || "").toLowerCase();
  return t.includes("warm") || t.includes("cool");
}

function formatTargetLine(
  target: NonNullable<WorkoutSegment["targets"]>[0],
  encodingVersion: ReturnType<typeof segmentPaceEncoding>
): string {
  const type = (target.type || "").toUpperCase();
  if (type === "PACE") {
    if (target.valueLow !== undefined && target.valueHigh !== undefined) {
      return formatPaceTargetRangeForDisplay(
        target.valueLow,
        target.valueHigh,
        encodingVersion
      );
    }
    if (target.value !== undefined && Number.isFinite(Number(target.value))) {
      return formatPaceTargetSingleForDisplay(Number(target.value), encodingVersion);
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
  const [copyRepushing, setCopyRepushing] = useState(false);
  const [duplicatingWorkout, setDuplicatingWorkout] = useState(false);
  const [pushStatus, setPushStatus] = useState<{
    success: boolean;
    message: string;
    garminWorkoutId?: number;
    garminScheduleId?: number;
    scheduledDate?: string;
  } | null>(null);
  const [showCreatedBanner, setShowCreatedBanner] = useState(false);
  const [garminToast, setGarminToast] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editDistanceMi, setEditDistanceMi] = useState("");
  const [garminConnected, setGarminConnected] = useState<boolean | null>(null);
  const [connectingGarmin, setConnectingGarmin] = useState(false);
  const [editSegments, setEditSegments] = useState<EditableSegment[]>([]);
  const [quickOrderIds, setQuickOrderIds] = useState<string[]>([]);
  const [segmentOverrides, setSegmentOverrides] = useState<
    Record<string, SegmentQuickOverride>
  >({});
  const [savingQuick, setSavingQuick] = useState(false);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);
  const [conversationalPaceBySegmentId, setConversationalPaceBySegmentId] = useState<
    Record<string, boolean>
  >({});

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
    setConversationalPaceBySegmentId({});
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
      let titleForPatch = workout.title;
      if (editDistanceMi.trim() !== "" && Number.isFinite(mi) && mi >= 0) {
        titleForPatch = formatPlannedWorkoutTitle(
          workout.workoutType,
          estimatedDistanceInMeters
        );
      }
      const patchBody: Record<string, unknown> = {
        title: titleForPatch,
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
        paceLowMin: "",
        paceLowSec: "",
        paceHighMin: "",
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
  const conversationalPaceDirty = Object.values(conversationalPaceBySegmentId).some(Boolean);
  const quickEditDirty = quickOrderDirty || quickOverridesDirty || conversationalPaceDirty;

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

  const updateQuickPaceSplit = useCallback(
    (
      segmentId: string,
      bound: "low" | "high",
      part: "min" | "sec",
      raw: string
    ) => {
      setSegmentOverrides((prev) => {
        const seg = sortedSegments.find((s) => s.id === segmentId);
        if (!seg) return prev;
        const o: SegmentQuickOverride = { ...prev[segmentId] };

        if (bound === "low") {
          if (part === "min") {
            const v = raw.replace(/\D/g, "");
            if (v === "") delete o.quickPaceLowMin;
            else o.quickPaceLowMin = v;
          } else {
            const v = raw.replace(/\D/g, "");
            if (v === "") delete o.quickPaceLowSec;
            else o.quickPaceLowSec = String(Math.min(59, parseInt(v, 10) || 0));
          }
        } else if (part === "min") {
          const v = raw.replace(/\D/g, "");
          if (v === "") delete o.quickPaceHighMin;
          else o.quickPaceHighMin = v;
        } else {
          const v = raw.replace(/\D/g, "");
          if (v === "") delete o.quickPaceHighSec;
          else o.quickPaceHighSec = String(Math.min(59, parseInt(v, 10) || 0));
        }

        const hasPace =
          o.quickPaceLowMin !== undefined ||
          o.quickPaceLowSec !== undefined ||
          o.quickPaceHighMin !== undefined ||
          o.quickPaceHighSec !== undefined;
        const hasAny = o.repeatCount != null || hasPace;
        if (!hasAny) {
          const { [segmentId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [segmentId]: o };
      });
    },
    [sortedSegments]
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
        const q = quickPaceDisplayStrings(seg, o);
        const conversational = conversationalPaceBySegmentId[seg.id];
        return {
          ...base,
          repeatCount,
          paceLowMin: conversational ? "" : q.lowMin,
          paceLowSec: conversational ? "" : q.lowSec,
          paceHighMin: conversational ? "" : q.highMin,
          paceHighSec: conversational ? "" : q.highSec,
        };
      });
      const payload = editableSegmentsToApiPayload(editable);
      await api.put(`/workouts/${workoutId}/segments`, payload);
      setQuickOrderIds([]);
      setSegmentOverrides({});
      setConversationalPaceBySegmentId({});
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
  }, [
    workout,
    getQuickOrderedSegments,
    segmentOverrides,
    conversationalPaceBySegmentId,
    workoutId,
  ]);

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
      const {
        garminWorkoutId,
        garminScheduleId,
        scheduledDate,
      } = response.data as {
        garminWorkoutId?: number;
        garminScheduleId?: number;
        scheduledDate?: string;
      };

      const dateLabel =
        scheduledDate != null && scheduledDate.length >= 10
          ? new Date(`${scheduledDate.slice(0, 10)}T12:00:00`).toLocaleDateString(
              undefined,
              { weekday: "short", month: "short", day: "numeric", year: "numeric" }
            )
          : null;

      setPushStatus({
        success: true,
        message: dateLabel
          ? `Pushed to Garmin and scheduled for ${dateLabel}. Sync your watch.`
          : "Pushed to Garmin and added to your calendar. Sync your watch.",
        garminWorkoutId,
        garminScheduleId,
        scheduledDate,
      });
      setGarminToast(
        dateLabel && garminWorkoutId != null
          ? `Scheduled for ${dateLabel} — sync your watch for today’s planned run (workout #${garminWorkoutId}).`
          : garminWorkoutId != null
            ? `Synced to Garmin (workout #${garminWorkoutId}). Sync your watch.`
            : "Synced to Garmin. Sync your watch to load it on your device."
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

  const handleCopyAndPushToGarmin = async () => {
    if (!workout) return;

    setCopyRepushing(true);
    setPushStatus(null);

    try {
      const dupRes = await api.post<{ workoutIds: string[] }>(
        `workouts/${workoutId}/duplicate`,
        { date: scheduleYmdForWorkout(workout) }
      );
      const newId = dupRes.data.workoutIds?.[0];
      if (!newId) {
        throw new Error("Duplicate did not return a workout id");
      }

      const response = await api.post(`workouts/${newId}/push-to-garmin`);
      const {
        garminWorkoutId,
        garminScheduleId,
        scheduledDate,
      } = response.data as {
        garminWorkoutId?: number;
        garminScheduleId?: number;
        scheduledDate?: string;
      };

      const dateLabel =
        scheduledDate != null && scheduledDate.length >= 10
          ? new Date(`${scheduledDate.slice(0, 10)}T12:00:00`).toLocaleDateString(
              undefined,
              { weekday: "short", month: "short", day: "numeric", year: "numeric" }
            )
          : null;

      setPushStatus({
        success: true,
        message: dateLabel
          ? `Copied workout, pushed to Garmin, scheduled for ${dateLabel}. Sync your watch.`
          : "Copied workout and pushed to Garmin. Sync your watch.",
        garminWorkoutId,
        garminScheduleId,
        scheduledDate,
      });
      setGarminToast(
        dateLabel && garminWorkoutId != null
          ? `Scheduled for ${dateLabel} — sync your watch for today’s planned run (workout #${garminWorkoutId}).`
          : garminWorkoutId != null
            ? `Synced to Garmin (workout #${garminWorkoutId}). Sync your watch.`
            : "Synced to Garmin. Sync your watch to load it on your device."
      );
      router.push(`/workouts/${newId}?created=1`);
    } catch (error: unknown) {
      console.error("Error copy-pushing to Garmin:", error);
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      setPushStatus({
        success: false,
        message:
          err.response?.data?.error ||
          err.response?.data?.details ||
          "Failed to copy and push workout to Garmin",
      });
    } finally {
      setCopyRepushing(false);
    }
  };

  const scheduleYmdForWorkout = (w: Workout): string => {
    if (w.date) {
      const d = new Date(w.date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, "0");
    const day = String(n.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const handleDuplicateWorkout = async () => {
    if (!workout) return;

    setDuplicatingWorkout(true);
    setPushStatus(null);

    try {
      const dupRes = await api.post<{ workoutIds: string[] }>(
        `workouts/${workoutId}/duplicate`,
        { date: scheduleYmdForWorkout(workout) }
      );
      const newId = dupRes.data.workoutIds?.[0];
      if (!newId) {
        throw new Error("Duplicate did not return a workout id");
      }
      setPushStatus({
        success: true,
        message: "Workout copied. Opening the new copy…",
      });
      router.push(`/workouts/${newId}?created=1`);
    } catch (error: unknown) {
      console.error("Error duplicating workout:", error);
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      setPushStatus({
        success: false,
        message:
          err.response?.data?.error ||
          err.response?.data?.details ||
          "Failed to copy workout",
      });
    } finally {
      setDuplicatingWorkout(false);
    }
  };

  const handleConnectGarmin = async () => {
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      alert("Please sign in to connect Garmin");
      return;
    }
    setConnectingGarmin(true);
    try {
      const authRes = await api.get("/auth/garmin/authorize", {
        params: { athleteId: String(athleteId), popup: "true" },
      });
      const data = authRes.data as {
        success?: boolean;
        authUrl?: string;
        error?: string;
      };
      if (!data.success || !data.authUrl) {
        throw new Error(data.error || "Invalid response from server");
      }
      const popup = window.open(
        data.authUrl,
        "garmin-oauth",
        "width=600,height=700,scrollbars=yes,resizable=yes"
      );
      if (!popup) {
        alert("Popup blocked. Please allow popups for this site.");
        setConnectingGarmin(false);
        return;
      }
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          setConnectingGarmin(false);
          const id = LocalStorageAPI.getAthleteId();
          if (id) {
            void api
              .get<{ athlete?: { garmin_connected?: boolean } }>(`/athlete/${id}`)
              .then((res) => {
                const c = res.data?.athlete?.garmin_connected;
                setGarminConnected(typeof c === "boolean" ? c : false);
              })
              .catch(() => setGarminConnected(false));
          }
        }
      }, 500);
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data.type === "GARMIN_OAUTH_SUCCESS") {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setConnectingGarmin(false);
          setGarminConnected(true);
          localStorage.setItem("garminConnected", "true");
          setGarminToast("Garmin connected. You can push this workout below.");
          window.removeEventListener("message", messageHandler);
        } else if (event.data.type === "GARMIN_OAUTH_ERROR") {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setConnectingGarmin(false);
          alert("Failed to connect Garmin: " + (event.data.error || "Unknown error"));
          window.removeEventListener("message", messageHandler);
        }
      };
      window.addEventListener("message", messageHandler);
    } catch (error: unknown) {
      console.error("Error connecting Garmin:", error);
      alert(
        "Failed to connect Garmin: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
      setConnectingGarmin(false);
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
  const isLogged = Boolean(workout.matchedActivityId ?? workout.matched_activity);
  const showGarminHeaderCard =
    !isLogged || (isLogged && alreadyOnGarmin);
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
        : "Back to Workouts";

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
      ? "Workouts"
      : simpleBackPathOnly?.startsWith("/training/day/") ||
          planPreviewPathOnly.startsWith("/training/day/")
        ? "Workout"
        : "Workout detail";

  const weekLineDisplay = navWeekLine ?? weekOnPlan;
  const dateLineDisplay = navDateLine ?? scheduleLabel;
  const weekAndDateLine = [weekLineDisplay, dateLineDisplay].filter(Boolean).join(" · ");

  const hasPaceRangeForResults =
    workout.targetPaceSecPerMile != null &&
    workout.targetPaceSecPerMileHigh != null &&
    workout.targetPaceSecPerMileHigh !== workout.targetPaceSecPerMile;

  const paceVsPlanMessage =
    hasPaceRangeForResults && workout.actualAvgPaceSecPerMile != null
      ? paceRangeDeltaMessage(
          workout.actualAvgPaceSecPerMile,
          workout.targetPaceSecPerMile,
          workout.targetPaceSecPerMileHigh
        )
      : singleTargetPaceDeltaMessage(workout.paceDeltaSecPerMile);

  let resultsPaceBadgeLabel:
    | PaceVsTargetLabel
    | "single_faster"
    | "single_slower"
    | "single_on"
    | null = null;
  if (hasPaceRangeForResults && workout.actualAvgPaceSecPerMile != null) {
    const l = paceVsTargetLabel(
      workout.actualAvgPaceSecPerMile,
      workout.targetPaceSecPerMile,
      workout.targetPaceSecPerMileHigh
    );
    if (l !== "unknown") resultsPaceBadgeLabel = l;
  } else if (workout.paceDeltaSecPerMile != null) {
    resultsPaceBadgeLabel =
      workout.paceDeltaSecPerMile > 0
        ? "single_faster"
        : workout.paceDeltaSecPerMile < 0
          ? "single_slower"
          : "single_on";
  }

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
              Workout saved. Connect Garmin below, then use Send to your watch.
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

        {isLogged && (workout.matchedActivityId || workout.matched_activity) ? (
          <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-6 sm:p-8 mb-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">
                  Your run
                </p>
                <h2 className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">
                  Results &amp; analysis
                </h2>
                {workout.matched_activity ? (
                  <p className="mt-2 text-sm text-gray-700">
                    <span className="font-medium text-gray-900">
                      {workout.matched_activity.activityName?.trim() || "Run"}
                    </span>
                    {workout.matched_activity.startTime ? (
                      <>
                        {" "}
                        ·{" "}
                        {new Date(workout.matched_activity.startTime).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
              {resultsPaceBadgeLabel != null ? (
                <div className="shrink-0">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      resultsPaceBadgeLabel === "in_range" || resultsPaceBadgeLabel === "single_on"
                        ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
                        : resultsPaceBadgeLabel === "faster" ||
                            resultsPaceBadgeLabel === "single_faster"
                          ? "bg-sky-100 text-sky-900 ring-1 ring-sky-200"
                          : "bg-amber-100 text-amber-900 ring-1 ring-amber-200"
                    }`}
                  >
                    {resultsPaceBadgeLabel === "single_faster"
                      ? "Faster than target"
                      : resultsPaceBadgeLabel === "single_slower"
                        ? "Slower than target"
                        : resultsPaceBadgeLabel === "single_on"
                          ? "On target"
                          : paceVsTargetBadgeText(resultsPaceBadgeLabel)}
                  </span>
                </div>
              ) : null}
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
                <dt className="text-xs font-medium text-gray-500">Target pace</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                  {formatPaceTargetRangeDisplay(
                    workout.targetPaceSecPerMile,
                    workout.targetPaceSecPerMileHigh
                  ) ??
                    (workout.targetPaceSecPerMile != null
                      ? formatSecPerMile(workout.targetPaceSecPerMile)
                      : "—")}
                </dd>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
                <dt className="text-xs font-medium text-gray-500">Your pace</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                  {formatSecPerMile(workout.actualAvgPaceSecPerMile) ?? "—"}
                </dd>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3 sm:col-span-1">
                <dt className="text-xs font-medium text-gray-500">Vs plan</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {paceVsPlanMessage ?? "—"}
                </dd>
              </div>
              {workout.actualDistanceMeters != null && workout.actualDistanceMeters > 0 ? (
                <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
                  <dt className="text-xs font-medium text-gray-500">Distance</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                    {(workout.actualDistanceMeters / 1609.34).toFixed(2)} mi
                  </dd>
                </div>
              ) : null}
              {workout.actualDurationSeconds != null && workout.actualDurationSeconds > 0 ? (
                <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
                  <dt className="text-xs font-medium text-gray-500">Duration</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                    {Math.round(workout.actualDurationSeconds / 60)} min
                  </dd>
                </div>
              ) : null}
              {workout.hrDeltaBpm != null ? (
                <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
                  <dt className="text-xs font-medium text-gray-500">Vs target HR (mid)</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    {workout.hrDeltaBpm > 0
                      ? `${workout.hrDeltaBpm} bpm under zone`
                      : workout.hrDeltaBpm < 0
                        ? `${Math.abs(workout.hrDeltaBpm)} bpm above zone`
                        : "On target"}
                  </dd>
                </div>
              ) : null}
            </dl>

            {workout.training_plans?.currentFiveKPace ? (
              <p className="mt-4 text-xs text-gray-500">
                Plan baseline 5K (snapshot): {workout.training_plans.currentFiveKPace}
                {workout.creditedFiveKPaceSecPerMile != null &&
                workout.creditedFiveKPaceSecPerMile > 0 ? (
                  <>
                    {" "}
                    · Implied 5K from this run:{" "}
                    <span className="font-medium text-gray-700">
                      {formatSecPerMile(workout.creditedFiveKPaceSecPerMile)}
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-gray-600">
              Prescription and segment breakdown below are your plan — scroll down to compare
              structure to what you ran.
            </p>
          </div>
        ) : null}

        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 mb-4">
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
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => void handleDuplicateWorkout()}
                  disabled={duplicatingWorkout || copyRepushing || pushing}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 shadow-sm"
                  title="Creates another GoFast workout with the same structure on this calendar date (standalone copy). Does not send to Garmin."
                >
                  {duplicatingWorkout ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700" />
                      Copying…
                    </>
                  ) : (
                    <>
                      <CopyPlus className="w-4 h-4" />
                      Copy workout
                    </>
                  )}
                </button>
              </div>
              {weekAndDateLine ? (
                <p className="text-base text-gray-800 font-medium mb-2">{weekAndDateLine}</p>
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

              {showGarminHeaderCard ? (
                <div
                  id="workout-garmin"
                  className="mt-5 rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50/40 p-4 sm:p-5 shadow-sm scroll-mt-24 ring-1 ring-orange-100/80"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3 min-w-0">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white shadow-md"
                        aria-hidden
                      >
                        <Watch className="w-6 h-6" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-orange-900">
                          Garmin
                        </p>
                        <p className="text-base font-semibold text-gray-900">
                          {alreadyOnGarmin ? "On your watch calendar" : "Send to your watch"}
                        </p>
                        <div className="mt-1.5 text-sm text-gray-700">
                          {garminConnected === null ? (
                            <span className="text-gray-600">Checking connection…</span>
                          ) : !garminConnected ? (
                            <span>
                              <span className="font-medium text-gray-900">Not connected.</span>{" "}
                              Link Garmin to send this workout to Garmin Connect and your device.
                            </span>
                          ) : alreadyOnGarmin ? (
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                              <span>
                                Synced
                                {workout.garminWorkoutId != null
                                  ? ` (workout #${workout.garminWorkoutId})`
                                  : ""}
                                {isLogged
                                  ? " — tap Update if you changed the plan or it's missing on your watch."
                                  : " — use Update if you edited the workout or need a fresh sync."}
                              </span>
                            </span>
                          ) : (
                            <span>
                              Ready to send — appears on Garmin Connect and your watch calendar for{" "}
                              {scheduleLabel || "this day"}.
                            </span>
                          )}
                        </div>
                        {garminConnected ? (
                          <div className="mt-2">
                            <Link
                              href="/settings/garmin"
                              className="text-sm font-medium text-orange-800 hover:text-orange-950 underline-offset-2 hover:underline"
                            >
                              Garmin settings
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end sm:pt-1 shrink-0">
                      {garminConnected === true && !alreadyOnGarmin && !isLogged && (
                        <button
                          type="button"
                          onClick={handlePushToGarmin}
                          disabled={pushing || copyRepushing || duplicatingWorkout}
                          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 shadow-md"
                        >
                          {pushing ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                              Sending…
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Send to your watch
                            </>
                          )}
                        </button>
                      )}
                      {garminConnected === true && alreadyOnGarmin && (
                        <button
                          type="button"
                          onClick={handleCopyAndPushToGarmin}
                          disabled={copyRepushing || pushing || duplicatingWorkout}
                          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-orange-400 bg-white text-orange-900 text-sm font-semibold hover:bg-orange-50 disabled:opacity-50 shadow-sm"
                          title="Creates a new copy of this workout and sends it to Garmin. Use if you removed it from Garmin Connect, edited segments, or the watch didn't pick it up."
                        >
                          {copyRepushing ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600" />
                              Updating…
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              Update on Garmin
                            </>
                          )}
                        </button>
                      )}
                      {!garminConnected && garminConnected !== null && !isLogged && (
                        <button
                          type="button"
                          onClick={handleConnectGarmin}
                          disabled={connectingGarmin || duplicatingWorkout}
                          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 shadow-md"
                        >
                          {connectingGarmin ? "Connecting…" : "Connect Garmin"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
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
                    {pushStatus.garminScheduleId != null
                      ? ` · schedule id: ${pushStatus.garminScheduleId}`
                      : ""}
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
              Add blocks, set repeat counts (e.g. 4×800 → 5×800), and reorder—then save. Recovery
              between reps: add a separate segment (distance or time), for example an easy jog.
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
                  <div className="space-y-4">
                    <label className="block max-w-xs">
                      <span className="text-xs font-semibold uppercase text-gray-500">
                        Repeat block (×)
                      </span>
                      <p className="mt-1 text-xs text-gray-600">
                        Number of times to repeat <strong>this</strong> step (intervals). Leave blank
                        for a single step.
                      </p>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={2}
                        max={20}
                        step={1}
                        placeholder="e.g. 4"
                        value={segment.repeatCount}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setEditSegments((prev) =>
                              prev.map((s) =>
                                s.clientKey === segment.clientKey
                                  ? { ...s, repeatCount: "" }
                                  : s
                              )
                            );
                            return;
                          }
                          const n = parseInt(raw, 10);
                          if (!Number.isFinite(n)) return;
                          const clamped = Math.min(20, Math.max(0, n));
                          setEditSegments((prev) =>
                            prev.map((s) =>
                              s.clientKey === segment.clientKey
                                ? { ...s, repeatCount: String(clamped) }
                                : s
                            )
                          );
                        }}
                        onBlur={() => {
                          setEditSegments((prev) =>
                            prev.map((s) => {
                              if (s.clientKey !== segment.clientKey) return s;
                              const t = s.repeatCount.trim();
                              if (!t) return { ...s, repeatCount: "" };
                              const n = parseInt(t, 10);
                              if (!Number.isFinite(n) || n <= 1) {
                                return { ...s, repeatCount: "" };
                              }
                              return { ...s, repeatCount: String(Math.min(20, n)) };
                            })
                          );
                        }}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                          Pace low
                        </span>
                        <PaceMiSplitEditor
                          minValue={segment.paceLowMin}
                          secValue={segment.paceLowSec}
                          onMinChange={(v) =>
                            setEditSegments((prev) =>
                              prev.map((s) =>
                                s.clientKey === segment.clientKey
                                  ? { ...s, paceLowMin: v }
                                  : s
                              )
                            )
                          }
                          onSecChange={(v) =>
                            setEditSegments((prev) =>
                              prev.map((s) =>
                                s.clientKey === segment.clientKey
                                  ? { ...s, paceLowSec: v }
                                  : s
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                          Pace high
                        </span>
                        <PaceMiSplitEditor
                          minValue={segment.paceHighMin}
                          secValue={segment.paceHighSec}
                          onMinChange={(v) =>
                            setEditSegments((prev) =>
                              prev.map((s) =>
                                s.clientKey === segment.clientKey
                                  ? { ...s, paceHighMin: v }
                                  : s
                              )
                            )
                          }
                          onSecChange={(v) =>
                            setEditSegments((prev) =>
                              prev.map((s) =>
                                s.clientKey === segment.clientKey
                                  ? { ...s, paceHighSec: v }
                                  : s
                              )
                            )
                          }
                        />
                      </div>
                    </div>
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
                const qStr = quickPaceDisplayStrings(segment, o);
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

                    {!isLogged &&
                      !isEditing &&
                      segmentEligibleConversationalPace(segment.title) && (
                        <div className="mb-4">
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                              checked={!!conversationalPaceBySegmentId[segment.id]}
                              onChange={() =>
                                setConversationalPaceBySegmentId((prev) => ({
                                  ...prev,
                                  [segment.id]: !prev[segment.id],
                                }))
                              }
                            />
                            <span>Conversational pace (no pace target)</span>
                          </label>
                          {conversationalPaceBySegmentId[segment.id] ? (
                            <p className="text-sm text-gray-600 mt-2 italic pl-6">
                              Easy / conversational — no pace prescription. Distance above is the
                              target.
                            </p>
                          ) : null}
                        </div>
                      )}

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

                      {segment.targets &&
                        segment.targets.length > 0 &&
                        !conversationalPaceBySegmentId[segment.id] && (
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                                      <div>
                                        <span className="text-xs font-medium text-gray-500 block mb-1">
                                          Pace low
                                        </span>
                                        <PaceMiSplitEditor
                                          minValue={qStr.lowMin}
                                          secValue={qStr.lowSec}
                                          onMinChange={(v) =>
                                            updateQuickPaceSplit(segment.id, "low", "min", v)
                                          }
                                          onSecChange={(v) =>
                                            updateQuickPaceSplit(segment.id, "low", "sec", v)
                                          }
                                        />
                                      </div>
                                      <div>
                                        <span className="text-xs font-medium text-gray-500 block mb-1">
                                          Pace high
                                        </span>
                                        <PaceMiSplitEditor
                                          minValue={qStr.highMin}
                                          secValue={qStr.highSec}
                                          onMinChange={(v) =>
                                            updateQuickPaceSplit(segment.id, "high", "min", v)
                                          }
                                          onSecChange={(v) =>
                                            updateQuickPaceSplit(segment.id, "high", "sec", v)
                                          }
                                        />
                                      </div>
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
                                    {formatTargetLine(
                                      target,
                                      segmentPaceEncoding(segment)
                                    )}
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
                      setConversationalPaceBySegmentId({});
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
          <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Mileage</h2>
            <ul className="text-sm text-gray-800 space-y-1.5 list-none p-0 m-0">
              {planDayMi != null && (
                <li>
                  <span className="font-medium text-gray-900">Day total (plan): </span>~
                  {planDayMi.toFixed(1)} mi
                </li>
              )}
              {structuredMiLine.length > 0 && (
                <li>
                  <span className="font-medium text-gray-900">Structured steps (GPS / Garmin): </span>
                  {structuredMiLine}
                </li>
              )}
            </ul>
            {showVolumeGapNote && (
              <p className="text-xs text-gray-600 mt-3">
                If the plan lists more miles than these steps, add easy miles before/after—often on
                quality days.
              </p>
            )}
          </div>
        )}

        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/90 px-4 py-4 mb-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Run with others
          </p>
          <p className="text-sm text-gray-600 mb-3">
            Host a meetup so people can RSVP and see this session—not part of your main workout steps
            above.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
            {workout.city_runs && workout.city_runs.length > 0 ? (
              <Link
                href={`/gorun/${workout.city_runs[0].id}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
              >
                <Users className="w-4 h-4" />
                Manage meetup
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => router.push(`/workouts/${workout.id}/let-others-join`)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              <Users className="w-4 h-4" />
              {workout.city_runs && workout.city_runs.length > 0
                ? "Add another meetup"
                : "Invite others to this workout"}
            </button>
          </div>
          {workout.slug ? (
            <p className="mt-3 text-xs text-gray-600">
              Share:{" "}
              <Link
                href={`/mytrainingruns/${workout.slug}`}
                className="text-sky-700 font-medium underline"
              >
                /mytrainingruns/{workout.slug}
              </Link>
            </p>
          ) : null}
        </div>

      </div>
        </main>
      </div>
    </div>
  );
}
