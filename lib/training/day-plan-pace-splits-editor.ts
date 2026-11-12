import { inferSegmentKind } from "@/lib/group-workout-segment-editor";
import {
  isPairRecovery,
  isRecoveryTitle,
  segmentsMatchForRepeat,
  SEGMENT_METERS_PER_MILE,
  STANDARD_TRACK_REP_METERS,
  structuredSegmentTotals,
  tryCollapseAlternatingWorkRecovery,
} from "@/lib/training/segment-summary";
import {
  editablePlannedSegmentsToApiPayload,
  formatMilesForEditInput,
  segmentToEditablePlanned,
  seedWorkBlockPaceIfMissing,
  type EditablePlannedSegment,
  type PlannedWorkoutSegment,
} from "@/lib/training/planned-workout-segment-editable";

export type DayPaceEditorKind = "warmup" | "cooldown" | "work" | "recovery";

export type DayPaceCollapsedSegment = EditablePlannedSegment & {
  memberIds: string[];
  displayRepCount: number;
  distanceUnit: "mi" | "m";
  editorKind: DayPaceEditorKind;
};

function inferDayPaceEditorKind(title: string): DayPaceEditorKind {
  if (inferSegmentKind(title) === "warmup") return "warmup";
  if (inferSegmentKind(title) === "cooldown") return "cooldown";
  if (isRecoveryTitle(title)) return "recovery";
  return "work";
}

const FIFTY_METER_GRID = 50;

/** True when meters are within 0.5% of a positive multiple of 50 m. */
export function metersNearFiftyGrid(meters: number): number | null {
  if (!Number.isFinite(meters) || meters <= 0) return null;
  const nearest = Math.round(meters / FIFTY_METER_GRID) * FIFTY_METER_GRID;
  if (nearest <= 0) return null;
  const relErr = Math.abs(meters - nearest) / nearest;
  if (relErr <= 0.005) return nearest;
  return null;
}

export function milesToMetersForDisplay(miles: number): number {
  if (!Number.isFinite(miles) || miles <= 0) return 0;
  const meters = miles * SEGMENT_METERS_PER_MILE;
  for (const target of STANDARD_TRACK_REP_METERS) {
    if (Math.abs(meters - target) / target <= 0.005) return target;
  }
  const grid = metersNearFiftyGrid(meters);
  if (grid != null) return grid;
  return Math.round(meters);
}

export function distanceUnitForDayPaceEdit(miles: number, kind: DayPaceEditorKind): "mi" | "m" {
  if (kind === "warmup" || kind === "cooldown") return "mi";
  if (!Number.isFinite(miles) || miles <= 0) return "mi";
  if (miles >= 1) return "mi";
  const meters = miles * SEGMENT_METERS_PER_MILE;
  if (metersNearFiftyGrid(meters) != null) return "m";
  for (const target of STANDARD_TRACK_REP_METERS) {
    if (Math.abs(meters - target) / target <= 0.005) return "m";
  }
  return "mi";
}

export function formatDistanceForDayPaceEdit(miles: number, kind: DayPaceEditorKind): string {
  const unit = distanceUnitForDayPaceEdit(miles, kind);
  if (unit === "m") {
    const m = milesToMetersForDisplay(miles);
    return m > 0 ? String(m) : "";
  }
  return formatMilesForEditInput(miles);
}

export function parseDayPaceDistanceInput(
  raw: string,
  unit: "mi" | "m"
): number {
  const n = parseFloat(raw.trim());
  if (!Number.isFinite(n) || n < 0) return NaN;
  if (unit === "m") return n / SEGMENT_METERS_PER_MILE;
  return n;
}

function segmentHasPaceTarget(seg: PlannedWorkoutSegment): boolean {
  const targets = seg.targets;
  if (!targets?.length) return false;
  return targets.some((t) => (t.type || "").toUpperCase() === "PACE");
}

function seedPaceIfAllowed(
  base: EditablePlannedSegment,
  source: PlannedWorkoutSegment,
  workoutType: string,
  fiveKSecPerMile: number | null
): EditablePlannedSegment {
  const kind = inferDayPaceEditorKind(source.title);
  if (kind === "recovery" && !segmentHasPaceTarget(source)) {
    return base;
  }
  if (kind === "warmup" || kind === "cooldown") {
    return base;
  }
  return seedWorkBlockPaceIfMissing(base, source.title, workoutType, fiveKSecPerMile);
}

