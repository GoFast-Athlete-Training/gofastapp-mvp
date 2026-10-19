/**
 * Week-scope CSV adapter: Date, Workout, Type, Mileage, Pace → PlanWeekSchedule + optional segments.
 */

import type { WorkoutType } from "@prisma/client";
import type { WorkoutStep } from "@/lib/training/prescription";
import type { PlanDaySchedule, PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import { dateKeyInWeekBounds } from "@/lib/training/plan-week-ingest-guard";
import {
  parsedPasteToAiGenerateResponse,
  tryParsePastedWorkoutText,
  type ParsedPasteWorkout,
} from "@/lib/training/parse-pasted-workout";
import type { WeekBounds } from "@/lib/training/plan-schedule";

const CSV_HEADER =
  /^date\s*,\s*workout\s*,\s*type\s*,\s*mileage\s*,\s*pace\s*$/i;

export type ParsedPlanWeekCsv = {
  week: PlanWeekSchedule;
  skippedNotes: string[];
  outOfWeekNotes: string[];
  daySegmentsByDateKey: Record<string, WorkoutStep[]>;
};

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function mapCsvType(raw: string): WorkoutType | "SKIP_RACE" | null {
  const t = raw.trim().toLowerCase();
  if (!t) return "Easy";
  if (t === "race") return "SKIP_RACE";
  if (t === "shakeout") return "Easy";
  if (t === "easy" || t === "recovery") return "Easy";
  if (t === "tempo" || t === "threshold") return "Tempo";
  if (t === "intervals" || t === "interval" || t === "speed") return "Intervals";
  if (t === "long" || t === "longrun" || t === "long run") return "LongRun";
  if (/^easy$/i.test(raw.trim())) return "Easy";
  const cap = raw.trim();
  if (cap === "Tempo" || cap === "Intervals" || cap === "LongRun" || cap === "Easy") {
    return cap as WorkoutType;
  }
  return "Easy";
}

function normalizeDateKey(cell: string): string | null {
  const s = cell.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1]!.padStart(2, "0");
    const dd = m[2]!.padStart(2, "0");
    return `${m[3]}-${mm}-${dd}`;
  }
  return null;
}

function ourDowFromDateKey(dateKey: string): number {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

function paceHasStructure(pace: string): boolean {
  const p = pace.trim();
  if (!p) return false;
  if (p.includes(";")) return true;
  if (/\d+\s*mi\b/i.test(p) && (/\bwarm/i.test(p) || /\bcool/i.test(p) || /@/.test(p))) {
    return true;
  }
  return tryParsePastedWorkoutText(p) != null;
}

function segmentsFromStructuredPace(
  pace: string,
  workoutType: WorkoutType,
  fiveKPace: string | null
): WorkoutStep[] | null {
  const parsed = tryParsePastedWorkoutText(pace, workoutType);
  if (parsed) {
    const built = parsedPasteToAiGenerateResponse(parsed, fiveKPace);
    if (built.segments.length > 0) return built.segments;
  }

  const parts = pace.split(";").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const segments: ParsedPasteWorkout["segments"] = [];
  for (const part of parts) {
    const mi = part.match(/(\d+(?:\.\d+)?)\s*mi\b/i);
    if (!mi) continue;
    const miles = parseFloat(mi[1]!);
    if (!Number.isFinite(miles) || miles <= 0) continue;
    const lower = part.toLowerCase();
    let title = "Easy";
    if (/\btempo\b/.test(lower) || /@\s*\d/.test(part)) title = "Tempo";
    else if (/\bwarm/.test(lower)) title = "Warm-up";
    else if (/\bcool/.test(lower)) title = "Cool-down";

    segments.push({
      title,
      durationType: "DISTANCE",
      durationValue: miles,
      effortContext: part,
    });
  }
  if (segments.length < 2) return null;

  const synthetic: ParsedPasteWorkout = {
    segments,
    suggestedTitle: `${workoutType} blocks`,
    suggestedDescription: pace.slice(0, 160),
  };
  return parsedPasteToAiGenerateResponse(synthetic, fiveKPace).segments;
}

export function looksLikePlanWeekCsv(sourceText: string): boolean {
  const first = sourceText.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  return first != null && CSV_HEADER.test(first);
}

export function tryParsePlanWeekCsvText(params: {
  sourceText: string;
  weekNumber: number;
  weekBounds: WeekBounds;
  fiveKPace: string | null;
  raceDateKey: string | null;
}): ParsedPlanWeekCsv | null {
  const lines = params.sourceText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  if (!CSV_HEADER.test(lines[0]!)) return null;

  const skippedNotes: string[] = [];
  const outOfWeekNotes: string[] = [];
  const daySegmentsByDateKey: Record<string, WorkoutStep[]> = {};
  const byDow = new Map<number, PlanDaySchedule>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]!);
    if (cols.length < 4) continue;

    const dateKey = normalizeDateKey(cols[0] ?? "");
    if (!dateKey) {
      outOfWeekNotes.push(`Row ${i + 1}: invalid date`);
      continue;
    }

    if (
      !dateKeyInWeekBounds(dateKey, params.weekBounds.weekStart, params.weekBounds.weekEnd)
    ) {
      outOfWeekNotes.push(`Row ${i + 1} (${dateKey}): outside selected week`);
      continue;
    }

    const workoutName = (cols[1] ?? "").trim();
    const mapped = mapCsvType(cols[2] ?? "");
    if (mapped === "SKIP_RACE" || params.raceDateKey === dateKey) {
      skippedNotes.push(`Skipped ${dateKey}: race day`);
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

    const pace = (cols[4] ?? "").trim();
    if (pace && paceHasStructure(pace)) {
      const segments = segmentsFromStructuredPace(pace, workoutType, params.fiveKPace);
      if (segments && segments.length > 0) {
        daySegmentsByDateKey[dateKey] = segments;
      }
    }

    void workoutName;
  }

  if (byDow.size === 0 && skippedNotes.length === 0 && outOfWeekNotes.length > 0) {
    return null;
  }
  if (byDow.size === 0 && skippedNotes.length > 0) {
    return {
      week: { weekNumber: params.weekNumber, days: [] },
      skippedNotes,
      outOfWeekNotes,
      daySegmentsByDateKey,
    };
  }
  if (byDow.size === 0) return null;

  const days = [...byDow.values()].sort((a, b) => a.dow - b.dow);
  return {
    week: { weekNumber: params.weekNumber, days },
    skippedNotes,
    outOfWeekNotes,
    daySegmentsByDateKey,
  };
}
