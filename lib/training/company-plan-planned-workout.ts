import { Prisma } from "@prisma/client";
import { inferSegmentKind } from "@/lib/group-workout-segment-editor";
import { prisma } from "@/lib/prisma";
import { productTodayKey } from "@/lib/plan-calendar-day";
import { loadPlannedWorkoutDetailForAthlete } from "@/lib/training/planned-workout-detail";
import {
  editablePlannedSegmentsToApiPayload,
  segmentToEditablePlanned,
  type EditablePlannedSegment,
  type PlannedWorkoutSegment,
} from "@/lib/training/planned-workout-segment-editable";
import { isRecoveryTitle } from "@/lib/training/segment-summary";
import { ymdFromDate } from "@/lib/training/plan-utils";
import { replacePrescribeSegmentsForAthlete } from "@/lib/training/workout-or-planned-resolve";

export type StaffPlannedSegment = {
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: string;
  repeatCount: string;
  recoveryDurationType: string;
  recoveryDurationValue: string;
  paceLowMin: string;
  paceLowSec: string;
  paceHighMin: string;
  paceHighSec: string;
  notes: string;
  paceLabel: string;
};

export type StaffPlannedWorkout = {
  plannedWorkoutId: string;
  title: string;
  workoutType: string;
  miles: number | null;
  fiveKPace: string | null;
  snapshot: string;
  segments: StaffPlannedSegment[];
};

function splitLabel(min: string, sec: string): string {
  if (!min.trim() && !sec.trim()) return "";
  const seconds = (sec.trim() || "0").padStart(2, "0");
  return `${min.trim() || "0"}:${seconds}`;
}

export function segmentPaceLabel(segment: {
  paceLowMin: string;
  paceLowSec: string;
  paceHighMin: string;
  paceHighSec: string;
}): string {
  const low = splitLabel(segment.paceLowMin, segment.paceLowSec);
  const high = splitLabel(segment.paceHighMin, segment.paceHighSec);
  if (!low) return "";
  if (!high || high === low) return low;
  return `${low}–${high}`;
}

function formatDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) return dayKey;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function plannedWorkoutSnapshot(input: {
  dayKey: string | null;
  todayKey: string;
  miles: number | null;
  pace: string | null;
  fiveKPace: string | null;
}): string {
  const when =
    input.dayKey && input.dayKey === input.todayKey
      ? "Today"
      : input.dayKey
        ? formatDayKey(input.dayKey)
        : "This day";
  const distance = input.miles != null ? `${input.miles} miles` : "a workout";
  const pace = input.pace ? ` at ${input.pace}/mi` : "";
  const fiveK = input.fiveKPace ? ` based on your ${input.fiveKPace} 5K` : "";
  return `${when} you have ${distance}${pace}${fiveK}.`;
}

function mainWorkPace(segments: EditablePlannedSegment[]): string | null {
  for (const segment of segments) {
    if (inferSegmentKind(segment.title) !== "work") continue;
    if (isRecoveryTitle(segment.title)) continue;
    const pace = segmentPaceLabel(segment);
    if (pace) return pace;
  }
  return null;
}

function milesFromSegments(
  estimatedDistanceInMeters: number | null,
  segments: EditablePlannedSegment[],
): number | null {
  if (estimatedDistanceInMeters != null && estimatedDistanceInMeters > 0) {
    return Math.round((estimatedDistanceInMeters / 1609.34) * 10) / 10;
  }
  let miles = 0;
  for (const segment of segments) {
    if (segment.durationType !== "DISTANCE") continue;
    const distance = Number(segment.durationValue);
    if (!Number.isFinite(distance) || distance <= 0) continue;
    const reps = Number(segment.repeatCount);
    miles += distance * (Number.isFinite(reps) && reps > 1 ? reps : 1);
  }
  return miles > 0 ? Math.round(miles * 10) / 10 : null;
}

function toPlannedSegment(row: {
  id: string;
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  targets: unknown;
  repeatCount?: number | null;
  recoveryDurationType?: string | null;
  recoveryDurationValue?: number | null;
  notes?: string | null;
  paceTargetEncodingVersion?: number | null;
}): PlannedWorkoutSegment {
  return {
    id: row.id,
    stepOrder: row.stepOrder,
    title: row.title,
    durationType: row.durationType === "TIME" ? "TIME" : "DISTANCE",
    durationValue: row.durationValue,
    targets: Array.isArray(row.targets)
      ? (row.targets as PlannedWorkoutSegment["targets"])
      : undefined,
    repeatCount: row.repeatCount ?? null,
    recoveryDurationType: row.recoveryDurationType ?? null,
    recoveryDurationValue: row.recoveryDurationValue ?? null,
    notes: row.notes ?? null,
    paceTargetEncodingVersion: row.paceTargetEncodingVersion ?? null,
  };
}

function toStaffSegment(segment: EditablePlannedSegment): StaffPlannedSegment {
  return {
    title: segment.title,
    durationType: segment.durationType,
    durationValue: segment.durationValue,
    repeatCount: segment.repeatCount,
    recoveryDurationType: segment.recoveryDurationType,
    recoveryDurationValue: segment.recoveryDurationValue,
    paceLowMin: segment.paceLowMin,
    paceLowSec: segment.paceLowSec,
    paceHighMin: segment.paceHighMin,
    paceHighSec: segment.paceHighSec,
    notes: segment.notes,
    paceLabel: segmentPaceLabel(segment),
  };
}