function toCollapsedCard(
  template: PlannedWorkoutSegment,
  memberIds: string[],
  displayRepCount: number,
  workoutType: string,
  fiveKSecPerMile: number | null
): DayPaceCollapsedSegment {
  const editorKind = inferDayPaceEditorKind(template.title);
  let editable = segmentToEditablePlanned(template);
  editable = seedPaceIfAllowed(editable, template, workoutType, fiveKSecPerMile);
  const miles = template.durationType === "DISTANCE" ? Number(template.durationValue) : 0;
  const distanceUnit = distanceUnitForDayPaceEdit(miles, editorKind);
  const durationValue =
    template.durationType === "TIME"
      ? editable.durationValue
      : formatDistanceForDayPaceEdit(miles, editorKind);
  return {
    ...editable,
    durationValue,
    distanceUnit,
    memberIds,
    displayRepCount,
    editorKind,
  };
}

function splitAlternatingBlock<T extends { id: string; title?: string }>(block: T[]) {
  const work: T[] = [];
  const recovery: T[] = [];
  for (const s of block) {
    if (isRecoveryTitle(s.title ?? "")) recovery.push(s);
    else work.push(s);
  }
  return { work, recovery };
}

/**
 * Collapse flat interval/recovery ladders into one card per work block and one per recovery block.
 */
export function collapsePlannedSegmentsForDayPaceEditor(
  segments: PlannedWorkoutSegment[],
  workoutType: string,
  fiveKSecPerMile: number | null
): DayPaceCollapsedSegment[] {
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  if (sorted.length === 0) return [];

  const collapsed: DayPaceCollapsedSegment[] = [];
  let i = 0;

  while (i < sorted.length) {
    const seg = sorted[i]!;
    const kind = inferDayPaceEditorKind(seg.title);

    if (kind === "warmup" || kind === "cooldown") {
      collapsed.push(toCollapsedCard(seg, [seg.id], 1, workoutType, fiveKSecPerMile));
      i++;
      continue;
    }

    const alt = tryCollapseAlternatingWorkRecovery(sorted, i);
    if (alt && alt.workCount > 1) {
      const block = sorted.slice(i, alt.nextIndex);
      const { work, recovery } = splitAlternatingBlock(block);
      if (work.length > 0) {
        collapsed.push(
          toCollapsedCard(work[0]!, work.map((w) => w.id), work.length, workoutType, fiveKSecPerMile)
        );
      }
      if (recovery.length > 0) {
        collapsed.push(
          toCollapsedCard(
            recovery[0]!,
            recovery.map((r) => r.id),
            recovery.length,
            workoutType,
            fiveKSecPerMile
          )
        );
      }
      i = alt.nextIndex;
      continue;
    }

    if (seg.repeatCount != null && seg.repeatCount > 1) {
      const next = sorted[i + 1];
      if (next && isPairRecovery(seg, next)) {
        collapsed.push(
          toCollapsedCard(seg, [seg.id], seg.repeatCount, workoutType, fiveKSecPerMile)
        );
        collapsed.push(toCollapsedCard(next, [next.id], 1, workoutType, fiveKSecPerMile));
        i += 2;
        continue;
      }
      collapsed.push(toCollapsedCard(seg, [seg.id], seg.repeatCount, workoutType, fiveKSecPerMile));
      i++;
      continue;
    }

    if (!isRecoveryTitle(seg.title)) {
      let count = 1;
      let j = i + 1;
      while (j < sorted.length) {
        const nextSeg = sorted[j]!;
        if (isRecoveryTitle(nextSeg.title)) break;
        if (!segmentsMatchForRepeat(seg, nextSeg)) break;
        count++;
        j++;
      }
      if (count > 1) {
        collapsed.push(
          toCollapsedCard(
            seg,
            sorted.slice(i, j).map((s) => s.id),
            count,
            workoutType,
            fiveKSecPerMile
          )
        );
        i = j;
        continue;
      }
    } else {
      let count = 1;
      let j = i + 1;
      while (j < sorted.length) {
        const nextSeg = sorted[j]!;
        if (!isRecoveryTitle(nextSeg.title)) break;
        if (!segmentsMatchForRepeat(seg, nextSeg)) break;
        count++;
        j++;
      }
      if (count > 1) {
        collapsed.push(
          toCollapsedCard(
            seg,
            sorted.slice(i, j).map((s) => s.id),
            count,
            workoutType,
            fiveKSecPerMile
          )
        );
        i = j;
        continue;
      }
    }

    collapsed.push(toCollapsedCard(seg, [seg.id], 1, workoutType, fiveKSecPerMile));
    i++;
  }

  return collapsed;
}

