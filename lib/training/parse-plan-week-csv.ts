/**
 * Week-scope CSV adapter: Date, Workout, Type, Mileage, Pace → PlanWeekSchedule rows for parse/catalogue match.
 */

import type { PlanDaySchedule, PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import { dateKeyInWeekBounds } from "@/lib/training/plan-week-ingest-guard";
import type { WeekBounds } from "@/lib/training/plan-schedule";
import { isPlanWeekCsvHeaderLine } from "@/lib/training/plan-week-csv-template";
import type { PlanWeekIngestRow } from "@/lib/training/plan-ingest-contract";
import {
  mapCsvType,
  normalizeDateKey,
  ourDowFromDateKey,
  parseCsvRow,
  planWeekCsvNonCommentLines,
} from "@/lib/training/parse-plan-week-csv-shared";

export { planWeekCsvNonCommentLines } from "@/lib/training/parse-plan-week-csv-shared";

export type ParsedPlanWeekCsv = {
  week: PlanWeekSchedule;
  skippedNotes: string[];
  outOfWeekNotes: string[];
  metaByDateKey: Record<string, { workoutName: string; paceNote: string }>;
  weekIngestRows: PlanWeekIngestRow[];
};

export function looksLikePlanWeekCsv(sourceText: string): boolean {
  const first = planWeekCsvNonCommentLines(sourceText)[0];
  return first != null && isPlanWeekCsvHeaderLine(first);
}

export function tryParsePlanWeekCsvText(params: {
  sourceText: string;
  weekNumber: number;
  weekBounds: WeekBounds;
  raceDateKey: string | null;
}): ParsedPlanWeekCsv | null {
  const lines = planWeekCsvNonCommentLines(params.sourceText);
  if (lines.length < 2) return null;
  if (!isPlanWeekCsvHeaderLine(lines[0]!)) return null;

  const skippedNotes: string[] = [];
  const outOfWeekNotes: string[] = [];
  const metaByDateKey: Record<string, { workoutName: string; paceNote: string }> = {};
  const weekIngestRows: PlanWeekIngestRow[] = [];
  const byDow = new Map<number, PlanDaySchedule>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]!);
    const workoutName = (cols[1] ?? "").trim();
    const typeRaw = (cols[2] ?? "").trim();
    const pace = (cols[4] ?? "").trim();

    if (cols.length < 4) {
      weekIngestRows.push({
        dateKey: "",
        workoutName,
        type: typeRaw,
        miles: null,
        pace,
        status: "invalid",
        detail: `Row ${i + 1}: need Date, Workout, Type, Mileage columns`,
      });
      continue;
    }

    const dateKey = normalizeDateKey(cols[0] ?? "");
    if (!dateKey) {
      outOfWeekNotes.push(`Row ${i + 1}: invalid date`);
      weekIngestRows.push({
        dateKey: "",
        workoutName,
        type: typeRaw,
        miles: null,
        pace,
        status: "invalid",
        detail: `Row ${i + 1}: invalid date`,
      });
      continue;
    }

    if (
      !dateKeyInWeekBounds(dateKey, params.weekBounds.weekStart, params.weekBounds.weekEnd)
    ) {
      outOfWeekNotes.push(`Row ${i + 1} (${dateKey}): outside selected week`);
      weekIngestRows.push({
        dateKey,
        workoutName,
        type: typeRaw,
        miles: null,
        pace,
        status: "out_of_week",
        detail: "Outside selected week",
      });
      continue;
    }

    const mapped = mapCsvType(cols[2] ?? "");
    if (mapped === "SKIP_RACE" || params.raceDateKey === dateKey) {
      skippedNotes.push(`Skipped ${dateKey}: race day`);
      weekIngestRows.push({
        dateKey,
        workoutName,
        type: typeRaw || "Race",
        miles: null,
        pace,
        status: "skipped_race",
        detail: "Goal race day — omit from CSV",
      });
      continue;
    }

    const milesRaw = parseFloat(String(cols[3] ?? "").replace(/[^\d.]/g, ""));
    const miles =
      Number.isFinite(milesRaw) && milesRaw > 0 ? Math.round(milesRaw * 100) / 100 : 4;
    const workoutType = mapped ?? "Easy";
    const dow = ourDowFromDateKey(dateKey);

    byDow.set(dow, {
      dow,
      workoutType,
      miles,
      catalogueWorkoutId: null,
      planCycleIndex: null,
    });

    metaByDateKey[dateKey] = { workoutName, paceNote: pace };
    weekIngestRows.push({
      dateKey,
      workoutName,
      type: workoutType,
      miles,
      pace,
      status: "import",
    });
  }

  if (byDow.size === 0 && skippedNotes.length === 0 && outOfWeekNotes.length > 0) {
    return null;
  }
  if (byDow.size === 0 && skippedNotes.length > 0) {
    return {
      week: { weekNumber: params.weekNumber, days: [] },
      skippedNotes,
      outOfWeekNotes,
      metaByDateKey,
      weekIngestRows,
    };
  }
  if (byDow.size === 0) return null;

  const days = [...byDow.values()].sort((a, b) => a.dow - b.dow);
  return {
    week: { weekNumber: params.weekNumber, days },
    skippedNotes,
    outOfWeekNotes,
    metaByDateKey,
    weekIngestRows,
  };
}
