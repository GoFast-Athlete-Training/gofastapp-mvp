/**
 * Human-readable week ingest preview — projection of guarded PlanWeekSchedule.
 */

import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import type { WorkoutStep } from "@/lib/training/prescription";
import type {
  PlanWeekIngestRow,
  PlanWeekPreviewDay,
} from "@/lib/training/plan-ingest-contract";
import { addDaysUtc, utcDateOnly, ymdFromDate } from "@/lib/training/plan-utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function formatIngestStructurePreviewLines(steps: WorkoutStep[]): string[] {
  return steps.map((s) => {
    const mi =
      s.durationType === "DISTANCE"
        ? `${s.durationValue} mi`
        : s.durationType === "TIME"
          ? `${Math.round(s.durationValue / 60)} min`
          : `${s.durationValue}`;
    return `${s.title} · ${mi}`;
  });
}

export function ourDowFromUtcDate(d: Date): number {
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

export function buildWeekPreviewDays(params: {
  weekStart: Date;
  weekEnd: Date;
  guardedWeek: PlanWeekSchedule;
  protectedDateKeys: Set<string>;
  raceDateKey: string | null;
  metaByDateKey?: Record<string, { workoutName?: string; paceNote?: string }>;
  daySegmentsByDateKey?: Record<string, WorkoutStep[]>;
}): PlanWeekPreviewDay[] {
  const out: PlanWeekPreviewDay[] = [];
  let cursor = utcDateOnly(params.weekStart);
  const end = utcDateOnly(params.weekEnd);

  while (cursor.getTime() <= end.getTime()) {
    const dateKey = ymdFromDate(cursor);
    const ourDow = ourDowFromUtcDate(cursor);
    const day = params.guardedWeek.days.find((d) => d.dow === ourDow);
    if (!day) {
      cursor = addDaysUtc(cursor, 1);
      continue;
    }

    const protectedDay = params.protectedDateKeys.has(dateKey);
    const meta = params.metaByDateKey?.[dateKey];
    let keepReason: PlanWeekPreviewDay["keepReason"] = null;
    if (protectedDay) {
      keepReason = params.raceDateKey === dateKey ? "race" : "completed";
    }

    const segmentSteps = params.daySegmentsByDateKey?.[dateKey];
    out.push({
      dateKey,
      weekdayLabel: WEEKDAY_LABELS[ourDow - 1] ?? "Day",
      workoutType: day.workoutType,
      miles: day.miles,
      workoutName: meta?.workoutName ?? null,
      paceNote: meta?.paceNote ?? null,
      hasCustomSegments: Boolean(segmentSteps?.length),
      structurePreviewLines: segmentSteps?.length
        ? formatIngestStructurePreviewLines(segmentSteps)
        : undefined,
      action: protectedDay ? "keep" : "replace",
      keepReason,
    });

    cursor = addDaysUtc(cursor, 1);
  }

  return out;
}

export type { PlanWeekIngestRow, PlanWeekPreviewDay };