/** Expand collapsed editor cards back to one row per original segment id (preserves flat ladder shape). */
export function expandCollapsedDayPaceToFlatSegments(
  collapsed: DayPaceCollapsedSegment[],
  originalFlat: PlannedWorkoutSegment[]
): EditablePlannedSegment[] {
  const byId = new Map<string, DayPaceCollapsedSegment>();
  for (const card of collapsed) {
    for (const id of card.memberIds) {
      byId.set(id, card);
    }
  }

  const sorted = [...originalFlat].sort((a, b) => a.stepOrder - b.stepOrder);
  return sorted.map((orig) => {
    const card = byId.get(orig.id);
    if (!card) {
      return segmentToEditablePlanned(orig);
    }
    let durationValue = card.durationValue;
    if (card.durationType === "DISTANCE") {
      const miles = parseDayPaceDistanceInput(card.durationValue, card.distanceUnit);
      durationValue = Number.isFinite(miles)
        ? formatMilesForEditInput(miles)
        : card.durationValue;
    }
    return {
      ...card,
      clientKey: orig.id,
      title: orig.title,
      durationValue,
      repeatCount: orig.repeatCount != null && orig.repeatCount > 1 ? String(orig.repeatCount) : "",
      recoveryDurationType: orig.recoveryDurationType ?? card.recoveryDurationType,
      recoveryDurationValue: card.recoveryDurationValue,
      notes: orig.notes ?? card.notes,
    };
  });
}

export function plannedSegmentsToCollapsedDayPaceState(
  segments: PlannedWorkoutSegment[],
  workoutType: string,
  fiveKSecPerMile: number | null
): DayPaceCollapsedSegment[] {
  return collapsePlannedSegmentsForDayPaceEditor(segments, workoutType, fiveKSecPerMile);
}

export function saveCollapsedDayPaceSegments(
  collapsed: DayPaceCollapsedSegment[],
  originalFlat: PlannedWorkoutSegment[]
) {
  const flat = expandCollapsedDayPaceToFlatSegments(collapsed, originalFlat);
  return editablePlannedSegmentsToApiPayload(flat);
}

export function formatDayPaceEditorTotalMiles(
  segments: Array<{
    stepOrder?: number;
    durationType: string;
    durationValue: number;
    repeatCount?: number | null;
  }>
): string | null {
  const { miles } = structuredSegmentTotals(
    segments.map((s, i) => ({
      stepOrder: s.stepOrder ?? i + 1,
      durationType: s.durationType,
      durationValue: s.durationValue,
      repeatCount: s.repeatCount,
    }))
  );
  if (!Number.isFinite(miles) || miles <= 0) return null;
  const rounded = Math.round(miles * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return `${Math.round(rounded)} mi total`;
  }
  return `${rounded.toFixed(1)} mi total`;
}

export function formatTotalMilesFromCollapsedEditor(
  collapsed: DayPaceCollapsedSegment[],
  originalFlat: PlannedWorkoutSegment[]
): string | null {
  if (collapsed.length === 0) return null;
  try {
    const payload = saveCollapsedDayPaceSegments(collapsed, originalFlat);
    return formatDayPaceEditorTotalMiles(
      payload.map((p, i) => ({
        stepOrder: p.stepOrder ?? i + 1,
        durationType: p.durationType,
        durationValue: Number(p.durationValue),
        repeatCount: p.repeatCount ?? null,
      }))
    );
  } catch {
    return null;
  }
}

export function dayPaceEditorKindLabel(kind: DayPaceEditorKind): string {
  if (kind === "warmup") return "Warmup";
  if (kind === "cooldown") return "Cooldown";
  if (kind === "recovery") return "Recovery";
  return "Work";
}

export function dayPaceEditorKindHeaderClass(kind: DayPaceEditorKind): string {
  if (kind === "warmup" || kind === "cooldown") return "bg-gray-500 text-white";
  if (kind === "recovery") return "bg-teal-600 text-white";
  return "bg-orange-500 text-white";
}
