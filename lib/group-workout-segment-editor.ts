export const METERS_PER_MILE = 1609.34;

/** Standard track rep lengths — prefer these over rounded mile equivalents in the UI. */
const STANDARD_TRACK_METERS = [200, 300, 400, 600, 800, 1000, 1200, 1600, 2000, 2400, 3200];

export type GroupWorkoutSegmentTarget = {
  type: string;
  value?: number;
  valueLow?: number;
  valueHigh?: number;
};

export type GroupWorkoutSegment = {
  stepOrder: number;
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: number;
  repeatCount?: number | null;
  notes?: string | null;
  recoveryDurationType?: string | null;
  recoveryDurationValue?: number | null;
  targets?: GroupWorkoutSegmentTarget[] | null;
};

export type SegmentKind = "warmup" | "work" | "cooldown";
export type DisplayUnit = "meters" | "miles" | "minutes";

export type WorkStepType = "Intervals" | "Tempo" | "Main";

export const WORK_STEP_TYPES: WorkStepType[] = ["Intervals", "Tempo", "Main"];

/** Pace offset presets — sec/mi vs athlete 5K fitness anchor (positive = slower). */
export const PACE_OFFSET_PRESETS = [
  { id: "5k", label: "5K (0 sec/mi vs 5K)", offset: 0 },
  { id: "10k", label: "10K (+15 sec/mi vs 5K)", offset: 15 },
  { id: "tempo", label: "Tempo (+15 sec/mi vs 5K)", offset: 15 },
  { id: "marathon", label: "Marathon (+45 sec/mi vs 5K)", offset: 45 },
  { id: "interval", label: "5K interval (−10 sec/mi vs 5K)", offset: -10 },
  { id: "custom", label: "Custom…", offset: null },
] as const;

export type PaceOffsetPresetId = (typeof PACE_OFFSET_PRESETS)[number]["id"];

export type EditableWorkoutSegment = {
  id: string;
  stepOrder: number;
  kind: SegmentKind;
  /** Segment step label — Warmup, Intervals, Tempo, Cooldown, etc. */
  stepType: string;
  durationType: "DISTANCE" | "TIME";
  displayValue: number;
  displayUnit: DisplayUnit;
  repeatCount: number | null;
  /** Sec/mi vs 5K anchor — stored on segment targets as PACE_OFFSET. */
  paceOffsetSecPerMile: number | null;
  paceOffsetPreset: PaceOffsetPresetId | "custom";
  recoveryDisplayValue: number | null;
  recoveryDisplayUnit: DisplayUnit | null;
};

export function normalizeGroupWorkoutSegment(seg: {
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  repeatCount?: number | null;
  notes?: string | null;
  recoveryDurationType?: string | null;
  recoveryDurationValue?: number | null;
  targets?: GroupWorkoutSegment["targets"];
}): GroupWorkoutSegment {
  return {
    stepOrder: seg.stepOrder,
    title: seg.title,
    durationType: seg.durationType === "TIME" ? "TIME" : "DISTANCE",
    durationValue: seg.durationValue,
    repeatCount: seg.repeatCount,
    notes: seg.notes,
    recoveryDurationType: seg.recoveryDurationType,
    recoveryDurationValue: seg.recoveryDurationValue,
    targets: seg.targets ?? null,
  };
}

