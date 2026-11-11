/**
 * Map API/workout steps ↔ create-form slots (group-first; supports timed ON/OFF interval blocks).
 */

import {
  effectiveRepeatCount,
  groupSegmentsInDisplayOrder,
  humanDisplayGroupTitle,
  isMultiStepRepeatGroup,
  isRecoveryTitle,
  segmentHasPaceTarget,
  type SegmentDisplayGroup,
  type SegmentLike,
} from "@/lib/training/segment-summary";

export type IntervalBlockSlot = {
  repeatCount: number;
  legs: SlotData[];
};

export interface SlotData {
  durationType: "DISTANCE" | "TIME";
  /** Miles when DISTANCE, minutes when TIME. */
  durationValue: number;
  segmentTitle?: string;
  paceValueLow?: number;
  paceValueHigh?: number;
  hrMin?: number;
  hrMax?: number;
  repeatCount?: number;
  recoveryDurationType?: string | null;
  recoveryDurationValue?: number | null;
  /** Timed fartlek ON/OFF (and similar multi-leg repeats) — one builder card. */
  intervalBlock?: IntervalBlockSlot;
}

export type ApiSegmentLike = {
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  targets?: Array<{
    type: string;
    valueLow?: number;
    valueHigh?: number;
    value?: number;
  }>;
  repeatCount?: number | null;
  recoveryDurationType?: string | null;
  recoveryDurationValue?: number | null;
};

function paceBandFromTargets(
  targets?: ApiSegmentLike["targets"]
): { low?: number; high?: number } {
  if (!targets?.length) return {};
  for (const raw of targets) {
    if (String(raw.type ?? "").toUpperCase() !== "PACE") continue;
    const vl = typeof raw.valueLow === "number" && Number.isFinite(raw.valueLow) ? raw.valueLow : undefined;
    const vh = typeof raw.valueHigh === "number" && Number.isFinite(raw.valueHigh) ? raw.valueHigh : undefined;
    const v = typeof raw.value === "number" && Number.isFinite(raw.value) ? raw.value : undefined;
    if (vl != null && vh != null) {
      return { low: Math.min(vl, vh), high: Math.max(vl, vh) };
    }
    if (v != null) return { low: v, high: v };
    if (vl != null) return { low: vl, high: vl };
    if (vh != null) return { low: vh, high: vh };
  }
  return {};
}

function hrBandFromTargets(targets?: ApiSegmentLike["targets"]): { min?: number; max?: number } {
  if (!targets?.length) return {};
  for (const raw of targets) {
    if (String(raw.type ?? "").toUpperCase() !== "HEART_RATE") continue;
    const lo = typeof raw.valueLow === "number" && Number.isFinite(raw.valueLow) ? raw.valueLow : undefined;
    const hi = typeof raw.valueHigh === "number" && Number.isFinite(raw.valueHigh) ? raw.valueHigh : undefined;
    if (lo == null || hi == null) continue;
    return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
  }
  return {};
}

