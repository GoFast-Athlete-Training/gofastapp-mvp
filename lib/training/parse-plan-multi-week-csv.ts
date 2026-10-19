/**
 * Multi-week plan CSV: Week, Date, Workout, Type, Mileage, Pace → PlanWeekSchedule[].
 */

import type { PlanDaySchedule, PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import { isPlanMultiWeekCsvHeaderLine } from "@/lib/training/plan-multi-week-csv-template";
import {
  mapCsvType,
  normalizeDateKey,
  ourDowFromDateKey,
  parseCsvRow,
  planWeekCsvNonCommentLines,
} from "@/lib/training/parse-plan-week-csv-shared";

export function looksLikePlanMultiWeekCsv(sourceText: string): boolean {
  const first = planWeekCsvNonCommentLines(sourceText)[0];
  return first != null && isPlanMultiWeekCsvHeaderLine(first);
}

export function tryParsePlanMultiWeekCsvWithMeta(params: {
  sourceText: string;
  raceDateKey: string | null;
}):
  | {
      weeks: PlanWeekSchedule[];
      skippedNotes: string[];
      metaByWeekNumber: Record<number, Record<string, { workoutName: string; paceNote: string }>>;
    }
  | null {
  const lines = planWeekCsvNonCommentLines(params.sourceText);
  if (lines.length < 2) return null;
  if (!isPlanMultiWeekCsvHeaderLine(lines[0]!)) return null;

  const skippedNotes: string[] = [];
  const byWeek = new Map<number, Map<number, PlanDaySchedule>>();
  const metaByWeekNumber: Record<
    number,
    Record<string, { workoutName: string; paceNote: string }>
  > = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]!);
    if (cols.length < 5) {
      skippedNotes.push(`Row ${i + 1}: need Week, Date, Workout, Type, Mileage`);
      continue;
    }

    const weekNumber = Math.floor(parseInt(String(cols[0] ?? "").trim(), 10));
    if (!Number.isFinite(weekNumber) || weekNumber < 1) {
      skippedNotes.push(`Row ${i + 1}: invalid Week number`);
      continue;
    }

    const dateKey = normalizeDateKey(cols[1] ?? "");
    if (!dateKey) {
      skippedNotes.push(`Row ${i + 1}: invalid date`);
      continue;
    }

    if (params.raceDateKey === dateKey) {
      skippedNotes.push(`Skipped ${dateKey}: race day`);
      continue;
    }

    const mapped = mapCsvType(cols[3] ?? "");
    if (mapped === "SKIP_RACE") {
      skippedNotes.push(`Skipped ${dateKey}: race row`);
      continue;
    }

    const pace = (cols[5] ?? "").trim();
    const milesRaw = parseFloat(String(cols[4] ?? "").replace(/[^\d.]/g, ""));
    const miles =
      Number.isFinite(milesRaw) && milesRaw > 0 ? Math.round(milesRaw * 100) / 100 : 4;
    const dow = ourDowFromDateKey(dateKey);

    if (!byWeek.has(weekNumber)) byWeek.set(weekNumber, new Map());
    byWeek.get(weekNumber)!.set(dow, {
      dow,
      workoutType: mapped ?? "Easy",
      miles,
      catalogueWorkoutId: null,
      planCycleIndex: null,
    });

    if (!metaByWeekNumber[weekNumber]) metaByWeekNumber[weekNumber] = {};
    metaByWeekNumber[weekNumber]![dateKey] = {
      workoutName: (cols[2] ?? "").trim(),
      paceNote: pace,
    };
  }

  if (byWeek.size === 0) return null;

  const weeks: PlanWeekSchedule[] = [];
  for (const weekNumber of [...byWeek.keys()].sort((a, b) => a - b)) {
    const days = [...(byWeek.get(weekNumber)?.values() ?? [])].sort((a, b) => a.dow - b.dow);
    if (days.length > 0) weeks.push({ weekNumber, days });
  }
  if (weeks.length === 0) return null;

  return { weeks, skippedNotes, metaByWeekNumber };
}
