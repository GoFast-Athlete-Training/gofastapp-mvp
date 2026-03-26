/**
 * Deterministic marathon-style plan: nOffset-based volume, quality-day geometry from race day.
 */

import type { WorkoutType } from "@prisma/client";
import { dateForDayInWeek } from "@/lib/training/schedule-parser";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const ANCHORS: Record<number, number> = {
  0: 0,
  [-1]: 9,
  [-2]: 13,
  [-3]: 15,
  [-4]: 21,
  [-5]: 21,
};

export function phaseForCatalogue(nOffset: number): string {
  if (nOffset >= -3) return "taper";
  if (nOffset >= -7) return "peak";
  if (nOffset >= -14) return "build";
  return "base";
}

export function longRunMilesForOffset(nOffset: number): number {
  if (Object.prototype.hasOwnProperty.call(ANCHORS, nOffset)) {
    return ANCHORS[nOffset];
  }
  let miles = 21 - (Math.abs(nOffset) - 5) * 2;
  if (Math.abs(nOffset) % 3 === 0) miles -= 2;
  return Math.max(8, Math.min(22, miles));
}

export function weeklyTotalMiles(
  longRun: number,
  nOffset: number,
  weeklyMileageTarget: number
): number {
  let total = longRun * 2.5;
  if (nOffset >= -3) total *= 0.75;
  const rounded = Math.round(total);
  const cap = Math.max(30, Math.min(80, weeklyMileageTarget));
  return Math.max(30, Math.min(cap, rounded));
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

export function ourDowFromUtcDate(d: Date): number {
  const js = utcDateOnly(d).getUTCDay();
  return js === 0 ? 7 : js;
}

function milesToMeters(miles: number): number {
  return miles * 1609.34;
}

function qualityDayOurDows(raceOurDow: number): {
  longRunOurDow: number;
  intervalOurDow: number;
  tempoOurDow: number;
} {
  const raceIndex = raceOurDow - 1;
  const longRunDayIndex = (raceIndex - 1 + 7) % 7;
  const intervalDayIndex = (longRunDayIndex - 3 + 7) % 7;
  const tempoDayIndex = (intervalDayIndex + 2) % 7;
  return {
    longRunOurDow: longRunDayIndex + 1,
    intervalOurDow: intervalDayIndex + 1,
    tempoOurDow: tempoDayIndex + 1,
  };
}

export interface GeneratePlanInput {
  planId: string;
  athleteId: string;
  totalWeeks: number;
  planStartDate: Date;
  raceDate: Date;
  weeklyMileageTarget: number;
  preferredDays: number[];
  raceName: string;
  raceDistanceMiles: number;
}

export interface GeneratedPlanWorkoutRow {
  title: string;
  workoutType: WorkoutType;
  athleteId: string;
  planId: string;
  date: Date;
  phase: string | null;
  estimatedDistanceInMeters: number;
  nOffset: number;
  weekNumber: number;
  dayAssigned: string;
  catalogueWorkoutId: null;
}

/**
 * One row per scheduled training day (excludes rest days). Race week is the race only.
 */
export function generatePlanWorkoutRows(input: GeneratePlanInput): GeneratedPlanWorkoutRow[] {
  const preferred =
    input.preferredDays.length > 0
      ? [...input.preferredDays].sort((a, b) => a - b)
      : [1, 2, 3, 4, 5, 6];

  const raceUtc = utcDateOnly(input.raceDate);
  const raceOurDow = ourDowFromUtcDate(raceUtc);
  const q = qualityDayOurDows(raceOurDow);

  const out: GeneratedPlanWorkoutRow[] = [];

  for (let weekNumber = 1; weekNumber <= input.totalWeeks; weekNumber++) {
    const nOffset = weekNumber - input.totalWeeks;
    const phase = phaseForCatalogue(nOffset);
    const weekAnchor = addDaysUtc(input.planStartDate, (weekNumber - 1) * 7);
    const weekEnd = addDaysUtc(weekAnchor, 6);

    const blockedOurDow = new Set<number>();
    const dayBeforeRace = addDaysUtc(raceUtc, -1);
    if (
      dayBeforeRace.getTime() >= weekAnchor.getTime() &&
      dayBeforeRace.getTime() <= weekEnd.getTime()
    ) {
      blockedOurDow.add(ourDowFromUtcDate(dayBeforeRace));
    }

    if (nOffset === 0) {
      if (
        raceUtc.getTime() >= weekAnchor.getTime() &&
        raceUtc.getTime() <= weekEnd.getTime()
      ) {
        const date = dateForDayInWeek(input.planStartDate, weekNumber, raceOurDow);
        out.push({
          title: `Race — ${input.raceName}`,
          workoutType: "LongRun",
          athleteId: input.athleteId,
          planId: input.planId,
          date,
          phase,
          estimatedDistanceInMeters: milesToMeters(input.raceDistanceMiles),
          nOffset,
          weekNumber,
          dayAssigned: DAY_NAMES[raceOurDow - 1],
          catalogueWorkoutId: null,
        });
      }
      continue;
    }

    let longMi = longRunMilesForOffset(nOffset);
    let weeklyMi = weeklyTotalMiles(longMi, nOffset, input.weeklyMileageTarget);
    longMi = Math.min(longMi, Math.floor(weeklyMi * 0.4 * 10) / 10);

    let tempoMi = 5;
    let intervalMi = 5;
    let easyMi = Math.max(0, weeklyMi - longMi - tempoMi - intervalMi);

    if (easyMi < 4) {
      const deficit = 4 - easyMi;
      const take = Math.min(deficit, tempoMi + intervalMi);
      const fromT = Math.min(tempoMi, Math.floor(take / 2));
      tempoMi -= fromT;
      intervalMi -= take - fromT;
      easyMi = weeklyMi - longMi - tempoMi - intervalMi;
    }
    easyMi = Math.max(0, easyMi);

    type DayKind = "tempo" | "interval" | "long" | "easy";
    const assignment = new Map<number, { kind: DayKind; miles: number }>();

    const tryPlace = (ourDow: number, kind: DayKind, miles: number) => {
      if (miles <= 0) return;
      if (blockedOurDow.has(ourDow)) return;
      if (assignment.has(ourDow)) return;
      assignment.set(ourDow, { kind, miles });
    };

    tryPlace(q.tempoOurDow, "tempo", tempoMi);
    tryPlace(q.intervalOurDow, "interval", intervalMi);

    const skipLongOnLongRunDay = nOffset === -1;
    const longDayTarget = skipLongOnLongRunDay ? null : q.longRunOurDow;
    if (longDayTarget != null && longMi > 0) {
      tryPlace(longDayTarget, "long", longMi);
    }

    if (skipLongOnLongRunDay && longMi > 0) {
      const candidates = preferred.filter(
        (d) =>
          !blockedOurDow.has(d) &&
          !assignment.has(d) &&
          d !== q.tempoOurDow &&
          d !== q.intervalOurDow
      );
      const fallback = candidates[0];
      if (fallback != null) {
        assignment.set(fallback, { kind: "long", miles: longMi });
      } else {
        easyMi += longMi;
        longMi = 0;
      }
    }

    const usedForQuality = new Set(assignment.keys());
    const easyCandidates = preferred.filter(
      (d) => !blockedOurDow.has(d) && !usedForQuality.has(d)
    );
    const easyDays =
      easyCandidates.length > 0
        ? easyCandidates
        : [1, 2, 3, 4, 5, 6, 7].filter(
            (d) => !blockedOurDow.has(d) && !usedForQuality.has(d)
          );

    if (easyMi > 0 && easyDays.length > 0) {
      const base = Math.floor((easyMi / easyDays.length) * 10) / 10;
      for (let i = 0; i < easyDays.length; i++) {
        let m =
          i === easyDays.length - 1
            ? Math.round((easyMi - base * (easyDays.length - 1)) * 10) / 10
            : base;
        if (m < 0.25) continue;
        const d = easyDays[i];
        if (assignment.has(d)) continue;
        assignment.set(d, { kind: "easy", miles: m });
      }
      const lastEasy = easyDays[easyDays.length - 1];
      const sumEasy = easyDays.reduce((s, d) => {
        const a = assignment.get(d);
        return s + (a?.kind === "easy" ? a.miles : 0);
      }, 0);
      const miss = easyMi - sumEasy;
      if (Math.abs(miss) > 0.15 && lastEasy != null) {
        const cur = assignment.get(lastEasy);
        if (cur?.kind === "easy") {
          assignment.set(lastEasy, {
            kind: "easy",
            miles: Math.max(0.25, cur.miles + miss),
          });
        }
      }
    }

    for (const [ourDow, { kind, miles }] of assignment) {
      if (miles < 0.25) continue;
      const workoutType: WorkoutType =
        kind === "tempo"
          ? "Tempo"
          : kind === "interval"
            ? "Intervals"
            : kind === "long"
              ? "LongRun"
              : "Easy";
      const date = dateForDayInWeek(input.planStartDate, weekNumber, ourDow);
      const label =
        kind === "long"
          ? "Long run"
          : kind === "tempo"
            ? "Tempo"
            : kind === "interval"
              ? "Intervals"
              : "Easy";
      out.push({
        title: `${label} — Week ${weekNumber}`,
        workoutType,
        athleteId: input.athleteId,
        planId: input.planId,
        date,
        phase,
        estimatedDistanceInMeters: milesToMeters(miles),
        nOffset,
        weekNumber,
        dayAssigned: DAY_NAMES[ourDow - 1],
        catalogueWorkoutId: null,
      });
    }
  }

  return out;
}
