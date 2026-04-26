/**
 * Parse / build compact schedule strings on planWeeks, e.g. "M:5E W:6T Su:14LR"
 * Day abbrev: M, Tu, W, Th, F, Sa, Su
 * Type suffix: E Easy, T Tempo, I Intervals, L or LR LongRun (canonical write uses LR)
 * Optional cycle marker for I/T: "-i0" .. "-i3" (plan-frozen 0–3 slot), e.g. "W:5I-i2"
 */

import type { WorkoutType } from "@prisma/client";
import { addDaysUtc, mondayUtcOfWeekContaining, utcDateOnly } from "@/lib/training/plan-utils";

export type ScheduleToken = {
  dayAbbr: string;
  miles: number;
  /** Single-letter style key for display (L for long run even when token was LR) */
  typeLetter: string;
  workoutType: WorkoutType;
  /** Present for Intervals/Tempo when token includes -iN; legacy strings omit → treat as 0 */
  cycleIndex?: number;
};

const DAY_NAME_TO_ABBR: Record<string, string> = {
  Monday: "M",
  Tuesday: "Tu",
  Wednesday: "W",
  Thursday: "Th",
  Friday: "F",
  Saturday: "Sa",
  Sunday: "Su",
};

const ABBR_TO_DAY_NAME: Record<string, string> = {
  M: "Monday",
  Tu: "Tuesday",
  W: "Wednesday",
  Th: "Thursday",
  F: "Friday",
  Sa: "Saturday",
  Su: "Sunday",
};

export function dayNameToAbbr(dayName: string): string {
  const a = DAY_NAME_TO_ABBR[dayName];
  if (!a) throw new Error(`Unknown weekday name for schedule: ${dayName}`);
  return a;
}

export function dayAbbrToDayName(abbr: string): string {
  const a = abbr.trim();
  const n = ABBR_TO_DAY_NAME[a];
  if (!n) throw new Error(`Unknown day abbreviation: ${abbr}`);
  return n;
}

/** Strip trailing zeros for stable tokens (6.5 not 6.50). */
export function formatMilesForScheduleToken(miles: number): string {
  const r = Math.round(miles * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return String(r);
}

export function workoutTypeToScheduleSuffix(wt: WorkoutType): string {
  switch (wt) {
    case "Easy":
      return "E";
    case "Tempo":
      return "T";
    case "Intervals":
      return "I";
    case "LongRun":
      return "LR";
    case "Race":
      /** Compact schedule strings use LR; race day is distinguished when materializing */
      return "LR";
    default: {
      const _x: never = wt;
      return _x;
    }
  }
}

export function suffixToWorkoutType(suffixRaw: string): WorkoutType {
  const key = suffixRaw.trim().toUpperCase();
  if (key === "E") return "Easy";
  if (key === "T") return "Tempo";
  if (key === "I") return "Intervals";
  if (key === "L" || key === "LR") return "LongRun";
  throw new Error(
    `Unknown workout type suffix "${suffixRaw}" (use E, T, I, L, or LR)`
  );
}

function typeLetterFromWorkoutType(wt: WorkoutType): string {
  if (wt === "LongRun" || wt === "Race") return "L";
  if (wt === "Easy") return "E";
  if (wt === "Tempo") return "T";
  return "I";
}

/** Our convention: 1=Monday .. 7=Sunday */
export function dayAbbrToOurDow(abbr: string): number {
  const a = abbr.trim();
  const map: Record<string, number> = {
    M: 1,
    Tu: 2,
    W: 3,
    Th: 4,
    F: 5,
    Sa: 6,
    Su: 7,
  };
  const n = map[a];
  if (!n) throw new Error(`Unknown day abbreviation: ${abbr}`);
  return n;
}

/** Full weekday name e.g. "Tuesday" → ourDow 1=Monday..7=Sunday */
export function dayNameToOurDow(dayName: string): number {
  return dayAbbrToOurDow(dayNameToAbbr(dayName.trim()));
}

/**
 * Split schedule on spaces; each token is DAY:milesTYPE[-iN] where TYPE is E,T,I,L,LR,...
 */
export function parseScheduleString(schedule: string): ScheduleToken[] {
  const trimmed = schedule.trim();
  if (!trimmed) return [];

  const tokens: ScheduleToken[] = [];
  const parts = trimmed.split(/\s+/);

  for (const part of parts) {
    const match = part.match(
      /^(M|Tu|W|Th|F|Sa|Su):(\d+(?:\.\d+)?)([A-Za-z]+)(?:-i(\d+))?$/i
    );
    if (!match) {
      throw new Error(`Invalid schedule token: "${part}" (expected e.g. M:5E or W:5I-i0)`);
    }
    const [, dayAbbr, milesStr, typeSuffix, cycleStr] = match;
    const workoutType = suffixToWorkoutType(typeSuffix);
    const cycleIndex =
      cycleStr != null && cycleStr !== ""
        ? Math.min(3, Math.max(0, parseInt(cycleStr, 10)))
        : undefined;
    tokens.push({
      dayAbbr,
      miles: parseFloat(milesStr),
      typeLetter: typeLetterFromWorkoutType(workoutType),
      workoutType,
      ...(cycleIndex !== undefined ? { cycleIndex } : {}),
    });
  }

  return tokens;
}

/** Resolve plan-frozen cycle index from a week's schedule string for legacy rows missing planCycleIndex. */
export function cycleIndexFromScheduleForDay(params: {
  schedule: string;
  dayAssigned: string;
  workoutType: WorkoutType;
}): number | null {
  try {
    const abbr = dayNameToAbbr(params.dayAssigned);
    const toks = parseScheduleString(params.schedule);
    const hit = toks.find(
      (t) => t.dayAbbr === abbr && t.workoutType === params.workoutType
    );
    if (!hit) return null;
    return hit.cycleIndex ?? 0;
  } catch {
    return null;
  }
}

/** JS getDay(): 0=Sun..6=Sat → our 1=Mon..7=Sun */
export function ourDowToJs(our: number): number {
  return our === 7 ? 0 : our;
}

/**
 * Calendar week = Mon–Sun (UTC). `weekMondayUtc` is that week's Monday 00:00 UTC.
 */
export function dateOnOurDowFromWeekMonday(
  weekMondayUtc: Date,
  ourDow: number
): Date {
  const anchor = utcDateOnly(weekMondayUtc);
  const targetJs = ourDowToJs(ourDow);
  for (let d = 0; d < 7; d++) {
    const candidate = addDaysUtc(anchor, d);
    if (candidate.getUTCDay() === targetJs) {
      return candidate;
    }
  }
  throw new Error(`Could not place day ${ourDow} in calendar week`);
}

/**
 * Week N = Nth Mon–Sun block starting at the Monday of the week that contains plan start.
 */
export function dateForDayInWeek(
  planStartDate: Date,
  weekNumber: number,
  ourDow: number
): Date {
  const firstMonday = mondayUtcOfWeekContaining(planStartDate);
  const weekMonday = addDaysUtc(firstMonday, (weekNumber - 1) * 7);
  return dateOnOurDowFromWeekMonday(weekMonday, ourDow);
}
