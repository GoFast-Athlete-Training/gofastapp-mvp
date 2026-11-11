"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";
import { PaceMiSplitEditor } from "@/components/workout/PaceMiSplitEditor";
import { parseSplitPaceToSecPerMile, secPerMileToSplitStrings } from "@/lib/workout/pace-mi-split";
import {
  formatStoredPaceAsMinPerMile,
  parsePaceToSecondsPerMile,
  secondsPerMileToSecondsPerKm,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import {
  backLabelFromPath,
  isSafeInternalBackPath,
  workoutDetailPathWithBackHref,
} from "@/lib/training/workout-nav-query";
import WorkoutCreateEntry, {
  type CreateEntryPath,
} from "@/components/workouts/WorkoutCreateEntry";
import type { CatalogueBrowseItem } from "@/components/workouts/workout-create-types";
import type { WorkoutStep } from "@/lib/training/prescription";
import {
  formatSegmentDistance,
  formatSegmentDuration,
} from "@/lib/training/segment-summary";
import {
  apiSegmentsToSlots,
  intervalBlockHeaderLabel,
  materializeMainSlotRows,
  slotHasPositiveDuration,
  type SlotData,
} from "@/lib/training/create-workout-slot-map";
export type { SlotData };
import type { WorkoutShape } from "@/lib/training/workout-shape-service";
import {
  pacedShapeFromConfirmed,
  buildShapeFromPasteText,
} from "@/lib/training/paste-workout-pipeline";
import {
  assembleWorkoutStepsFromPacedShape,
  normalizeAiSegmentsForAssembler,
} from "@/lib/training/workout-assembler";
import {
  suggestRaceBlocksFromGoal,
  type PacingStrategy,
} from "@/lib/races/race-pacing-blocks";
import {
  isMarathonPaceWorkBlockTitle,
  slotPaceFromGoalRaceBand,
} from "@/lib/training/marathon-pace-block";

const WORKOUT_TYPES = ["Easy", "Tempo", "LongRun", "Intervals", "Race"] as const;

function applyGoalRaceMpPacesToMainSlots(
  mainSegments: SlotData[],
  goalRacePaceSecPerMile: number | null
): SlotData[] {
  if (goalRacePaceSecPerMile == null || goalRacePaceSecPerMile <= 0) return mainSegments;
  const band = slotPaceFromGoalRaceBand(goalRacePaceSecPerMile);
  return mainSegments.map((s) => {
    const title = (s.segmentTitle ?? "Work").trim();
    if (!isMarathonPaceWorkBlockTitle(title)) return s;
    return { ...s, paceValueLow: band.paceValueLow, paceValueHigh: band.paceValueHigh };
  });
}

/** Stored PACE targets are sec/km, encoding v2 (same as workout detail / Garmin). */
const PACE_SLOT_ENC = 2 as const;

function emptySlot(): SlotData {
  return { durationType: "DISTANCE", durationValue: 0 };
}

type ApiSegment = {
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  targets?: Array<{
    type: string;
    valueLow?: number;
    valueHigh?: number;
    /** Some generators send a single PACE scalar (sec/km, v2). */
    value?: number;
  }>;
  repeatCount?: number;
  recoveryDurationType?: string | null;
  recoveryDurationValue?: number | null;
};

/** One line = miles + two M:SS/mile paces (pace band); all lines must match for tabular paste. */
const TABULAR_MILE_PACE_ROW = /^\s*(\d+\.?\d*)\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s*$/;

/**
 * Parse coach-style split lines into API-shaped segments (deterministic; skips AI).
 * Example line: `5 7:00 7:20` → 5 mi, pace band 7:00–7:20/mi.
 */
function tryParseTabularMilePacePaste(text: string): ApiSegment[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const out: ApiSegment[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TABULAR_MILE_PACE_ROW);
    if (!m) return null;
    const dist = parseFloat(m[1]);
    if (!Number.isFinite(dist) || dist <= 0) return null;
    let valueLow: number;
    let valueHigh: number;
    try {
      const s1 = parsePaceToSecondsPerMile(m[2].trim());
      const s2 = parsePaceToSecondsPerMile(m[3].trim());
      const k1 = secondsPerMileToSecondsPerKm(s1);
      const k2 = secondsPerMileToSecondsPerKm(s2);
      valueLow = Math.min(k1, k2);
      valueHigh = Math.max(k1, k2);
    } catch {
      return null;
    }
    out.push({
      stepOrder: i + 1,
      title: `Segment ${i + 1}`,
      durationType: "DISTANCE",
      durationValue: dist,
      targets: [{ type: "PACE", valueLow, valueHigh }],
    });
  }
  return out;
}

/** Sec/km (stored API value, encoding v2) to "M:SS" per mile — shared with workout detail */
function secPerKmToPaceDisplay(value: number): string {
  return formatStoredPaceAsMinPerMile(value, 2);
}

/** Pace band from a target object (sec/km, encoding v2). Case-insensitive type; supports single `value`. */
function paceBandSecKmFromTarget(t: { type?: string; valueLow?: number; valueHigh?: number; value?: number }): {
  low?: number;
  high?: number;
} {
  if (String(t.type ?? "").toUpperCase() !== "PACE") return {};
  const vl = typeof t.valueLow === "number" && Number.isFinite(t.valueLow) ? t.valueLow : undefined;
  const vh = typeof t.valueHigh === "number" && Number.isFinite(t.valueHigh) ? t.valueHigh : undefined;
  const v = typeof t.value === "number" && Number.isFinite(t.value) ? t.value : undefined;
  if (vl != null && vh != null) {
    return { low: Math.min(vl, vh), high: Math.max(vl, vh) };
  }
  if (v != null) return { low: v, high: v };
  if (vl != null) return { low: vl, high: vl };
  if (vh != null) return { low: vh, high: vh };
  return {};
}

function hrBandFromTarget(t: { type?: string; valueLow?: number; valueHigh?: number }): {
  min?: number;
  max?: number;
} {
  if (String(t.type ?? "").toUpperCase() !== "HEART_RATE") return {};
  const lo = typeof t.valueLow === "number" && Number.isFinite(t.valueLow) ? t.valueLow : undefined;
  const hi = typeof t.valueHigh === "number" && Number.isFinite(t.valueHigh) ? t.valueHigh : undefined;
  if (lo == null || hi == null) return {};
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
}

function slotLegPaceLine(leg: SlotData): string | null {
  const low = leg.paceValueLow != null ? secPerKmToPaceDisplay(leg.paceValueLow) : "";
  const high = leg.paceValueHigh != null ? secPerKmToPaceDisplay(leg.paceValueHigh) : "";
  if (!low && !high) return null;
  if (low && high && low !== high) return `${low}–${high}/mi`;
  return `${low || high}/mi`;
}

function slotOneLine(slot: SlotData, paired?: SlotData | null): string {
  const dist =
    slot.durationValue > 0
      ? slot.durationType === "TIME"
        ? `${slot.durationValue} min`
        : formatSegmentDistance(slot.durationValue)
      : "";
  const reps =
    slot.repeatCount != null && slot.repeatCount > 1 ? slot.repeatCount : 0;
  const low = slot.paceValueLow != null ? secPerKmToPaceDisplay(slot.paceValueLow) : "";
  const high = slot.paceValueHigh != null ? secPerKmToPaceDisplay(slot.paceValueHigh) : "";
  const pace = low && high ? (low === high ? `${low}/mi` : `${low}-${high}/mi`) : "";

  if (paired && reps > 1 && !(paired.repeatCount != null && paired.repeatCount > 1)) {
    const onDist =
      slot.durationValue > 0
        ? slot.durationType === "TIME"
          ? `${slot.durationValue} min`
          : formatSegmentDistance(slot.durationValue)
        : "";
    const offDist =
      paired.durationValue > 0
        ? paired.durationType === "TIME"
          ? `${paired.durationValue} min`
          : formatSegmentDistance(paired.durationValue)
        : "";
    const pl = paired.paceValueLow != null ? secPerKmToPaceDisplay(paired.paceValueLow) : "";
    const ph = paired.paceValueHigh != null ? secPerKmToPaceDisplay(paired.paceValueHigh) : "";
    const offPace = pl && ph ? (pl === ph ? `@ ${pl}/mi` : `@ ${pl}-${ph}/mi`) : "";
    const onPart = [onDist, pace].filter(Boolean).join(" ");
    const offPart = [offDist, offPace].filter(Boolean).join(" ");
    return `${reps}× (${onPart} / ${offPart})`;
  }

  const repsLabel = reps > 1 ? `${reps}× ` : "";
  let recovery = "";
  if (slot.recoveryDurationValue != null && slot.recoveryDurationValue > 0) {
    recovery =
      slot.recoveryDurationType === "TIME"
        ? ` / ${slot.recoveryDurationValue} min easy`
        : ` / ${formatSegmentDistance(slot.recoveryDurationValue)} easy`;
  }
  const body = [`${repsLabel}${dist}`.trim(), pace].filter(Boolean).join(" — ");
  return `${body || "—"}${recovery}`;
}

