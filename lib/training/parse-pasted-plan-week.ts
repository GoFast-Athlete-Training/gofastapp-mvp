/**
 * Deterministic parse for "this week" plan paste before OpenAI fallback.
 * Examples:
 *   Mon easy 5
 *   Tuesday: tempo 6 mi
 *   Wed off
 */

import type { WorkoutType } from "@prisma/client";
import type { PlanDaySchedule, PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import { dayNameToOurDow } from "@/lib/training/schedule-parser";

const DAY_PREFIX =
  /^(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b[:\s-]*/i;

const TYPE_ALIASES: Record<string, WorkoutType> = {
  easy: "Easy",
  e: "Easy",
  recovery: "Easy",
  tempo: "Tempo",
  threshold: "Tempo",
  t: "Tempo",
  interval: "Intervals",
  intervals: "Intervals",
  speed: "Intervals",
  i: "Intervals",
  long: "LongRun",
  longrun: "LongRun",
  lr: "LongRun",
  race: "Race",
};

function normalizeDayToken(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("mon")) return "Monday";
  if (s.startsWith("tue")) return "Tuesday";
  if (s.startsWith("wed")) return "Wednesday";
  if (s.startsWith("thu")) return "Thursday";
  if (s.startsWith("fri")) return "Friday";
  if (s.startsWith("sat")) return "Saturday";
  if (s.startsWith("sun")) return "Sunday";
  return raw.trim();
}

function parseWorkoutTypeAndMiles(rest: string): { workoutType: WorkoutType; miles: number } | null {
  const line = rest.trim().replace(/\s+/g, " ");
  if (!line) return null;
  if (/^(off|rest|x|—|-)$/i.test(line)) return null;

  const milesMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:mi(?:les?)?|m\b)?/i);
  const miles = milesMatch ? parseFloat(milesMatch[1]!) : NaN;

  let workoutType: WorkoutType = "Easy";
  for (const [key, wt] of Object.entries(TYPE_ALIASES)) {
    const re = new RegExp(`\\b${key}\\b`, "i");
    if (re.test(line)) {
      workoutType = wt;
      break;
    }
  }

  if (!Number.isFinite(miles) || miles <= 0) {
    if (workoutType === "LongRun") return { workoutType, miles: 10 };
    if (workoutType === "Tempo" || workoutType === "Intervals") return { workoutType, miles: 5 };
    return { workoutType, miles: 4 };
  }
  return { workoutType, miles: Math.round(miles * 100) / 100 };
}

function parseOneLine(line: string): PlanDaySchedule | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const dayMatch = trimmed.match(DAY_PREFIX);
  if (!dayMatch) return null;

  const dayName = normalizeDayToken(dayMatch[1]!);
  let dow: number;
  try {
    dow = dayNameToOurDow(dayName);
  } catch {
    return null;
  }

  const rest = trimmed.slice(dayMatch[0].length);
  const parsed = parseWorkoutTypeAndMiles(rest);
  if (!parsed) return null;

  return {
    dow,
    workoutType: parsed.workoutType,
    miles: parsed.miles,
    catalogueWorkoutId: null,
    planCycleIndex: null,
  };
}

export function tryParsePastedWeekScheduleText(
  sourceText: string,
  weekNumber: number
): PlanWeekSchedule | null {
  const lines = sourceText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const days: PlanDaySchedule[] = [];
  for (const line of lines) {
    const day = parseOneLine(line);
    if (day) days.push(day);
  }

  if (days.length === 0) return null;

  days.sort((a, b) => a.dow - b.dow);
  return { weekNumber, days };
}

/** Multi-week paste: lines starting with "Week N" or "Wk N" group following day lines. */
export function tryParsePastedFullPlanText(sourceText: string): PlanWeekSchedule[] | null {
  const lines = sourceText.split(/\r?\n/);
  const weeks: PlanWeekSchedule[] = [];
  let currentWeek: number | null = null;
  let buffer: string[] = [];

  function flush() {
    if (currentWeek == null || buffer.length === 0) return;
    const week = tryParsePastedWeekScheduleText(buffer.join("\n"), currentWeek);
    if (week) weeks.push(week);
    buffer = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    const weekHeader = line.match(/^(?:week|wk)\s*(\d+)\b/i);
    if (weekHeader) {
      flush();
      currentWeek = parseInt(weekHeader[1]!, 10);
      continue;
    }
    if (line) buffer.push(line);
  }
  flush();

  if (weeks.length > 0) return weeks.sort((a, b) => a.weekNumber - b.weekNumber);

  /** Single block without headers → treat as week 1 only if enough day lines */
  const single = tryParsePastedWeekScheduleText(sourceText, 1);
  return single ? [single] : null;
}