function extractMilesFromTitle(title: string): number | undefined {
  const m = title.match(/([\d.]+)\s*(?:mi|mile|miles)\b/i);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

function segmentLikeToSlot(seg: SegmentLike & { title?: string; targets?: ApiSegmentLike["targets"] }): SlotData {
  const title = seg.title ?? "";
  const durationType =
    String(seg.durationType ?? "DISTANCE").toUpperCase() === "TIME" ? "TIME" : "DISTANCE";
  let durationValue =
    typeof seg.durationValue === "number" && seg.durationValue > 0 ? seg.durationValue : 0;
  if (durationType === "DISTANCE" && durationValue === 0) {
    const fromTitle = extractMilesFromTitle(title);
    if (fromTitle != null) durationValue = fromTitle;
  }
  const pace = paceBandFromTargets(seg.targets as ApiSegmentLike["targets"]);
  const hr = hrBandFromTargets(seg.targets as ApiSegmentLike["targets"]);
  return {
    durationType,
    durationValue,
    segmentTitle: title.trim() || undefined,
    paceValueLow: pace.low,
    paceValueHigh: pace.high ?? pace.low,
    hrMin: hr.min,
    hrMax: hr.max,
    repeatCount: seg.repeatCount != null && seg.repeatCount > 1 ? seg.repeatCount : undefined,
    recoveryDurationType: seg.recoveryDurationType ?? null,
    recoveryDurationValue: seg.recoveryDurationValue ?? null,
  };
}

function isBookendTitle(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("warm") || t.includes("cool");
}

function isPacedOnOffRepeatGroup<T extends SegmentLike>(
  group: SegmentDisplayGroup<T>
): boolean {
  if (isMultiStepRepeatGroup(group) && group.cycleSteps && group.cycleSteps.length >= 2) {
    return true;
  }
  const reps = effectiveRepeatCount(group);
  if (reps <= 1) return false;
  const rec = group.recovery;
  if (!rec) return false;
  if (!segmentHasPaceTarget(rec)) return false;
  if (group.work.durationType !== "TIME" || rec.durationType !== "TIME") return false;
  if (isRecoveryTitle(group.work.title ?? "")) return false;
  return true;
}

function displayGroupToMainSlot<T extends SegmentLike & { title?: string; targets?: ApiSegmentLike["targets"] }>(
  group: SegmentDisplayGroup<T>
): SlotData {
  const reps = effectiveRepeatCount(group);

  if (isPacedOnOffRepeatGroup(group)) {
    const legs =
      group.cycleSteps && group.cycleSteps.length >= 2
        ? group.cycleSteps.map((step) => segmentLikeToSlot(step))
        : [segmentLikeToSlot(group.work), segmentLikeToSlot(group.recovery!)];
    return {
      durationType: legs[0]!.durationType,
      durationValue: 0,
      segmentTitle: humanDisplayGroupTitle(group),
      intervalBlock: { repeatCount: reps, legs },
    };
  }

  const workSlot = segmentLikeToSlot(group.work);
  const rec = group.recovery ?? group.betweenRepeatsRecovery;
  if (rec && reps > 1 && !segmentHasPaceTarget(rec)) {
    workSlot.repeatCount = reps;
    workSlot.recoveryDurationType = rec.durationType;
    workSlot.recoveryDurationValue = Number(rec.durationValue);
  } else if (reps > 1 && workSlot.repeatCount == null) {
    workSlot.repeatCount = reps;
  }
  return workSlot;
}

export function slotHasPositiveDuration(slot: SlotData | null | undefined): boolean {
  if (!slot) return false;
  if (slot.intervalBlock) {
    return slot.intervalBlock.legs.some((leg) => (leg.durationValue ?? 0) > 0);
  }
  return (slot.durationValue ?? 0) > 0;
}

/** Group-first mapping (no collapse) — one interval block card for timed ON/OFF fartleks. */
export function apiSegmentsToSlots(segments: ApiSegmentLike[]): {
  warmup: SlotData | null;
  mainSegments: SlotData[];
  cooldown: SlotData | null;
} {
  const segmentLikes = segments.map((s, i) => ({
    ...s,
    stepOrder: s.stepOrder ?? i + 1,
    title: s.title ?? "",
    durationType: s.durationType ?? "DISTANCE",
    durationValue: s.durationValue,
    targets: s.targets,
    repeatCount: s.repeatCount ?? null,
    recoveryDurationType: s.recoveryDurationType ?? null,
    recoveryDurationValue: s.recoveryDurationValue ?? null,
  }));

  const groups = groupSegmentsInDisplayOrder(segmentLikes);

  let warmup: SlotData | null = null;
  const mainSegments: SlotData[] = [];
  let cooldown: SlotData | null = null;

  for (const g of groups) {
    const title = (g.work.title ?? "").trim();
    const titleLower = title.toLowerCase();

    if (isBookendTitle(title)) {
      const slot = segmentLikeToSlot(g.work);
      if (/warm/.test(titleLower)) {
        warmup = { ...slot, segmentTitle: slot.segmentTitle ?? "Warmup" };
      } else if (/cool/.test(titleLower)) {
        cooldown = { ...slot, segmentTitle: slot.segmentTitle ?? "Cooldown" };
      } else {
        mainSegments.push(slot);
      }
      continue;
    }

    mainSegments.push(displayGroupToMainSlot(g));
  }

  return { warmup, mainSegments, cooldown };
}

export function intervalBlockHeaderLabel(slot: SlotData): string {
  if (!slot.intervalBlock) return slot.segmentTitle ?? "Main set";
  return `Repeat ${slot.intervalBlock.repeatCount}×`;
}

export type MaterializedApiSegment = {
  title: string;
  durationType: string;
  durationValue: number;
  repeatCount?: number;
  recoveryDurationType?: string | null;
  recoveryDurationValue?: number | null;
  paceValueLow?: number;
  paceValueHigh?: number;
  hrMin?: number;
  hrMax?: number;
};

/** Expand create slots to canonical API segment rows (Garmin/collapse-compatible). */
export function materializeMainSlotRows(
  slot: SlotData,
  defaultTitle: string
): MaterializedApiSegment[] {
  if (slot.intervalBlock && slot.intervalBlock.legs.length >= 2) {
    const { repeatCount, legs } = slot.intervalBlock;
    const [onLeg, offLeg] = legs;
    return [
      {
        title: onLeg.segmentTitle?.trim() || defaultTitle,
        durationType: onLeg.durationType,
        durationValue: onLeg.durationValue,
        repeatCount: repeatCount > 1 ? repeatCount : undefined,
        paceValueLow: onLeg.paceValueLow,
        paceValueHigh: onLeg.paceValueHigh,
        hrMin: onLeg.hrMin,
        hrMax: onLeg.hrMax,
        recoveryDurationType: null,
        recoveryDurationValue: null,
      },
      {
        title: offLeg.segmentTitle?.trim() || "Recovery",
        durationType: offLeg.durationType,
        durationValue: offLeg.durationValue,
        paceValueLow: offLeg.paceValueLow,
        paceValueHigh: offLeg.paceValueHigh,
        hrMin: offLeg.hrMin,
        hrMax: offLeg.hrMax,
        recoveryDurationType: null,
        recoveryDurationValue: null,
      },
    ];
  }

  return [
    {
      title: slot.segmentTitle?.trim() || defaultTitle,
      durationType: slot.durationType,
      durationValue: slot.durationValue,
      repeatCount: slot.repeatCount,
      recoveryDurationType: slot.recoveryDurationType,
      recoveryDurationValue: slot.recoveryDurationValue,
      paceValueLow: slot.paceValueLow,
      paceValueHigh: slot.paceValueHigh,
      hrMin: slot.hrMin,
      hrMax: slot.hrMax,
    },
  ];
}
