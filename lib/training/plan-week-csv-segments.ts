/**
 * Turn week CSV Pace column text into prescription steps (explicit @ paces + 5K anchor).
 */

import type { WorkoutType } from "@prisma/client";
import type { WorkoutStep } from "@/lib/training/prescription";
import {
  parsedPasteToAiGenerateResponse,
  tryParsePastedWorkoutText,
  type ParsedPasteWorkout,
} from "@/lib/training/parse-pasted-workout";
import { dateKeyForWeekDay } from "@/lib/training/plan-week-ingest-guard";

function titleForMileBlock(part: string, workoutType: WorkoutType): string {
  const lower = part.toLowerCase();
  if (/\bwarm/.test(lower)) return "Warm-up";
  if (/\bcool/.test(lower)) return "Cool-down";
  if (/\btempo\b|\bthreshold\b|\bwork\b/.test(lower) || /@\s*\d/.test(part)) {
    return workoutType === "Intervals" ? "Intervals" : "Tempo";
  }
  if (/\binterval/.test(lower)) return "Intervals";
  if (/\beasy\b|\brecovery\b/.test(lower)) return "Easy";
  return workoutType === "Tempo" ? "Tempo" : "Easy";
}

function segmentsFromSemicolonPaceParts(
  paceNote: string,
  workoutType: WorkoutType,
  workoutName: string,
): ParsedPasteWorkout | null {
  const parts = paceNote.split(";").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const segments: ParsedPasteWorkout["segments"] = [];
  for (const part of parts) {
    const mi = part.match(/(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b/i);
    if (!mi) continue;
    const miles = parseFloat(mi[1]!);
    if (!Number.isFinite(miles) || miles <= 0) continue;

    segments.push({
      title: titleForMileBlock(part, workoutType),
      durationType: "DISTANCE",
      durationValue: miles,
      effortContext: part,
    });
  }
  if (segments.length < 2) return null;

  return {
    segments,
    suggestedTitle: workoutName.trim() || `${workoutType} workout`,
    suggestedDescription: paceNote.slice(0, 160),
  };
}

/** "2 miles easy 2 miles tempo 2 miles cool down" without semicolons. */
function segmentsFromSpaceSeparatedMileBlocks(
  paceNote: string,
  workoutType: WorkoutType,
  workoutName: string,
): ParsedPasteWorkout | null {
  const chunks = paceNote
    .split(/\s+(?=\d+(?:\.\d+)?\s*(?:mi|mile|miles)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (chunks.length < 2) return null;

  const segments: ParsedPasteWorkout["segments"] = [];
  for (const part of chunks) {
    const mi = part.match(/^(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b/i);
    if (!mi) continue;
    const miles = parseFloat(mi[1]!);
    if (!Number.isFinite(miles) || miles <= 0) continue;
    segments.push({
      title: titleForMileBlock(part, workoutType),
      durationType: "DISTANCE",
      durationValue: miles,
      effortContext: part,
    });
  }
  if (segments.length < 2) return null;
  return {
    segments,
    suggestedTitle: workoutName.trim() || `${workoutType} workout`,
    suggestedDescription: paceNote.slice(0, 160),
  };
}

function looksLikeStructuredPaceNote(pace: string): boolean {
  return pace.includes(";") || /\d+(?:\.\d+)?\s*(?:mi|mile|miles)\b/i.test(pace);
}

/**
 * Parse CSV pace note into workout steps, or null when catalogue matching should apply.
 */
export function segmentsFromWeekCsvPaceNote(params: {
  paceNote: string;
  workoutType: WorkoutType;
  miles: number;
  workoutName?: string;
  fiveKPace: string | null | undefined;
}): WorkoutStep[] | null {
  const pace = params.paceNote.trim();
  if (!pace) return null;

  const name = params.workoutName?.trim() ?? "";
  const hint = params.workoutType;

  if (looksLikeStructuredPaceNote(pace)) {
    const fromParts =
      segmentsFromSemicolonPaceParts(pace, params.workoutType, name) ??
      segmentsFromSpaceSeparatedMileBlocks(pace, params.workoutType, name);
    if (fromParts) {
      return parsedPasteToAiGenerateResponse(fromParts, params.fiveKPace).segments;
    }
  }

  const fromPaste = tryParsePastedWorkoutText(pace, hint);
  if (fromPaste) {
    return parsedPasteToAiGenerateResponse(fromPaste, params.fiveKPace).segments;
  }

  const singlePace = /^\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?\s*\/\s*mi/i.test(pace);
  if (singlePace && params.miles > 0) {
    const synthetic: ParsedPasteWorkout = {
      segments: [
        {
          title: hint === "Tempo" ? "Tempo" : hint === "Intervals" ? "Intervals" : "Easy",
          durationType: "DISTANCE",
          durationValue: params.miles,
          effortContext: pace,
        },
      ],
      suggestedTitle: name || "Run",
      suggestedDescription: pace,
    };
    return parsedPasteToAiGenerateResponse(synthetic, params.fiveKPace).segments;
  }

  return null;
}

export function buildDaySegmentsByDateKeyFromWeekMeta(params: {
  metaByDateKey: Record<string, { workoutName?: string; paceNote?: string }>;
  week: { days: { dow: number; workoutType: WorkoutType; miles: number }[] };
  planStartDate: Date;
  weekNumber: number;
  fiveKPace: string | null | undefined;
}): Record<string, WorkoutStep[]> {
  const out: Record<string, WorkoutStep[]> = {};
  for (const day of params.week.days) {
    const dateKey = dateKeyForWeekDay(params.planStartDate, params.weekNumber, day.dow);
    const meta = params.metaByDateKey[dateKey];
    if (!meta?.paceNote?.trim()) continue;
    const steps = segmentsFromWeekCsvPaceNote({
      paceNote: meta.paceNote,
      workoutType: day.workoutType,
      miles: day.miles,
      workoutName: meta.workoutName,
      fiveKPace: params.fiveKPace,
    });
    if (steps?.length) out[dateKey] = steps;
  }
  return out;
}