function newSegmentId(): string {
  return `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function inferSegmentKind(title: string): SegmentKind {
  const t = title.trim().toLowerCase();
  if (t.includes("warm")) return "warmup";
  if (t.includes("cool")) return "cooldown";
  return "work";
}

export function defaultStepTypeForKind(kind: SegmentKind): string {
  if (kind === "warmup") return "Warmup";
  if (kind === "cooldown") return "Cooldown";
  return "Intervals";
}

export function stepTypeToKind(stepType: string): SegmentKind {
  const t = stepType.trim().toLowerCase();
  if (t.includes("warm")) return "warmup";
  if (t.includes("cool")) return "cooldown";
  return "work";
}

function snapStandardTrackMeters(miles: number): number | null {
  const meters = miles * METERS_PER_MILE;
  for (const std of STANDARD_TRACK_METERS) {
    if (Math.abs(meters - std) / std <= 0.025) return std;
  }
  return null;
}

export function milesToDisplayMeters(miles: number): number {
  if (!Number.isFinite(miles) || miles <= 0) return 0;
  const snapped = snapStandardTrackMeters(miles);
  if (snapped != null) return snapped;
  const meters = miles * METERS_PER_MILE;
  if (meters <= 5000) {
    const rounded50 = Math.round(meters / 50) * 50;
    if (rounded50 > 0) {
      const relErr = Math.abs(meters - rounded50) / meters;
      if (relErr <= 0.005) return rounded50;
    }
  }
  return Math.round(meters);
}

export function inferDistanceDisplayUnit(miles: number): DisplayUnit {
  const snapped = snapStandardTrackMeters(miles);
  if (snapped != null) return "meters";
  const meters = milesToDisplayMeters(miles);
  if (meters > 0 && meters <= 5000) {
    const backToMiles = meters / METERS_PER_MILE;
    if (Math.abs(backToMiles - miles) / miles <= 0.01) return "meters";
  }
  return "miles";
}

export function displayValueToStored(
  displayValue: number,
  displayUnit: DisplayUnit
): { durationType: "DISTANCE" | "TIME"; durationValue: number } {
  if (displayUnit === "minutes") {
    return { durationType: "TIME", durationValue: displayValue };
  }
  if (displayUnit === "meters") {
    return { durationType: "DISTANCE", durationValue: displayValue / METERS_PER_MILE };
  }
  return { durationType: "DISTANCE", durationValue: displayValue };
}

export function storedToDisplayValue(
  durationType: string,
  durationValue: number
): { displayValue: number; displayUnit: DisplayUnit } {
  if (durationType === "TIME") {
    return { displayValue: durationValue, displayUnit: "minutes" };
  }
  const unit = inferDistanceDisplayUnit(durationValue);
  if (unit === "meters") {
    return { displayValue: milesToDisplayMeters(durationValue), displayUnit: "meters" };
  }
  return { displayValue: Math.round(durationValue * 1000) / 1000, displayUnit: "miles" };
}

export function recoveryStoredToDisplay(
  recoveryDurationType: string | null | undefined,
  recoveryDurationValue: number | null | undefined
): { recoveryDisplayValue: number | null; recoveryDisplayUnit: DisplayUnit | null } {
  if (
    recoveryDurationValue == null ||
    !Number.isFinite(recoveryDurationValue) ||
    recoveryDurationValue <= 0
  ) {
    return { recoveryDisplayValue: null, recoveryDisplayUnit: null };
  }
  if (recoveryDurationType === "TIME") {
    return { recoveryDisplayValue: recoveryDurationValue, recoveryDisplayUnit: "minutes" };
  }
  const unit = inferDistanceDisplayUnit(recoveryDurationValue);
  if (unit === "meters") {
    return {
      recoveryDisplayValue: milesToDisplayMeters(recoveryDurationValue),
      recoveryDisplayUnit: "meters",
    };
  }
  return {
    recoveryDisplayValue: Math.round(recoveryDurationValue * 1000) / 1000,
    recoveryDisplayUnit: "miles",
  };
}

export function recoveryDisplayToStored(
  recoveryDisplayValue: number | null,
  recoveryDisplayUnit: DisplayUnit | null
): { recoveryDurationType: string | null; recoveryDurationValue: number | null } {
  if (
    recoveryDisplayValue == null ||
    !Number.isFinite(recoveryDisplayValue) ||
    recoveryDisplayValue <= 0 ||
    !recoveryDisplayUnit
  ) {
    return { recoveryDurationType: null, recoveryDurationValue: null };
  }
  const stored = displayValueToStored(recoveryDisplayValue, recoveryDisplayUnit);
  return {
    recoveryDurationType: stored.durationType,
    recoveryDurationValue: stored.durationValue,
  };
}

export function readPaceOffsetFromTargets(
  targets: GroupWorkoutSegmentTarget[] | null | undefined
): number | null {
  if (!targets?.length) return null;
  for (const t of targets) {
    const type = (t.type || "").toUpperCase();
    if (type !== "PACE_OFFSET") continue;
    if (typeof t.value === "number" && Number.isFinite(t.value)) return Math.round(t.value);
    if (typeof t.valueLow === "number" && Number.isFinite(t.valueLow)) return Math.round(t.valueLow);
  }
  return null;
}

export function effortTextToPaceOffset(notes: string | null | undefined): number | null {
  if (!notes?.trim()) return null;
  const t = notes.trim().toLowerCase();
  if (/\b5\s*k\b|\b5k\b|\b5k\s*pace\b/.test(t)) return 0;
  if (/\b10\s*k\b|\b10k\b|\b10k\s*pace\b|\b10k\s*effort\b/.test(t)) return 15;
  if (/\btempo\b|\bthreshold\b/.test(t)) return 15;
  if (/\bmarathon\b|\bmp\b/.test(t)) return 45;
  if (/\binterval\b|\bspeed\b/.test(t)) return -10;
  const plusMatch = t.match(/\+\s*(\d+)\s*(?:sec|s)?/);
  if (plusMatch) return parseInt(plusMatch[1]!, 10);
  return null;
}

export function presetIdForOffset(offset: number | null): PaceOffsetPresetId | "custom" {
  if (offset == null) return "custom";
  const match = PACE_OFFSET_PRESETS.find((p) => p.offset === offset);
  return match?.id ?? "custom";
}

export function formatPaceOffsetSummary(offset: number | null): string {
  if (offset == null) return "";
  const sign = offset > 0 ? "+" : "";
  return `@ ${sign}${offset} sec/mi vs 5K`;
}

export function apiSegmentToEditable(seg: GroupWorkoutSegment, index: number): EditableWorkoutSegment {
  const { displayValue, displayUnit } = storedToDisplayValue(seg.durationType, seg.durationValue);
  const recovery = recoveryStoredToDisplay(seg.recoveryDurationType, seg.recoveryDurationValue);
  const kind = inferSegmentKind(seg.title);
  const stepType = seg.title?.trim() || defaultStepTypeForKind(kind);
  const paceOffset =
    readPaceOffsetFromTargets(seg.targets) ?? effortTextToPaceOffset(seg.notes);
  return {
    id: newSegmentId(),
    stepOrder: seg.stepOrder || index + 1,
    kind,
    stepType,
    durationType: seg.durationType,
    displayValue,
    displayUnit,
    repeatCount: kind === "work" && seg.repeatCount != null && seg.repeatCount > 1 ? seg.repeatCount : null,
    paceOffsetSecPerMile: kind === "work" ? paceOffset : null,
    paceOffsetPreset: kind === "work" ? presetIdForOffset(paceOffset) : "custom",
    recoveryDisplayValue: kind === "work" ? recovery.recoveryDisplayValue : null,
    recoveryDisplayUnit: kind === "work" ? recovery.recoveryDisplayUnit : null,
  };
}

export function editableToApiSegment(seg: EditableWorkoutSegment, stepOrder: number): GroupWorkoutSegment {
  const stored = displayValueToStored(seg.displayValue, seg.displayUnit);
  const recovery =
    seg.kind === "work"
      ? recoveryDisplayToStored(seg.recoveryDisplayValue, seg.recoveryDisplayUnit)
      : { recoveryDurationType: null, recoveryDurationValue: null };

  const stepType = seg.stepType.trim() || defaultStepTypeForKind(seg.kind);
  const targets =
    seg.kind === "work" && seg.paceOffsetSecPerMile != null
      ? [
          {
            type: "PACE_OFFSET",
            value: seg.paceOffsetSecPerMile,
            valueLow: seg.paceOffsetSecPerMile,
            valueHigh: seg.paceOffsetSecPerMile,
          },
        ]
      : null;

  return {
    stepOrder,
    title: stepType,
    durationType: stored.durationType,
    durationValue: stored.durationValue,
    repeatCount:
      seg.kind === "work" && seg.repeatCount != null && seg.repeatCount > 1 ? seg.repeatCount : null,
    notes: null,
    targets,
    recoveryDurationType: recovery.recoveryDurationType,
    recoveryDurationValue: recovery.recoveryDurationValue,
  };
}

export function reindexEditableSegments(segments: EditableWorkoutSegment[]): EditableWorkoutSegment[] {
  return segments.map((seg, i) => ({ ...seg, stepOrder: i + 1 }));
}

export function editableSegmentsToApi(segments: EditableWorkoutSegment[]): GroupWorkoutSegment[] {
  return reindexEditableSegments(segments).map((seg, i) => editableToApiSegment(seg, i + 1));
}

export function createEmptySegment(kind: SegmentKind, stepOrder: number): EditableWorkoutSegment {
  const defaults: Record<SegmentKind, { displayValue: number; displayUnit: DisplayUnit }> = {
    warmup: { displayValue: 1, displayUnit: "miles" },
    work: { displayValue: 1600, displayUnit: "meters" },
    cooldown: { displayValue: 1, displayUnit: "miles" },
  };
  const d = defaults[kind];
  return {
    id: newSegmentId(),
    stepOrder,
    kind,
    stepType: defaultStepTypeForKind(kind),
    durationType: d.displayUnit === "minutes" ? "TIME" : "DISTANCE",
    displayValue: d.displayValue,
    displayUnit: d.displayUnit,
    repeatCount: kind === "work" ? 5 : null,
    paceOffsetSecPerMile: kind === "work" ? 15 : null,
    paceOffsetPreset: kind === "work" ? "10k" : "custom",
    recoveryDisplayValue: kind === "work" ? 400 : null,
    recoveryDisplayUnit: kind === "work" ? "meters" : null,
  };
}

export function formatDisplayDuration(displayValue: number, displayUnit: DisplayUnit): string {
  if (!Number.isFinite(displayValue) || displayValue <= 0) return "—";
  if (displayUnit === "minutes") return `${displayValue} min`;
  if (displayUnit === "meters") return `${Math.round(displayValue)}m`;
  return `${displayValue} mi`;
}

export function formatSegmentSummary(seg: EditableWorkoutSegment): string {
  const dist = formatDisplayDuration(seg.displayValue, seg.displayUnit);
  if (seg.kind === "warmup" || seg.kind === "cooldown") {
    return `${seg.stepType}: ${dist}`;
  }
  const reps = seg.repeatCount != null && seg.repeatCount > 1 ? seg.repeatCount : 1;
  const pace = formatPaceOffsetSummary(seg.paceOffsetSecPerMile);
  const recovery =
    seg.recoveryDisplayValue != null &&
    seg.recoveryDisplayUnit &&
    seg.recoveryDisplayValue > 0
      ? ` — ${formatDisplayDuration(seg.recoveryDisplayValue, seg.recoveryDisplayUnit)} recovery`
      : "";
  return `${reps} × ${dist}${pace ? ` ${pace}` : ""}${recovery}`;
}

export type SegmentValidationIssue = { id: string; message: string };

export function validateEditableSegments(segments: EditableWorkoutSegment[]): SegmentValidationIssue[] {
  const issues: SegmentValidationIssue[] = [];
  if (segments.length === 0) {
    issues.push({ id: "all", message: "Add at least one segment." });
    return issues;
  }

  for (const seg of segments) {
    if (!seg.stepType.trim()) {
      issues.push({ id: seg.id, message: "Step type is required." });
    }
    if (!Number.isFinite(seg.displayValue) || seg.displayValue <= 0) {
      issues.push({
        id: seg.id,
        message: `${seg.stepType || "Segment"}: distance/time must be positive.`,
      });
    }
    if (seg.kind === "work") {
      if (seg.repeatCount != null && (!Number.isInteger(seg.repeatCount) || seg.repeatCount < 1)) {
        issues.push({ id: seg.id, message: `${seg.stepType}: repeat count must be a positive integer.` });
      }
      if (
        seg.recoveryDisplayValue != null &&
        seg.recoveryDisplayUnit &&
        (!Number.isFinite(seg.recoveryDisplayValue) || seg.recoveryDisplayValue <= 0)
      ) {
        issues.push({ id: seg.id, message: `${seg.stepType}: recovery must be positive when set.` });
      }
    }
  }
  return issues;
}