function slotToPaceSplitState(slot: SlotData | null): {
  lowMin: string;
  lowSec: string;
  highMin: string;
  highSec: string;
} {
  let lowMin = "";
  let lowSec = "";
  let highMin = "";
  let highSec = "";
  if (slot?.paceValueLow != null) {
    const secMi = Math.round(
      storedPaceSecondsKmToSecondsPerMile(slot.paceValueLow, PACE_SLOT_ENC)
    );
    const lo = secPerMileToSplitStrings(secMi);
    lowMin = lo.min;
    lowSec = lo.sec;
  }
  if (slot?.paceValueHigh != null) {
    const secMi = Math.round(
      storedPaceSecondsKmToSecondsPerMile(slot.paceValueHigh, PACE_SLOT_ENC)
    );
    const hi = secPerMileToSplitStrings(secMi);
    highMin = hi.min;
    highSec = hi.sec;
  }
  return { lowMin, lowSec, highMin, highSec };
}

type EditingTarget =
  | { kind: "warmup" }
  | { kind: "cooldown" }
  | { kind: "main"; index: number };

function catalogueCardSubtitle(item: CatalogueBrowseItem): string {
  if (item.workoutType === "Intervals") {
    const reps = item.workBaseReps ?? "?";
    const meters = item.workBaseRepMeters ?? "?";
    const bits = [`${reps}×${meters}m`];
    if (item.recoveryDurationSeconds != null && item.recoveryDurationSeconds > 0) {
      bits.push(`${item.recoveryDurationSeconds}s jog`);
    } else if (item.recoveryDistanceMeters != null && item.recoveryDistanceMeters > 0) {
      bits.push(`${item.recoveryDistanceMeters}m jog`);
    }
    return bits.join(" · ");
  }
  const d = item.description?.trim();
  if (d && d.length > 0) return d.length > 96 ? `${d.slice(0, 96)}…` : d;
  return item.workoutType;
}

type GoFastGenResponse =
  | { needsPace: true; message: string }
  | { segments: ApiSegment[]; suggestedTitle: string; suggestedDescription: string };

function CreateWorkoutPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const fromHostRun =
    fromParam === "build-a-run" || fromParam === "host-a-run";
  const hostRunBackHref = "/host-a-run";
  const raceDayMode = searchParams.get("raceDay") === "1";
  const racePlanId = searchParams.get("planId")?.trim() ?? "";
  const raceDateKey = searchParams.get("date")?.trim() ?? "";
  const planDayAssignMode = Boolean(
    !raceDayMode && racePlanId && raceDateKey && /^\d{4}-\d{2}-\d{2}$/.test(raceDateKey)
  );
  const raceDayBackHref = searchParams.get("back")?.trim() || "/training";
  const rawBuilderBack = searchParams.get("back")?.trim() ?? "";
  const builderBackHref = isSafeInternalBackPath(rawBuilderBack)
    ? rawBuilderBack
    : fromHostRun
      ? hostRunBackHref
      : raceDayMode
        ? raceDayBackHref
        : "/gorun";
  const [workoutType, setWorkoutType] = useState<string>("Easy");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [warmup, setWarmup] = useState<SlotData | null>(null);
  const [mainSegments, setMainSegments] = useState<SlotData[]>([]);
  const [cooldown, setCooldown] = useState<SlotData | null>(null);
  const [raceGoalPaceSecPerMi, setRaceGoalPaceSecPerMi] = useState<number | null>(null);
  const [raceTotalMiles, setRaceTotalMiles] = useState<number>(13.1);
  const [raceSuggestStrategy, setRaceSuggestStrategy] = useState<PacingStrategy>("even");

  const [sourceText, setSourceText] = useState("");
  const [deriving, setDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const [goFastGenerating, setGoFastGenerating] = useState(false);
  /** Server message when POST gofast-generate returns needsPace */
  const [needsPaceHint, setNeedsPaceHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** YYYY-MM-DD from date input; optional, shown on home & workout cards */
  const [scheduledDate, setScheduledDate] = useState("");
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [assignToPlanDay, setAssignToPlanDay] = useState(false);
  const [pendingShape, setPendingShape] = useState<WorkoutShape | null>(null);
  const [pendingShapeMeta, setPendingShapeMeta] = useState<{
    suggestedTitle: string;
    suggestedDescription: string;
  } | null>(null);
  const [applyingPaces, setApplyingPaces] = useState(false);
  const [athleteFiveKPace, setAthleteFiveKPace] = useState<string | null>(null);
  const [createEntryPath, setCreateEntryPath] = useState<CreateEntryPath>(null);
  const [aiGeneratePrompt, setAiGeneratePrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [presetTypeFilter, setPresetTypeFilter] = useState<string>("");
  /** Optional override for POST gofast-generate (same idea as Race distance presets). */
  const [templateDistanceMi, setTemplateDistanceMi] = useState("");
  const [catalogueItems, setCatalogueItems] = useState<CatalogueBrowseItem[]>([]);
  const [catalogueBrowseError, setCatalogueBrowseError] = useState<string | null>(null);
  const [catalogueGeneratingId, setCatalogueGeneratingId] = useState<string | null>(null);
  /** When set, POST /api/workouts includes catalogueWorkoutId for lazy re-materialize / attribution. */
  const [selectedCatalogueId, setSelectedCatalogueId] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null);
  /** Pace low / high split fields while a slot editor is open (matches /workouts/[id]). */
  const [editingPaceLowMin, setEditingPaceLowMin] = useState("");
  const [editingPaceLowSec, setEditingPaceLowSec] = useState("");
  const [editingPaceHighMin, setEditingPaceHighMin] = useState("");
  const [editingPaceHighSec, setEditingPaceHighSec] = useState("");

  const hasSlots = warmup !== null || mainSegments.length > 0 || cooldown !== null;

  const hasPositiveDuration =
    slotHasPositiveDuration(warmup) ||
    slotHasPositiveDuration(cooldown) ||
    mainSegments.some((s) => slotHasPositiveDuration(s));

  const selectedCatalogueLabel = useMemo(() => {
    if (!selectedCatalogueId) return null;
    const row = catalogueItems.find((i) => i.id === selectedCatalogueId);
    return row?.name?.trim() || row?.workoutType || null;
  }, [catalogueItems, selectedCatalogueId]);

  useEffect(() => {
    if (!raceDayMode) return;
    setWorkoutType("Race");
    if (raceDateKey) setScheduledDate(raceDateKey);
  }, [raceDayMode, raceDateKey]);

  useEffect(() => {
    if (planDayAssignMode && raceDateKey) setScheduledDate(raceDateKey);
  }, [planDayAssignMode, raceDateKey]);

  useEffect(() => {
    if (planDayAssignMode) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ activePlanSummary?: { id?: string } }>("training/upcoming");
        if (!cancelled) setActivePlanId(data.activePlanSummary?.id?.trim() || null);
      } catch {
        if (!cancelled) setActivePlanId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planDayAssignMode]);

  const goalPacePlanId = planDayAssignMode ? racePlanId : activePlanId;

  useEffect(() => {
    if (!goalPacePlanId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{
          goalRacePaceResolved?: { goalPaceSecPerMile?: number | null };
        }>(`training-plan/${encodeURIComponent(goalPacePlanId)}`);
        if (cancelled) return;
        const pace = data.goalRacePaceResolved?.goalPaceSecPerMile;
        if (pace != null && pace > 0) setRaceGoalPaceSecPerMi(pace);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goalPacePlanId]);

  useEffect(() => {
    if (!raceDayMode || !racePlanId || !raceDateKey) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{
          scheduled?: { title?: string };
          segments?: Array<{
            title: string;
            durationType: string;
            durationValue: number;
            targets?: Array<{
              type: string;
              valueLow?: number;
              valueHigh?: number;
            }>;
            repeatCount?: number | null;
          }>;
        }>(`training/race-day?planId=${encodeURIComponent(racePlanId)}&date=${encodeURIComponent(raceDateKey)}`);
        if (cancelled) return;
        const scheduledTitle = data.scheduled?.title?.trim();
        if (scheduledTitle) setName(scheduledTitle);
        const segs = data.segments ?? [];
        if (segs.length > 0) {
          setMainSegments(
            segs.map((seg) => {
              const paceTarget = seg.targets?.find((t) => t.type === "PACE");
              return {
                durationType:
                  seg.durationType === "TIME" ? ("TIME" as const) : ("DISTANCE" as const),
                durationValue: seg.durationValue,
                segmentTitle: seg.title,
                paceValueLow: paceTarget?.valueLow,
                paceValueHigh: paceTarget?.valueHigh,
                repeatCount: seg.repeatCount ?? undefined,
              };
            })
          );
        }
      } catch {
        /* optional preload */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [raceDayMode, racePlanId, raceDateKey]);

  useEffect(() => {
    if (!raceDayMode || !racePlanId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{
          goalRacePaceResolved?: {
            goalPaceSecPerMile?: number | null;
            raceDistanceMiles?: number | null;
          };
        }>(`training-plan/${encodeURIComponent(racePlanId)}`);
        if (cancelled) return;
        const pace = data.goalRacePaceResolved?.goalPaceSecPerMile;
        if (pace != null && pace > 0) setRaceGoalPaceSecPerMi(pace);
        const miles = data.goalRacePaceResolved?.raceDistanceMiles;
        if (miles != null && miles > 0) setRaceTotalMiles(miles);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [raceDayMode, racePlanId]);

  useEffect(() => {
    if (raceDayMode || !presetTypeFilter || createEntryPath !== "catalogue") return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ items?: CatalogueBrowseItem[] }>(
          `workouts/catalogue-browse?workoutType=${encodeURIComponent(presetTypeFilter)}`
        );
        if (!cancelled && Array.isArray(data?.items)) {
          setCatalogueItems(data.items);
          setCatalogueBrowseError(null);
        }
      } catch {
        if (!cancelled) {
          setCatalogueBrowseError("Could not load catalogue presets.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [raceDayMode, presetTypeFilter, createEntryPath]);

  useEffect(() => {
    if (raceDayMode) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ athlete?: { fiveKPace?: string | null } }>("athlete/me");
        if (!cancelled) setAthleteFiveKPace(data.athlete?.fiveKPace?.trim() || null);
      } catch {
        if (!cancelled) setAthleteFiveKPace(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [raceDayMode]);

  useEffect(() => {
    if (!editingTarget) return;
    const label =
      editingTarget.kind === "warmup"
        ? "Warmup"
        : editingTarget.kind === "cooldown"
          ? "Cooldown"
          : `Segment ${editingTarget.index + 1}`;
    const ctx = `${label} segment`;
    const base =
      editingTarget.kind === "warmup"
        ? warmup ?? emptySlot()
        : editingTarget.kind === "cooldown"
          ? cooldown ?? emptySlot()
          : mainSegments[editingTarget.index] ?? emptySlot();

    let paceValueLow: number | undefined;
    if (!editingPaceLowMin.trim() && !editingPaceLowSec.trim()) {
      paceValueLow = undefined;
    } else {
      try {
        const secMi = parseSplitPaceToSecPerMile(
          editingPaceLowMin,
          editingPaceLowSec,
          ctx,
          "low"
        );
        paceValueLow = Number.isFinite(secMi)
          ? secondsPerMileToSecondsPerKm(secMi)
          : base.paceValueLow;
      } catch {
        paceValueLow = base.paceValueLow;
      }
    }

    let paceValueHigh: number | undefined;
    if (!editingPaceHighMin.trim() && !editingPaceHighSec.trim()) {
      paceValueHigh = undefined;
    } else {
      try {
        const secMi = parseSplitPaceToSecPerMile(
          editingPaceHighMin,
          editingPaceHighSec,
          ctx,
          "high"
        );
        paceValueHigh = Number.isFinite(secMi)
          ? secondsPerMileToSecondsPerKm(secMi)
          : base.paceValueHigh;
      } catch {
        paceValueHigh = base.paceValueHigh;
      }
    }

    if (paceValueLow === base.paceValueLow && paceValueHigh === base.paceValueHigh) return;

    const next = { ...base, paceValueLow, paceValueHigh };
    setSelectedCatalogueId(null);
    if (editingTarget.kind === "warmup") setWarmup(next);
    else if (editingTarget.kind === "cooldown") setCooldown(next);
    else {
      setMainSegments((prev) => {
        const copy = [...prev];
        copy[editingTarget.index] = next;
        return copy;
      });
    }
  }, [
    editingTarget,
    editingPaceLowMin,
    editingPaceLowSec,
    editingPaceHighMin,
    editingPaceHighSec,
    warmup,
    mainSegments,
    cooldown,
  ]);

  const applySuggestedRaceBlocks = () => {
    const pace = raceGoalPaceSecPerMi ?? 480;
    const blocks = suggestRaceBlocksFromGoal({
      totalMiles: raceTotalMiles,
      goalPaceSecPerMi: pace,
      strategy: raceSuggestStrategy,
    });
    if (blocks.length === 0) return;
    setWarmup(null);
    setCooldown(null);
    setMainSegments(
      blocks.map((b) => ({
        durationType: "DISTANCE" as const,
        durationValue: b.miles,
        segmentTitle: b.name,
        paceValueLow: secondsPerMileToSecondsPerKm(b.paceSecPerMiLow),
        paceValueHigh: secondsPerMileToSecondsPerKm(b.paceSecPerMiHigh),
      }))
    );
    setName("Race — pacing blocks");
    setDescription(`${blocks.length} blocks from goal (${raceSuggestStrategy} split).`);
    setDeriveError(null);
  };

  const clearSegmentsUsePasteInstead = () => {
    setWarmup(null);
    setMainSegments([]);
    setCooldown(null);
    setEditingTarget(null);
    setEditingPaceLowMin("");
    setEditingPaceLowSec("");
    setEditingPaceHighMin("");
    setEditingPaceHighSec("");
    setDeriveError(null);
    setSelectedCatalogueId(null);
    setCreateEntryPath(null);
    setPendingShape(null);
    setPendingShapeMeta(null);
  };

  const handleCsvSegments = (steps: WorkoutStep[]) => {
    applyDerivedSegmentsToCreateForm({
      segments: steps as ApiSegment[],
      suggestedTitle: "CSV workout",
      suggestedDescription: "Imported from CSV",
    });
    setCreateEntryPath(null);
  };

  const handleUseBuiltWorkoutOnPlanDay = async (workoutId: string) => {
    if (!planDayAssignMode || !racePlanId || !raceDateKey) return;
    try {
      const { data } = await api.get<{
        workout?: { title?: string; workoutType?: string; segments?: ApiSegment[] };
      }>(`workouts/${encodeURIComponent(workoutId)}/segments`);
      const w = data.workout;
      const segments = w?.segments ?? [];
      if (segments.length === 0) {
        alert("That workout has no segments.");
        return;
      }
      await api.post("training/plan-day/assign", {
        planId: racePlanId,
        date: raceDateKey,
        title: w?.title?.trim() || "Workout",
        workoutType: w?.workoutType || "Easy",
        segments,
      });
      router.push(builderBackHref);
    } catch {
      alert("Could not assign workout to this plan day.");
    }
  };

  const totalDistanceMiFromApiSegments = (segments: ApiSegment[]): number => {
    let mi = 0;
    for (const s of segments) {
      if (s.durationType !== "DISTANCE") continue;
      const reps = s.repeatCount != null && s.repeatCount > 1 ? s.repeatCount : 1;
      mi += s.durationValue * reps;
      if (
        s.repeatCount != null &&
        s.repeatCount > 1 &&
        s.recoveryDurationType === "DISTANCE" &&
        s.recoveryDurationValue != null &&
        s.recoveryDurationValue > 0
      ) {
        mi += s.recoveryDurationValue * s.repeatCount;
      }
    }
    return mi;
  };

  const inferWorkoutTypeFromApiSegments = (segments: ApiSegment[]): string => {
    const titles = segments.map((s) => (s.title ?? "").toLowerCase()).join(" ");
    const marathonPaced = /\bmarathon\b|\bmp\b/.test(titles);
    const totalMi = totalDistanceMiFromApiSegments(segments);
    if (marathonPaced && totalMi >= 11.5 && totalMi <= 15) return "LongRun";
    if (segments.some((s) => (s.repeatCount ?? 0) > 1)) {
      if (marathonPaced && totalMi >= 10) return "LongRun";
      return "Intervals";
    }
    if (/\btempo\b|\bthreshold\b/.test(titles)) return "Tempo";
    if (/\blong\b/.test(titles)) return "LongRun";
    return workoutType || "Easy";
  };

  const applyDerivedSegmentsToCreateForm = (params: {
    segments: ApiSegment[];
    suggestedTitle: string;
    suggestedDescription: string;
  }) => {
    const slots = apiSegmentsToSlots(params.segments);
    setWarmup(slots.warmup);
    setMainSegments(applyGoalRaceMpPacesToMainSlots(slots.mainSegments, raceGoalPaceSecPerMi));
    setCooldown(slots.cooldown);
    const genericTitles = new Set(["Track intervals", "Parsed workout", "Workout"]);
    const titleCandidate = params.suggestedTitle?.trim() ?? "";
    const descCandidate = params.suggestedDescription?.trim() ?? "";
    const resolvedTitle =
      titleCandidate && !genericTitles.has(titleCandidate)
        ? titleCandidate
        : descCandidate.slice(0, 80) || titleCandidate || "Workout";
    setName((prev) => prev.trim() || resolvedTitle);
    setDescription((prev) => prev.trim() || descCandidate);
    if (!raceDayMode) {
      setWorkoutType(inferWorkoutTypeFromApiSegments(params.segments));
    }
    requestAnimationFrame(() => {
      document
        .getElementById("workout-builder-segments")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /** Catalogue quick-save → workout detail (segments already materialized server-side). */
  const createWorkoutFromDerivedSegments = async (params: {
    segments: ApiSegment[];
    suggestedTitle: string;
    suggestedDescription: string;
    workoutTypeOverride?: string;
    catalogueWorkoutId?: string | null;
  }) => {
    const title = params.suggestedTitle?.trim() || "Workout";
    const segments = params.segments.filter(
      (s) =>
        (typeof s.durationValue === "number" && s.durationValue > 0) ||
        (s.repeatCount != null && s.repeatCount > 0)
    );
    if (segments.length === 0) {
      setDeriveError("Could not build any workout segments from that paste.");
      return;
    }
    const type =
      params.workoutTypeOverride?.trim() ||
      inferWorkoutTypeFromApiSegments(segments);
    const response = await api.post<{ workout: { id: string } }>("workouts", {
      title,
      description: params.suggestedDescription?.trim() || "",
      workoutType: type,
      segments,
      ...(scheduledDate.trim() ? { date: scheduledDate.trim() } : {}),
      ...(params.catalogueWorkoutId?.trim()
        ? { catalogueWorkoutId: params.catalogueWorkoutId.trim() }
        : {}),
    });
    const id = response.data.workout?.id;
    if (!id) {
      setDeriveError("Workout saved but id was missing — check your workouts list.");
      return;
    }
    if (fromHostRun) {
      router.push(`/host-a-run?workoutId=${encodeURIComponent(id)}`);
      return;
    }
      const detailBase = workoutDetailPathWithBackHref(id, builderBackHref);
    const detailUrl = detailBase.includes("?") ? `${detailBase}&created=1` : `${detailBase}?created=1`;
    router.push(detailUrl);
  };

  const applyShapeWithPaces = () => {
    if (!pendingShape || !pendingShapeMeta) return;
    setApplyingPaces(true);
    try {
      const paced = pacedShapeFromConfirmed(pendingShape, athleteFiveKPace);
      const steps = assembleWorkoutStepsFromPacedShape(paced);
      applyDerivedSegmentsToCreateForm({
        segments: steps as ApiSegment[],
        suggestedTitle: pendingShapeMeta.suggestedTitle,
        suggestedDescription: pendingShapeMeta.suggestedDescription,
      });
      setPendingShape(null);
      setPendingShapeMeta(null);
      setCreateEntryPath(null);
    } finally {
      setApplyingPaces(false);
    }
  };

  const handlePasteBuild = async () => {
    const text = sourceText.trim();
    if (!text) {
      setDeriveError("Paste a workout description first.");
      return;
    }
    setDeriveError(null);
    setNeedsPaceHint(null);
    setSelectedCatalogueId(null);
    setDeriving(true);
    try {
      const tabular = tryParseTabularMilePacePaste(text);
      if (tabular) {
        const totalMi = tabular.reduce(
          (a, s) => a + (s.durationType === "DISTANCE" ? s.durationValue : 0),
          0
        );
        const derived = {
          segments: tabular,
          suggestedTitle: `${workoutType} — ${totalMi.toFixed(1)} mi`,
          suggestedDescription: `Pasted splits (${tabular.length} segments).`,
        };
        applyDerivedSegmentsToCreateForm(derived);
        setCreateEntryPath(null);
        return;
      }

      const localShape = buildShapeFromPasteText(text, workoutType);
      if (localShape) {
        setPendingShape(localShape);
        setPendingShapeMeta({
          suggestedTitle: localShape.suggestedTitle,
          suggestedDescription: localShape.suggestedDescription,
        });
        return;
      }

      setDeriveError(
        "Could not read the workout shape from that paste. Try the Ask AI path or shorten the note."
      );
    } catch (err: unknown) {
      let display = "Failed to derive workout";
      if (err && typeof err === "object" && "response" in err) {
        const res = (err as { response?: { status?: number; data?: unknown } }).response;
        const status = res?.status;
        const data = res?.data;
        const serverMessage =
          typeof data === "object" && data !== null && "error" in data && typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : typeof data === "string"
              ? data.slice(0, 200) + (data.length > 200 ? "…" : "")
              : null;
        if (status != null || serverMessage) {
          display = [status != null ? `Status: ${status}` : null, serverMessage || "No details from server"].filter(Boolean).join(" — ");
        }
      }
      setDeriveError(display);
    } finally {
      setDeriving(false);
    }
  };

  const handleDerive = async () => {
    const text = sourceText.trim();
    if (!text) {
      setDeriveError("Paste a workout description first.");
      return;
    }
    setDeriveError(null);
    setNeedsPaceHint(null);
    setSelectedCatalogueId(null);
    setDeriving(true);
    try {
      const tabular = tryParseTabularMilePacePaste(text);
      if (tabular) {
        const totalMi = tabular.reduce(
          (a, s) => a + (s.durationType === "DISTANCE" ? s.durationValue : 0),
          0
        );
        const derived = {
          segments: tabular,
          suggestedTitle: `${workoutType} — ${totalMi.toFixed(1)} mi`,
          suggestedDescription: `Pasted splits (${tabular.length} segments).`,
        };
        applyDerivedSegmentsToCreateForm(derived);
        return;
      }

      const localShape = buildShapeFromPasteText(text, workoutType);
      if (localShape) {
        setPendingShape(localShape);
        setPendingShapeMeta({
          suggestedTitle: localShape.suggestedTitle,
          suggestedDescription: localShape.suggestedDescription,
        });
        return;
      }

      const { data } = await api.post<{
        segments: ApiSegment[];
        suggestedTitle: string;
        suggestedDescription: string;
      }>("workouts/ai-generate", { workoutType, sourceText: text });
      applyDerivedSegmentsToCreateForm({
        segments: normalizeAiSegmentsForAssembler(data.segments),
        suggestedTitle: data.suggestedTitle,
        suggestedDescription: data.suggestedDescription,
      });
    } catch (err: unknown) {
      let display = "Failed to derive workout";
      if (err && typeof err === "object" && "response" in err) {
        const res = (err as { response?: { status?: number; data?: unknown } }).response;
        const status = res?.status;
        const data = res?.data;
        const serverMessage =
          typeof data === "object" && data !== null && "error" in data && typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : typeof data === "string"
              ? data.slice(0, 200) + (data.length > 200 ? "…" : "")
              : null;
        if (status != null || serverMessage) {
          display = [status != null ? `Status: ${status}` : null, serverMessage || "No details from server"].filter(Boolean).join(" — ");
        }
      }
      setDeriveError(display);
    } finally {
      setDeriving(false);
    }
  };

  const handleAiCoachGenerate = async () => {
    setDeriveError(null);
    setAiGenerating(true);
    try {
      const { data } = await api.post<{
        segments: ApiSegment[];
        suggestedTitle: string;
        suggestedDescription: string;
      }>("workouts/ai-generate", {
        coachGenerate: true,
        workoutType,
        generatePrompt: aiGeneratePrompt.trim(),
      });
      applyDerivedSegmentsToCreateForm({
        segments: data.segments,
        suggestedTitle: data.suggestedTitle,
        suggestedDescription: data.suggestedDescription,
      });
      setCreateEntryPath(null);
    } catch (err: unknown) {
      let display = "Failed to generate workout";
      if (err && typeof err === "object" && "response" in err) {
        const res = (err as { response?: { status?: number; data?: unknown } }).response;
        const status = res?.status;
        const data = res?.data;
        const serverMessage =
          typeof data === "object" && data !== null && "error" in data && typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : null;
        if (status != null || serverMessage) {
          display = [status != null ? `Status: ${status}` : null, serverMessage || "No details from server"].filter(Boolean).join(" — ");
        }
      }
      setDeriveError(display);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleManualCreate = async () => {
    if (!name.trim()) {
      alert("Enter a title for your run.");
      return;
    }
    setSaving(true);
    try {
      await createWorkoutFromDerivedSegments({
        segments: [
          {
            stepOrder: 1,
            title: "Main",
            durationType: "DISTANCE",
            durationValue: 3,
          },
        ],
        suggestedTitle: name.trim(),
        suggestedDescription: description.trim(),
        workoutTypeOverride: workoutType || "Easy",
      });
    } catch {
      alert("Failed to create workout");
    } finally {
      setSaving(false);
    }
  };

  const parseGoFastGenerateResponse = (
    data: unknown
  ): { segments: ApiSegment[]; suggestedTitle: string; suggestedDescription: string } | null => {
    if (
      data &&
      typeof data === "object" &&
      "needsPace" in data &&
      (data as { needsPace?: boolean }).needsPace
    ) {
      setNeedsPaceHint(String((data as { message?: string }).message ?? ""));
      return null;
    }
    if (
      !data ||
      typeof data !== "object" ||
      !("segments" in data) ||
      !Array.isArray((data as { segments?: unknown }).segments)
    ) {
      setDeriveError("Unexpected response from workout builder.");
      return null;
    }
    return data as {
      segments: ApiSegment[];
      suggestedTitle: string;
      suggestedDescription: string;
    };
  };

  const handleGoFastGenerate = async () => {
    setDeriveError(null);
    setNeedsPaceHint(null);
    setSelectedCatalogueId(null);
    setGoFastGenerating(true);
    try {
      const parsedMi = parseFloat(templateDistanceMi.trim());
      const payload: { workoutType: string; totalMiles?: number } = { workoutType };
      if (Number.isFinite(parsedMi) && parsedMi > 0 && parsedMi <= 500) {
        payload.totalMiles = parsedMi;
      }

      const { data } = await api.post<GoFastGenResponse>("workouts/gofast-generate", payload);
      const built = parseGoFastGenerateResponse(data);
      if (built) {
        await createWorkoutFromDerivedSegments({
          segments: built.segments,
          suggestedTitle: built.suggestedTitle,
          suggestedDescription: built.suggestedDescription,
          workoutTypeOverride: workoutType,
        });
      }
    } catch (err: unknown) {
      let display = "Failed to build workout";
      if (err && typeof err === "object" && "response" in err) {
        const res = (err as { response?: { status?: number; data?: unknown } }).response;
        const status = res?.status;
        const resData = res?.data;
        const serverMessage =
          typeof resData === "object" && resData !== null && "error" in resData && typeof (resData as { error?: unknown }).error === "string"
            ? (resData as { error: string }).error
            : typeof resData === "string"
              ? resData.slice(0, 200) + (resData.length > 200 ? "…" : "")
              : null;
        if (status != null || serverMessage) {
          display = [status != null ? `Status: ${status}` : null, serverMessage || "No details from server"].filter(Boolean).join(" — ");
        }
      }
      setDeriveError(display);
    } finally {
      setGoFastGenerating(false);
    }
  };

  const handleCataloguePreset = async (item: CatalogueBrowseItem) => {
    setDeriveError(null);
    setNeedsPaceHint(null);
    setEditingTarget(null);
    setEditingPaceLowMin("");
    setEditingPaceLowSec("");
    setEditingPaceHighMin("");
    setEditingPaceHighSec("");
    setCatalogueGeneratingId(item.id);
    try {
      const parsedMi = parseFloat(templateDistanceMi.trim());
      const payload: { catalogueId: string; totalMiles?: number } = { catalogueId: item.id };
      if (Number.isFinite(parsedMi) && parsedMi > 0 && parsedMi <= 500) {
        payload.totalMiles = parsedMi;
      }
      const { data } = await api.post<GoFastGenResponse>("workouts/gofast-generate", payload);
      const built = parseGoFastGenerateResponse(data);
      if (built) {
        setWorkoutType(item.workoutType);
        await createWorkoutFromDerivedSegments({
          segments: built.segments,
          suggestedTitle: built.suggestedTitle,
          suggestedDescription: built.suggestedDescription,
          workoutTypeOverride: item.workoutType,
          catalogueWorkoutId: item.id,
        });
        setCreateEntryPath(null);
      }
    } catch (err: unknown) {
      let display = "Failed to load preset";
      if (err && typeof err === "object" && "response" in err) {
        const res = (err as { response?: { status?: number; data?: unknown } }).response;
        const status = res?.status;
        const resData = res?.data;
        const serverMessage =
          typeof resData === "object" && resData !== null && "error" in resData && typeof (resData as { error?: unknown }).error === "string"
            ? (resData as { error: string }).error
            : typeof resData === "string"
              ? resData.slice(0, 200) + (resData.length > 200 ? "…" : "")
              : null;
        if (status != null || serverMessage) {
          display = [status != null ? `Status: ${status}` : null, serverMessage || "No details from server"].filter(Boolean).join(" — ");
        }
      }
      setDeriveError(display);
    } finally {
      setCatalogueGeneratingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raceDayMode && !hasPositiveDuration) return;
    if (!hasPositiveDuration) {
      alert("Build a workout first, or add at least one segment.");
      return;
    }
    setSaving(true);
    try {
      const buildTargets = (slot: SlotData) => {
        const targets: Array<{ type: string; valueLow?: number; valueHigh?: number }> = [];
        if (slot.paceValueLow != null || slot.paceValueHigh != null) {
          const low = slot.paceValueLow ?? slot.paceValueHigh ?? 0;
          const high = slot.paceValueHigh ?? slot.paceValueLow ?? low;
          if (low || high) targets.push({ type: "PACE", valueLow: low, valueHigh: high });
        }
        if (slot.hrMin != null && slot.hrMax != null) {
          targets.push({ type: "HEART_RATE", valueLow: slot.hrMin, valueHigh: slot.hrMax });
        }
        return targets.length ? targets : undefined;
      };

      const segments: Array<{
        stepOrder: number;
        title: string;
        durationType: string;
        durationValue: number;
        targets: ReturnType<typeof buildTargets>;
        repeatCount: number | undefined;
        recoveryDurationType: string | null | undefined;
        recoveryDurationValue: number | null | undefined;
      }> = [];
      let step = 1;
      const pushSlotSegment = (slot: SlotData, defaultTitle: string) => {
        if (!slotHasPositiveDuration(slot)) return;
        segments.push({
          stepOrder: step++,
          title: slot.segmentTitle?.trim() || defaultTitle,
          durationType: slot.durationType,
          durationValue: slot.durationValue,
          targets: buildTargets(slot),
          repeatCount: slot.repeatCount,
          recoveryDurationType: slot.recoveryDurationType ?? null,
          recoveryDurationValue: slot.recoveryDurationValue ?? null,
        });
      };
      if (warmup) pushSlotSegment(warmup, "Warmup");
      const mainsWithDuration = mainSegments.filter((s) => slotHasPositiveDuration(s));
      let mainOrdinal = 0;
      for (const slot of mainSegments) {
        if (!slotHasPositiveDuration(slot)) continue;
        mainOrdinal++;
        const defaultMainTitle =
          mainsWithDuration.length === 1 ? "Work" : `Segment ${mainOrdinal}`;
        const rows = materializeMainSlotRows(slot, defaultMainTitle);
        for (const row of rows) {
          const rowSlot: SlotData = {
            durationType: row.durationType === "TIME" ? "TIME" : "DISTANCE",
            durationValue: row.durationValue,
            segmentTitle: row.title,
            paceValueLow: row.paceValueLow,
            paceValueHigh: row.paceValueHigh,
            hrMin: row.hrMin,
            hrMax: row.hrMax,
            repeatCount: row.repeatCount,
            recoveryDurationType: row.recoveryDurationType,
            recoveryDurationValue: row.recoveryDurationValue,
          };
          pushSlotSegment(rowSlot, row.title);
        }
      }
      if (cooldown) pushSlotSegment(cooldown, "Cooldown");

      if (planDayAssignMode) {
        if (!racePlanId || !raceDateKey) {
          alert("Missing plan or date — open this builder from your training day.");
          return;
        }
        await api.post("training/plan-day/assign", {
          planId: racePlanId,
          date: raceDateKey,
          title: name.trim() || "Workout",
          workoutType: workoutType || "Easy",
          segments,
        });
        router.push(builderBackHref);
        return;
      }

      if (!raceDayMode && assignToPlanDay && activePlanId && scheduledDate.trim()) {
        await api.post("training/plan-day/assign", {
          planId: activePlanId,
          date: scheduledDate.trim(),
          title: name.trim() || "Workout",
          workoutType: workoutType || "Easy",
          segments,
        });
        router.push(builderBackHref);
        return;
      }

      if (raceDayMode) {
        if (!racePlanId || !raceDateKey) {
          alert("Missing plan or race date — open this builder from your training plan.");
          return;
        }
        const response = await api.post("training/race-day", {
          planId: racePlanId,
          date: raceDateKey,
          title: name.trim() || "Race",
          segments,
        });
        const wid =
          typeof response.data?.plannedWorkoutId === "string"
            ? response.data.plannedWorkoutId
            : response.data?.workoutId;
        if (typeof wid === "string" && wid.trim()) {
          router.push(raceDayBackHref);
        } else {
          router.push(raceDayBackHref);
        }
        return;
      }

      const workoutData = {
        title: name,
        description,
        workoutType: workoutType || "Easy",
        segments,
        ...(scheduledDate.trim() ? { date: scheduledDate.trim() } : {}),
        ...(selectedCatalogueId ? { catalogueWorkoutId: selectedCatalogueId } : {}),
        ...(fromHostRun ? { skipGarminPush: true } : {}),
      };

      const response = await api.post("workouts", workoutData);
      const { workout } = response.data;
      if (fromHostRun) {
        router.push(
          `/host-a-run?workoutId=${encodeURIComponent(workout.id)}`
        );
        return;
      }
      const detailBase = workoutDetailPathWithBackHref(workout.id, builderBackHref);
      const detailUrl = detailBase.includes("?")
        ? `${detailBase}&created=1`
        : `${detailBase}?created=1`;
      router.push(detailUrl);
    } catch (error) {
      console.error("Error creating workout:", error);
      alert("Failed to create workout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href={raceDayMode ? raceDayBackHref : fromHostRun ? hostRunBackHref : builderBackHref}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          {raceDayMode
            ? "Back to race day"
            : fromHostRun
              ? "Back to Create a run"
              : backLabelFromPath(builderBackHref)}
        </Link>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {raceDayMode ? "Plan pacing blocks" : "Build a run"}
          </h1>

          {!raceDayMode && !hasSlots ? (
            <WorkoutCreateEntry
              path={createEntryPath}
              onPathChange={setCreateEntryPath}
              builderBackHref={builderBackHref}
              planDayAssignMode={planDayAssignMode}
              planId={racePlanId}
              planDateKey={raceDateKey}
              workoutType={workoutType}
              onWorkoutTypeChange={setWorkoutType}
              sourceText={sourceText}
              onSourceTextChange={setSourceText}
              aiGeneratePrompt={aiGeneratePrompt}
              onAiGeneratePromptChange={setAiGeneratePrompt}
              deriveError={deriveError}
              deriving={deriving}
              aiGenerating={aiGenerating}
              pendingShape={pendingShape}
              pendingShapeMeta={pendingShapeMeta}
              onClearPendingShape={() => {
                setPendingShape(null);
                setPendingShapeMeta(null);
              }}
              onApplyShapeWithPaces={applyShapeWithPaces}
              applyingPaces={applyingPaces}
              onPasteBuild={() => void handlePasteBuild()}
              onAiGenerate={() => void handleAiCoachGenerate()}
              onCsvSegments={handleCsvSegments}
              presetTypeFilter={presetTypeFilter}
              onPresetTypeFilter={(wt) => {
                setPresetTypeFilter(wt);
                setCatalogueItems([]);
              }}
              catalogueItems={catalogueItems}
              catalogueBrowseError={catalogueBrowseError}
              catalogueGeneratingId={catalogueGeneratingId}
              onCataloguePreset={handleCataloguePreset}
              catalogueCardSubtitle={catalogueCardSubtitle}
              onUseBuiltWorkoutOnPlanDay={
                planDayAssignMode ? handleUseBuiltWorkoutOnPlanDay : undefined
              }
            />
          ) : null}

          {!raceDayMode && !hasSlots ? (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
          ) : null}

          {raceDayMode ? (
            <>
              <p className="mb-4 text-sm text-gray-600">
                Name a few coarse blocks (start, settle, push, finish) with miles and pace bands — not
                one row per mile. Paste coach prose or tabular lines (each line = one block). Saved on
                your plan as <span className="font-semibold">Race</span> — no catalogue workout.
              </p>
              <div className="mb-6 rounded-lg border border-violet-100 bg-violet-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-900 mb-2">
                  Suggest blocks from goal
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(
                    [
                      ["even", "Even"],
                      ["negative", "Negative split"],
                      ["positive", "Positive split"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setRaceSuggestStrategy(id)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${
                        raceSuggestStrategy === id
                          ? "border-violet-600 bg-violet-600 text-white"
                          : "border-gray-300 bg-white text-gray-800"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={applySuggestedRaceBlocks}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Suggest blocks from goal
                </button>
                {raceGoalPaceSecPerMi == null ? (
                  <p className="mt-2 text-xs text-gray-600">
                    No goal pace on file — using a default pace until you set a goal on My Race.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {!raceDayMode ? (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="workout-schedule-date">
              Schedule (optional)
            </label>
            <input
              id="workout-schedule-date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave blank to default to today. Pick a date to schedule this for a specific day.
            </p>
            {!planDayAssignMode && activePlanId && scheduledDate.trim() ? (
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={assignToPlanDay}
                  onChange={(e) => setAssignToPlanDay(e.target.checked)}
                />
                Assign to this plan day (replaces the scheduled workout on your plan)
              </label>
            ) : null}
            {planDayAssignMode ? (
              <p className="mt-2 text-sm text-sky-800 font-medium">
                This run will replace the workout on your training plan for{" "}
                {scheduledDate || raceDateKey}.
              </p>
            ) : null}
          </div>
          ) : null}

          {false && !raceDayMode ? (
          <details className="mb-8 rounded-lg border border-orange-100 bg-orange-50/50 p-4">
            <summary className="text-lg font-semibold text-gray-900 cursor-pointer">
              Generic mileage template <span className="text-xs font-normal text-gray-500">(optional)</span>
            </summary>
            <div className="mt-4 space-y-4 pt-3 border-t border-orange-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Workout type</label>
                <select
                  value={workoutType}
                  onChange={(e) => {
                    setWorkoutType(e.target.value);
                    setSelectedCatalogueId(null);
                  }}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                >
                  {WORKOUT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="template-distance-mi">
                  Template distance (miles)
                </label>
                <input
                  id="template-distance-mi"
                  type="number"
                  step="0.1"
                  min={0.1}
                  max={500}
                  value={templateDistanceMi}
                  onChange={(e) => setTemplateDistanceMi(e.target.value)}
                  placeholder={
                    workoutType === "LongRun"
                      ? "8 (default)"
                      : workoutType === "Race"
                        ? "13.1 (default)"
                        : workoutType === "Tempo"
                          ? "6 (default)"
                          : workoutType === "Intervals"
                            ? "5 (default)"
                            : "6 (default)"
                  }
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave blank for defaults (e.g. long run 8 mi, race 13.1 mi). Applies to generic templates and
                  optional warmup/cooldown scaling on catalogue presets.
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Uses your active goal&apos;s finish-time pace first, then your profile 5K pace. Format:{" "}
                <span className="font-mono text-gray-800">7:30</span> or{" "}
                <span className="font-mono text-gray-800">7:30/mile</span>.
              </p>
              <button
                type="button"
                onClick={() => void handleGoFastGenerate()}
                disabled={goFastGenerating}
                className="px-4 py-2 bg-white border-2 border-orange-300 text-orange-800 rounded-lg font-medium hover:bg-orange-50 disabled:opacity-50"
              >
                {goFastGenerating ? "Saving…" : "Build template from goal / 5K pace"}
              </button>
              {needsPaceHint != null && (
                <div className="rounded-lg border border-orange-200 bg-white p-4 shadow-sm" role="status">
                  <p className="text-sm font-medium text-gray-900 mb-1">We need a pace first</p>
                  <p className="text-sm text-gray-600 mb-4">{needsPaceHint}</p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/goals"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
                    >
                      Set goal →
                    </Link>
                    <Link
                      href="/athlete-edit-profile"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg border-2 border-orange-200 text-orange-800 text-sm font-semibold hover:bg-orange-50 transition-colors"
                    >
                      Set 5K baseline (profile) →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </details>
          ) : null}

          {raceDayMode ? (
          <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Paste pacing blocks</h2>
              <p className="text-sm text-gray-600 mb-3">
                Paste coach notes (AI turns them into blocks) or one line per block:{" "}
                <span className="font-mono text-gray-800">miles pace pace</span> (e.g.{" "}
                <span className="font-mono text-gray-800">8 7:05 7:25</span> = 8-mile block).
              </p>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="e.g. 15 miles today — 2 mile warmup, 10 at marathon pace, 3 mile cooldown"
              />
              {deriveError ? <p className="text-sm text-red-600 mt-1">{deriveError}</p> : null}
              <button
                type="button"
                onClick={handleDerive}
                disabled={deriving}
                className="mt-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {deriving ? "Parsing…" : "Build workout"}
              </button>
            </div>
          ) : null}

          {!raceDayMode && !hasSlots ? (
            <div className="flex gap-4 justify-end pt-6 border-t border-gray-200 mb-6">
              <Link
                href={fromHostRun ? hostRunBackHref : builderBackHref}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => void handleManualCreate()}
                disabled={saving || !name.trim()}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save run"}
              </button>
            </div>
          ) : null}

          {(raceDayMode || hasSlots) && (
          <>
            {raceDayMode && hasSlots ? (
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={clearSegmentsUsePasteInstead}
                  className="text-sm text-orange-700 hover:text-orange-900 underline underline-offset-2"
                >
                  Clear segments and paste a workout instead
                </button>
              </div>
            ) : null}

            {!raceDayMode && hasSlots ? (
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50/80 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-gray-700">
                    These are saved on this run. Saving also sends the workout to Garmin when you are
                    connected.
                  </p>
                  <button
                    type="button"
                    onClick={clearSegmentsUsePasteInstead}
                    className="text-sm text-orange-700 hover:underline"
                  >
                    Start over
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Saved name (title) *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Saved description (optional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white"
                    />
                  </div>
                </div>
              </div>
            ) : null}

              <div className="mb-6" id="workout-builder-segments">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Segments</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Add a warmup (starts at 3 miles), the main work, and a cooldown. Paste above fills
                  these in so you can adjust them before saving.
                </p>
                {selectedCatalogueId != null && (
                  <div
                    className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900"
                    role="status"
                  >
                    Loaded from catalogue preset
                    {selectedCatalogueLabel ? `: ${selectedCatalogueLabel}` : ""}. Paces will re-derive from your
                    latest 5K pace when segments are rebuilt from the prescription.
                  </div>
                )}

                {(
                  [{ kind: "warmup" as const, label: "Warmup" }] as const
                ).map(({ kind, label }) => {
                  const slot = kind === "warmup" ? warmup : cooldown;
                  const isEditing = editingTarget?.kind === kind;

                  return (
                    <div key={kind} className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{label}</span>
                        <span className="text-sm text-gray-600">
                          {slot ? slotOneLine(slot) : "None"}
                        </span>
                        <div className="flex gap-2">
                          {!slot ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCatalogueId(null);
                                if (!name.trim()) setName("Workout");
                                if (kind === "warmup") {
                                  setWarmup({
                                    ...emptySlot(),
                                    durationValue: 3,
                                    segmentTitle: "Warmup",
                                  });
                                } else {
                                  setCooldown({
                                    ...emptySlot(),
                                    durationValue: 1,
                                    segmentTitle: "Cooldown",
                                  });
                                }
                                setEditingTarget({ kind });
                                setEditingPaceLowMin("");
                                setEditingPaceLowSec("");
                                setEditingPaceHighMin("");
                                setEditingPaceHighSec("");
                              }}
                              className="text-sm px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                            >
                              {kind === "warmup" ? "Add warmup" : "Add cooldown"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingTarget(null);
                                } else {
                                  setEditingTarget({ kind });
                                  const sp = slotToPaceSplitState(slot);
                                  setEditingPaceLowMin(sp.lowMin);
                                  setEditingPaceLowSec(sp.lowSec);
                                  setEditingPaceHighMin(sp.highMin);
                                  setEditingPaceHighSec(sp.highSec);
                                }
                              }}
                              className="text-sm px-3 py-1.5 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 inline-flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing && slot && (
                        <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select
                              value={slot.durationType}
                              onChange={(e) => {
                                const durationType =
                                  e.target.value === "TIME" ? ("TIME" as const) : ("DISTANCE" as const);
                                setSelectedCatalogueId(null);
                                const next = { ...slot, durationType, durationValue: 0 };
                                if (kind === "warmup") setWarmup(next);
                                else setCooldown(next);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            >
                              <option value="DISTANCE">Distance (mi)</option>
                              <option value="TIME">Time (min)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {slot.durationType === "TIME" ? "Minutes" : "Miles"}
                            </label>
                            <input
                              type="number"
                              step={slot.durationType === "TIME" ? 1 : 0.01}
                              min={0}
                              value={slot.durationValue ?? ""}
                              onChange={(e) => {
                                const durationValue = parseFloat(e.target.value) || 0;
                                setSelectedCatalogueId(null);
                                const next = { ...slot, durationValue };
                                if (kind === "warmup") setWarmup(next);
                                else setCooldown(next);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                                Pace low
                              </span>
                              <PaceMiSplitEditor
                                minValue={editingPaceLowMin}
                                secValue={editingPaceLowSec}
                                onMinChange={setEditingPaceLowMin}
                                onSecChange={setEditingPaceLowSec}
                              />
                            </div>
                            <div>
                              <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                                Pace high
                              </span>
                              <PaceMiSplitEditor
                                minValue={editingPaceHighMin}
                                secValue={editingPaceHighSec}
                                onMinChange={setEditingPaceHighMin}
                                onSecChange={setEditingPaceHighSec}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">HR min</label>
                            <input
                              type="number"
                              value={slot.hrMin ?? ""}
                              onChange={(e) => {
                                const hrMin = parseInt(e.target.value, 10) || undefined;
                                setSelectedCatalogueId(null);
                                if (kind === "warmup") setWarmup({ ...slot, hrMin });
                                else setCooldown({ ...slot, hrMin });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">HR max</label>
                            <input
                              type="number"
                              value={slot.hrMax ?? ""}
                              onChange={(e) => {
                                const hrMax = parseInt(e.target.value, 10) || undefined;
                                setSelectedCatalogueId(null);
                                if (kind === "warmup") setWarmup({ ...slot, hrMax });
                                else setCooldown({ ...slot, hrMax });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              onClick={() => setEditingTarget(null)}
                              className="text-sm px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCatalogueId(null);
                                if (kind === "warmup") setWarmup(null);
                                else setCooldown(null);
                                setEditingTarget(null);
                                setEditingPaceLowMin("");
                                setEditingPaceLowSec("");
                                setEditingPaceHighMin("");
                                setEditingPaceHighSec("");
                              }}
                              className="ml-2 text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {mainSegments.map((slot, index) => {
                  const label =
                    mainSegments.length === 1 ? "Main work" : `Segment ${index + 1}`;
                  const isEditing =
                    editingTarget?.kind === "main" && editingTarget.index === index;
                  const block = slot.intervalBlock;

                  if (block) {
                    return (
                      <div
                        key={`main-${index}`}
                        className="border border-gray-200 rounded-lg mb-4 overflow-hidden bg-white"
                      >
                        <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide bg-orange-500 text-white">
                          {intervalBlockHeaderLabel(slot)}
                        </div>
                        <div className="p-4">
                          <p className="text-sm font-medium text-gray-900 mb-2">
                            {slot.segmentTitle && slot.segmentTitle !== intervalBlockHeaderLabel(slot)
                              ? slot.segmentTitle
                              : "Intervals"}
                          </p>
                          <ul className="space-y-1.5 list-none pl-0 m-0">
                            {block.legs.map((leg, legIdx) => {
                              const paceLine = slotLegPaceLine(leg);
                              return (
                                <li
                                  key={legIdx}
                                  className="text-sm text-gray-800 flex flex-wrap items-baseline gap-x-2"
                                >
                                  <span className="font-medium text-gray-900">
                                    {leg.segmentTitle?.trim() ||
                                      (legIdx === 0 ? "Work" : "Recovery")}
                                  </span>
                                  <span className="tabular-nums text-gray-600">
                                    {formatSegmentDuration({
                                      durationType: leg.durationType,
                                      durationValue: leg.durationValue,
                                      stepOrder: legIdx + 1,
                                    })}
                                  </span>
                                  {paceLine ? (
                                    <span className="tabular-nums text-gray-500">@ {paceLine}</span>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`main-${index}`}
                      className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{label}</span>
                        <span className="text-sm text-gray-600">{slotOneLine(slot, null)}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditing) {
                                setEditingTarget(null);
                              } else {
                                setEditingTarget({ kind: "main", index });
                                const sp = slotToPaceSplitState(slot);
                                setEditingPaceLowMin(sp.lowMin);
                                setEditingPaceLowSec(sp.lowSec);
                                setEditingPaceHighMin(sp.highMin);
                                setEditingPaceHighSec(sp.highSec);
                              }
                            }}
                            className="text-sm px-3 py-1.5 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 inline-flex items-center gap-1"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select
                              value={slot.durationType}
                              onChange={(e) => {
                                const durationType =
                                  e.target.value === "TIME" ? ("TIME" as const) : ("DISTANCE" as const);
                                setSelectedCatalogueId(null);
                                setMainSegments((prev) => {
                                  const copy = [...prev];
                                  copy[index] = { ...copy[index], durationType, durationValue: 0 };
                                  return copy;
                                });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            >
                              <option value="DISTANCE">Distance (mi)</option>
                              <option value="TIME">Time (min)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {slot.durationType === "TIME" ? "Minutes" : "Miles"}
                            </label>
                            <input
                              type="number"
                              step={slot.durationType === "TIME" ? 1 : 0.01}
                              min={0}
                              value={slot.durationValue ?? ""}
                              onChange={(e) => {
                                const durationValue = parseFloat(e.target.value) || 0;
                                setSelectedCatalogueId(null);
                                setMainSegments((prev) => {
                                  const copy = [...prev];
                                  copy[index] = { ...copy[index], durationValue };
                                  return copy;
                                });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Repeats</label>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={slot.repeatCount ?? ""}
                              onChange={(e) => {
                                const n = parseInt(e.target.value, 10);
                                const repeatCount = Number.isFinite(n) && n > 1 ? n : undefined;
                                setSelectedCatalogueId(null);
                                setMainSegments((prev) => {
                                  const copy = [...prev];
                                  copy[index] = { ...copy[index], repeatCount };
                                  return copy;
                                });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                              placeholder="e.g. 8"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Recovery between reps
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <select
                                value={
                                  slot.recoveryDurationType === "TIME"
                                    ? "TIME"
                                    : slot.recoveryDurationType === "DISTANCE"
                                      ? "DISTANCE"
                                      : ""
                                }
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setSelectedCatalogueId(null);
                                  setMainSegments((prev) => {
                                    const copy = [...prev];
                                    if (v !== "TIME" && v !== "DISTANCE") {
                                      copy[index] = {
                                        ...copy[index],
                                        recoveryDurationType: null,
                                        recoveryDurationValue: null,
                                      };
                                    } else {
                                      copy[index] = {
                                        ...copy[index],
                                        recoveryDurationType: v,
                                        recoveryDurationValue:
                                          copy[index].recoveryDurationValue ?? (v === "TIME" ? 2 : 0.25),
                                      };
                                    }
                                    return copy;
                                  });
                                }}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              >
                                <option value="">None</option>
                                <option value="TIME">Time (min)</option>
                                <option value="DISTANCE">Distance (mi)</option>
                              </select>
                              {slot.recoveryDurationType === "TIME" ||
                              slot.recoveryDurationType === "DISTANCE" ? (
                                <input
                                  type="number"
                                  min={0}
                                  step={slot.recoveryDurationType === "TIME" ? 1 : 0.01}
                                  value={slot.recoveryDurationValue ?? ""}
                                  onChange={(e) => {
                                    const recoveryDurationValue = parseFloat(e.target.value);
                                    setSelectedCatalogueId(null);
                                    setMainSegments((prev) => {
                                      const copy = [...prev];
                                      copy[index] = {
                                        ...copy[index],
                                        recoveryDurationValue:
                                          Number.isFinite(recoveryDurationValue) &&
                                          recoveryDurationValue > 0
                                            ? recoveryDurationValue
                                            : null,
                                      };
                                      return copy;
                                    });
                                  }}
                                  className="min-w-[6rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                  placeholder={slot.recoveryDurationType === "TIME" ? "2" : "0.25"}
                                />
                              ) : null}
                            </div>
                          </div>
                          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                                Pace low
                              </span>
                              <PaceMiSplitEditor
                                minValue={editingPaceLowMin}
                                secValue={editingPaceLowSec}
                                onMinChange={setEditingPaceLowMin}
                                onSecChange={setEditingPaceLowSec}
                              />
                            </div>
                            <div>
                              <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                                Pace high
                              </span>
                              <PaceMiSplitEditor
                                minValue={editingPaceHighMin}
                                secValue={editingPaceHighSec}
                                onMinChange={setEditingPaceHighMin}
                                onSecChange={setEditingPaceHighSec}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">HR min</label>
                            <input
                              type="number"
                              value={slot.hrMin ?? ""}
                              onChange={(e) => {
                                const hrMin = parseInt(e.target.value, 10) || undefined;
                                setSelectedCatalogueId(null);
                                setMainSegments((prev) => {
                                  const copy = [...prev];
                                  copy[index] = { ...copy[index], hrMin };
                                  return copy;
                                });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">HR max</label>
                            <input
                              type="number"
                              value={slot.hrMax ?? ""}
                              onChange={(e) => {
                                const hrMax = parseInt(e.target.value, 10) || undefined;
                                setSelectedCatalogueId(null);
                                setMainSegments((prev) => {
                                  const copy = [...prev];
                                  copy[index] = { ...copy[index], hrMax };
                                  return copy;
                                });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              onClick={() => setEditingTarget(null)}
                              className="text-sm px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCatalogueId(null);
                                setMainSegments((prev) => prev.filter((_, j) => j !== index));
                                if (editingTarget?.kind === "main" && editingTarget.index === index) {
                                  setEditingTarget(null);
                                  setEditingPaceLowMin("");
                                  setEditingPaceLowSec("");
                                  setEditingPaceHighMin("");
                                  setEditingPaceHighSec("");
                                } else if (
                                  editingTarget?.kind === "main" &&
                                  editingTarget.index > index
                                ) {
                                  setEditingTarget({
                                    kind: "main",
                                    index: editingTarget.index - 1,
                                  });
                                }
                              }}
                              className="ml-2 text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCatalogueId(null);
                    const nextIndex = mainSegments.length;
                    setMainSegments((prev) => [...prev, emptySlot()]);
                    setEditingTarget({ kind: "main", index: nextIndex });
                    setEditingPaceLowMin("");
                    setEditingPaceLowSec("");
                    setEditingPaceHighMin("");
                    setEditingPaceHighSec("");
                  }}
                  className="text-sm px-3 py-2 border border-dashed border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 w-full mb-4"
                >
                  + Add main segment
                </button>

                {(
                  [{ kind: "cooldown" as const, label: "Cooldown" }] as const
                ).map(({ kind, label }) => {
                  const slot = cooldown;
                  const isEditing = editingTarget?.kind === kind;

                  return (
                    <div key={kind} className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{label}</span>
                        <span className="text-sm text-gray-600">
                          {slot ? slotOneLine(slot) : "None"}
                        </span>
                        <div className="flex gap-2">
                          {!slot ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCatalogueId(null);
                                if (!name.trim()) setName("Workout");
                                setCooldown({ ...emptySlot(), durationValue: 1, segmentTitle: "Cooldown" });
                                setEditingTarget({ kind });
                                setEditingPaceLowMin("");
                                setEditingPaceLowSec("");
                                setEditingPaceHighMin("");
                                setEditingPaceHighSec("");
                              }}
                              className="text-sm px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                            >
                              "Add cooldown"
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingTarget(null);
                                } else {
                                  setEditingTarget({ kind });
                                  const sp = slotToPaceSplitState(slot);
                                  setEditingPaceLowMin(sp.lowMin);
                                  setEditingPaceLowSec(sp.lowSec);
                                  setEditingPaceHighMin(sp.highMin);
                                  setEditingPaceHighSec(sp.highSec);
                                }
                              }}
                              className="text-sm px-3 py-1.5 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 inline-flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing && slot && (
                        <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select
                              value={slot.durationType}
                              onChange={(e) => {
                                const durationType =
                                  e.target.value === "TIME" ? ("TIME" as const) : ("DISTANCE" as const);
                                setSelectedCatalogueId(null);
                                const next = { ...slot, durationType, durationValue: 0 };
                                setCooldown(next);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            >
                              <option value="DISTANCE">Distance (mi)</option>
                              <option value="TIME">Time (min)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {slot.durationType === "TIME" ? "Minutes" : "Miles"}
                            </label>
                            <input
                              type="number"
                              step={slot.durationType === "TIME" ? 1 : 0.01}
                              min={0}
                              value={slot.durationValue ?? ""}
                              onChange={(e) => {
                                const durationValue = parseFloat(e.target.value) || 0;
                                setSelectedCatalogueId(null);
                                const next = { ...slot, durationValue };
                                setCooldown(next);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                                Pace low
                              </span>
                              <PaceMiSplitEditor
                                minValue={editingPaceLowMin}
                                secValue={editingPaceLowSec}
                                onMinChange={setEditingPaceLowMin}
                                onSecChange={setEditingPaceLowSec}
                              />
                            </div>
                            <div>
                              <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                                Pace high
                              </span>
                              <PaceMiSplitEditor
                                minValue={editingPaceHighMin}
                                secValue={editingPaceHighSec}
                                onMinChange={setEditingPaceHighMin}
                                onSecChange={setEditingPaceHighSec}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">HR min</label>
                            <input
                              type="number"
                              value={slot.hrMin ?? ""}
                              onChange={(e) => {
                                const hrMin = parseInt(e.target.value, 10) || undefined;
                                setSelectedCatalogueId(null);
                                setCooldown({ ...slot, hrMin });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">HR max</label>
                            <input
                              type="number"
                              value={slot.hrMax ?? ""}
                              onChange={(e) => {
                                const hrMax = parseInt(e.target.value, 10) || undefined;
                                setSelectedCatalogueId(null);
                                setCooldown({ ...slot, hrMax });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              onClick={() => setEditingTarget(null)}
                              className="text-sm px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCatalogueId(null);
                                setCooldown(null);
                                setEditingTarget(null);
                                setEditingPaceLowMin("");
                                setEditingPaceLowSec("");
                                setEditingPaceHighMin("");
                                setEditingPaceHighSec("");
                              }}
                              className="ml-2 text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              </div>

              <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
                <Link
                  href={
                    raceDayMode
                      ? raceDayBackHref
                      : fromHostRun
                        ? hostRunBackHref
                        : builderBackHref
                  }
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving || !name || !hasPositiveDuration}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving
                    ? "Saving…"
                    : planDayAssignMode
                      ? "Save to plan day"
                      : raceDayMode
                        ? "Create workout"
                        : assignToPlanDay && activePlanId && scheduledDate.trim()
                          ? "Assign to plan"
                          : "Save run"}
                </button>
              </div>
            </>
          )}
        </form>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function CreateWorkoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" /></div>}>
      <CreateWorkoutPageInner />
    </Suspense>
  );
}
