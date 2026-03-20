/**
 * Parse compact schedule strings from planWeeks, e.g. "M:5E W:6T Th:5E Sa:5E Su:14L"
 * Day abbrev: M, Tu, W, Th, F, Sa, Su
 * Type: E Easy, T Tempo, I Intervals, L LongRun
 */

import type { WorkoutType } from "@prisma/client";

export type ScheduleToken = {
  dayAbbr: string;
  miles: number;
  typeLetter: string;
  workoutType: WorkoutType;
};

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

function letterToWorkoutType(letter: string): WorkoutType {
  const u = letter.toUpperCase();
  switch (u) {
    case "E":
      return "Easy";
    case "T":
      return "Tempo";
    case "I":
      return "Intervals";
    case "L":
      return "LongRun";
    default:
      throw new Error(`Unknown workout type letter: ${letter} (use E,T,I,L)`);
  }
}

/**
 * Split schedule on spaces; each token must be like M:5E or Th:6.5T
 */
export function parseScheduleString(schedule: string): ScheduleToken[] {
  const trimmed = schedule.trim();
  if (!trimmed) return [];

  const tokens: ScheduleToken[] = [];
  const parts = trimmed.split(/\s+/);

  for (const part of parts) {
    const match = part.match(
      /^(M|Tu|W|Th|F|Sa|Su):(\d+(?:\.\d+)?)([ETILetil])$/i
    );
    if (!match) {
      throw new Error(`Invalid schedule token: "${part}" (expected e.g. M:5E)`);
    }
    const [, dayAbbr, milesStr, typeLetter] = match;
    tokens.push({
      dayAbbr,
      miles: parseFloat(milesStr),
      typeLetter: typeLetter.toUpperCase(),
      workoutType: letterToWorkoutType(typeLetter),
    });
  }

  return tokens;
}

/** JS getDay(): 0=Sun..6=Sat → our 1=Mon..7=Sun */
export function ourDowToJs(our: number): number {
  return our === 7 ? 0 : our;
}

function utcDateOnly(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addDaysUtc(d: Date, days: number): Date {
  const x = utcDateOnly(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

/**
 * Week N anchor: planStart + (weekNumber - 1) * 7 days (UTC date).
 * Find the calendar date in [anchor, anchor+6] matching ourDow (1=Mon..7=Sun).
 */
export function dateForDayInWeek(
  planStartDate: Date,
  weekNumber: number,
  ourDow: number
): Date {
  const anchor = addDaysUtc(planStartDate, (weekNumber - 1) * 7);
  const targetJs = ourDowToJs(ourDow);
  for (let d = 0; d < 7; d++) {
    const candidate = addDaysUtc(anchor, d);
    if (candidate.getUTCDay() === targetJs) {
      return candidate;
    }
  }
  throw new Error(`Could not place day ${ourDow} in week ${weekNumber}`);
}