function viewFromDetail(detail: {
  plannedWorkoutId: string;
  title: string;
  workoutType: string;
  date: Date | null;
  estimatedDistanceInMeters: number | null;
  fiveKPace: string | null;
  segments: Parameters<typeof toPlannedSegment>[0][];
}): StaffPlannedWorkout {
  const editable = detail.segments
    .slice()
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((segment) => segmentToEditablePlanned(toPlannedSegment(segment)));
  const miles = milesFromSegments(detail.estimatedDistanceInMeters, editable);
  const pace = mainWorkPace(editable);
  const dayKey = detail.date ? ymdFromDate(detail.date) : null;
  return {
    plannedWorkoutId: detail.plannedWorkoutId,
    title: detail.title,
    workoutType: detail.workoutType,
    miles,
    fiveKPace: detail.fiveKPace,
    snapshot: plannedWorkoutSnapshot({
      dayKey,
      todayKey: productTodayKey(),
      miles,
      pace,
      fiveKPace: detail.fiveKPace,
    }),
    segments: editable.map(toStaffSegment),
  };
}

async function ownedPlan(planId: string, plannedWorkoutId: string) {
  const plan = await prisma.training_plans.findUnique({
    where: { id: planId },
    select: {
      id: true,
      athleteId: true,
      Athlete: { select: { fiveKPace: true } },
    },
  });
  if (!plan) return null;
  const planned = await prisma.planned_workouts.findFirst({
    where: { id: plannedWorkoutId, planId: plan.id, athleteId: plan.athleteId },
    select: { id: true },
  });
  if (!planned) return null;
  return plan;
}

export async function loadCompanyPlanPlannedWorkout(
  planId: string,
  plannedWorkoutId: string,
): Promise<StaffPlannedWorkout | null> {
  const plan = await ownedPlan(planId, plannedWorkoutId);
  if (!plan) return null;
  const detail = await loadPlannedWorkoutDetailForAthlete({
    plannedWorkoutId,
    athleteId: plan.athleteId,
  });
  if (!detail || detail.planId !== plan.id) return null;
  const fiveK = plan.Athlete?.fiveKPace?.trim() || null;
  return viewFromDetail({
    plannedWorkoutId: detail.plannedWorkoutId,
    title: detail.title,
    workoutType: detail.workoutType,
    date: detail.date,
    estimatedDistanceInMeters: detail.estimatedDistanceInMeters,
    fiveKPace: fiveK,
    segments: detail.segments,
  });
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value == null) return "";
  return typeof value === "string" ? value : null;
}

function parseStaffSegments(raw: unknown): EditablePlannedSegment[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) {
    return { error: "segments must be 1 to 40 rows" };
  }
  const segments: EditablePlannedSegment[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") return { error: `Segment ${i + 1} is invalid` };
    const record = row as Record<string, unknown>;
    const durationType =
      record.durationType === "TIME" ? "TIME" : record.durationType === "DISTANCE" ? "DISTANCE" : null;
    if (!durationType) return { error: `Segment ${i + 1}: durationType must be DISTANCE or TIME` };
    const fields = [
      "title",
      "durationValue",
      "repeatCount",
      "recoveryDurationType",
      "recoveryDurationValue",
      "paceLowMin",
      "paceLowSec",
      "paceHighMin",
      "paceHighSec",
      "notes",
    ] as const;
    const values: Record<(typeof fields)[number], string> = {
      title: "",
      durationValue: "",
      repeatCount: "",
      recoveryDurationType: "",
      recoveryDurationValue: "",
      paceLowMin: "",
      paceLowSec: "",
      paceHighMin: "",
      paceHighSec: "",
      notes: "",
    };
    for (const field of fields) {
      const value = readString(record, field);
      if (value == null) return { error: `Segment ${i + 1}: ${field} must be text` };
      values[field] = value;
    }
    segments.push({
      clientKey: `row-${i + 1}`,
      title: values.title,
      durationType,
      durationValue: values.durationValue,
      repeatCount: values.repeatCount,
      recoveryDurationType: values.recoveryDurationType,
      recoveryDurationValue: values.recoveryDurationValue,
      paceLowMin: values.paceLowMin,
      paceLowSec: values.paceLowSec,
      paceHighMin: values.paceHighMin,
      paceHighSec: values.paceHighSec,
      notes: values.notes,
    });
  }
  return segments;
}

export async function saveCompanyPlanPlannedWorkoutSegments(
  planId: string,
  plannedWorkoutId: string,
  segmentsRaw: unknown,
): Promise<{ ok: true; workout: StaffPlannedWorkout } | { ok: false; error: string }> {
  const plan = await ownedPlan(planId, plannedWorkoutId);
  if (!plan) return { ok: false, error: "Plan not found" };

  const parsed = parseStaffSegments(segmentsRaw);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  let normalized;
  try {
    normalized = editablePlannedSegmentsToApiPayload(parsed);
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid segments" };
  }

  const saved = await replacePrescribeSegmentsForAthlete({
    id: plannedWorkoutId,
    athleteId: plan.athleteId,
    normalized: normalized.map((segment) => ({
      stepOrder: segment.stepOrder,
      title: segment.title,
      durationType: segment.durationType,
      durationValue: segment.durationValue,
      targets: (segment.targets ?? null) as Prisma.InputJsonValue | null,
      repeatCount: segment.repeatCount,
      notes: segment.notes,
      recoveryDurationType: segment.recoveryDurationType,
      recoveryDurationValue: segment.recoveryDurationValue,
    })),
  });
  if (!saved || saved.kind !== "planned" || saved.plannedWorkoutId !== plannedWorkoutId) {
    return { ok: false, error: "Plan not found" };
  }

  const workout = await loadCompanyPlanPlannedWorkout(planId, plannedWorkoutId);
  if (!workout) return { ok: false, error: "Plan not found" };
  return { ok: true, workout };
}
