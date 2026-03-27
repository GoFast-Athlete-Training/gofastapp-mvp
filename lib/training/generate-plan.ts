/**
 * Deterministic marathon-style plan: long-run anchor, calendar weeks-to-race for volume
 * (late joiners get taper-shaped load), easy mileage trimmed first when squeezing the week.
 */

import type { WorkoutType } from "@prisma/client";
import {
  dateForDayInWeek,
  dayNameToAbbr,
  formatMilesForScheduleToken,
  workoutTypeToScheduleSuffix,
} from "@/lib/training/schedule-parser";
import {
  calendarTrainingWeekCount,
  mondayUtcOfWeekContaining,
} from "@/lib/training/plan-utils";
import { formatPlannedWorkoutTitle } from "@/lib/training/workout-display-title";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MIN_TEMPO_MI = 3;
const MIN_INTERVAL_MI = 3;
const MIN_LONG_MI = 8;
const MIN_EASY_PER_DAY_MI = 3;
const MIN_EASY_WEEK_MI = 4;

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
  weeklyMileageTarget: number,
  minWeeklyMiles: number = 40
): number {
  let total = longRun * 2.5;
  if (nOffset >= -3) total *= 0.75;
  const rounded = Math.round(total);
  const floor = Math.max(25, minWeeklyMiles);
  const cap = Math.max(floor, Math.min(100, weeklyMileageTarget));
  return Math.max(floor, Math.min(cap, rounded));
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

export function nOffsetFromWeekAnchor(weekAnchor: Date, raceUtc: Date): number {
  const dayDiff = Math.floor(
    (utcDateOnly(raceUtc).getTime() - utcDateOnly(weekAnchor).getTime()) / 86400000
  );
  if (dayDiff < 0) return 0;
  if (dayDiff <= 6) return 0;
  return -Math.ceil(dayDiff / 7);
}


/** Phase key (e.g. base, build) for a calendar week — matches deterministic generator. */
export function cataloguePhaseFallbackForWeek(
  planStartRaw: Date | string,
  raceRaw: Date | string,
  weekNumber: number
): string {
  const planStart = utcDateOnly(
    typeof planStartRaw === "string" ? new Date(planStartRaw) : planStartRaw
  );
  const raceUtc = utcDateOnly(typeof raceRaw === "string" ? new Date(raceRaw) : raceRaw);
  const firstMonday = mondayUtcOfWeekContaining(planStart);
  const weekAnchor = addDaysUtc(firstMonday, (weekNumber - 1) * 7);
  const nOffset = nOffsetFromWeekAnchor(weekAnchor, raceUtc);
  return phaseForCatalogue(nOffset);
}

function compressQualityToCap(
  weeklyCap: number,
  longMi: number,
  tempoMi: number,
  intervalMi: number
): { longMi: number; tempoMi: number; intervalMi: number } {
  let L = longMi;
  let T = tempoMi;
  let I = intervalMi;
  let over = L + T + I - weeklyCap;
  while (over > 0.05) {
    let progressed = false;
    if (I > MIN_INTERVAL_MI) {
      const d = Math.min(I - MIN_INTERVAL_MI, over);
      I -= d;
      over -= d;
      progressed = true;
    }
    if (over <= 0) break;
    if (T > MIN_TEMPO_MI) {
      const d = Math.min(T - MIN_TEMPO_MI, over);
      T -= d;
      over -= d;
      progressed = true;
    }
    if (over <= 0) break;
    if (L > MIN_LONG_MI) {
      const d = Math.min(L - MIN_LONG_MI, over);
      L -= d;
      over -= d;
      progressed = true;
    }
    if (!progressed) break;
  }
  return { longMi: L, tempoMi: T, intervalMi: I };
}

function fundEasyMiles(
  weeklyCap: number,
  longMi: number,
  tempoMi: number,
  intervalMi: number,
  longCapFromWeekly: number
): { longMi: number; tempoMi: number; intervalMi: number; easyMi: number } {
  let L = Math.min(longMi, longCapFromWeekly);
  let T = tempoMi;
  let I = intervalMi;
  let easyMi = weeklyCap - L - T - I;

  if (easyMi >= MIN_EASY_WEEK_MI) {
    return { longMi: L, tempoMi: T, intervalMi: I, easyMi };
  }

  const need = MIN_EASY_WEEK_MI - easyMi;
  if (need > 0 && L - MIN_LONG_MI > 0) {
    const take = Math.min(need, L - MIN_LONG_MI);
    L -= take;
    easyMi += take;
  }

  easyMi = weeklyCap - L - T - I;
  if (easyMi >= MIN_EASY_WEEK_MI) {
    return { longMi: L, tempoMi: T, intervalMi: I, easyMi };
  }

  const need2 = MIN_EASY_WEEK_MI - easyMi;
  if (need2 > 0) {
    if (I - MIN_INTERVAL_MI > 0) {
      const take = Math.min(need2, I - MIN_INTERVAL_MI);
      I -= take;
      easyMi += take;
    }
    easyMi = weeklyCap - L - T - I;
  }
  if (easyMi >= MIN_EASY_WEEK_MI) {
    return { longMi: L, tempoMi: T, intervalMi: I, easyMi };
  }

  const need3 = MIN_EASY_WEEK_MI - easyMi;
  if (need3 > 0 && T - MIN_TEMPO_MI > 0) {
    const take = Math.min(need3, T - MIN_TEMPO_MI);
    T -= take;
    easyMi += take;
  }

  easyMi = Math.max(0, weeklyCap - L - T - I);
  const packed = compressQualityToCap(weeklyCap, L, T, I);
  easyMi = Math.max(
    0,
    weeklyCap - packed.longMi - packed.tempoMi - packed.intervalMi
  );
  return {
    longMi: packed.longMi,
    tempoMi: packed.tempoMi,
    intervalMi: packed.intervalMi,
    easyMi,
  };
}

export interface GeneratePlanInput {
  planId: string;
  athleteId: string;
  totalWeeks: number;
  planStartDate: Date;
  raceDate: Date;
  weeklyMileageTarget: number;
  minWeeklyMiles?: number;
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function trimEasyAssignmentsToWeeklyTotal(params: {
  assignment: Map<
    number,
    { kind: "tempo" | "interval" | "long" | "easy"; miles: number }
  >;
  weeklyCap: number;
}): void {
  const { assignment, weeklyCap } = params;
  const sumAssigned = (): number => {
    let s = 0;
    for (const v of assignment.values()) s += v.miles;
    return Math.round(s * 100) / 100;
  };
  let over = sumAssigned() - weeklyCap;
  if (over <= 0.05) return;

  const easyEntries = [...assignment.entries()].filter(
    ([, v]) => v.kind === "easy" && v.miles > MIN_EASY_PER_DAY_MI
  );
  easyEntries.sort((a, b) => b[1].miles - a[1].miles);

  for (const [dow, v] of easyEntries) {
    if (over <= 0.05) break;
    const room = v.miles - MIN_EASY_PER_DAY_MI;
    if (room <= 0) continue;
    const shave = Math.min(room, over);
    assignment.set(dow, { kind: "easy", miles: round2(v.miles - shave) });
    over -= shave;
  }

  if (over <= 0.05) return;

  const order: Array<"interval" | "tempo" | "long"> = [
    "interval",
    "tempo",
    "long",
  ];
  for (const kind of order) {
    if (over <= 0.05) break;
    for (const [dow, v] of [...assignment.entries()]) {
      if (over <= 0.05) break;
      if (v.kind !== kind) continue;
      const minM =
        kind === "interval"
          ? MIN_INTERVAL_MI
          : kind === "tempo"
            ? MIN_TEMPO_MI
            : MIN_LONG_MI;
      const room = v.miles - minM;
      if (room <= 0) continue;
      const shave = Math.min(room, over);
      assignment.set(dow, { kind: v.kind, miles: round2(v.miles - shave) });
      over -= shave;
    }
  }
}

export function generatePlanWorkoutRows(input: GeneratePlanInput): GeneratedPlanWorkoutRow[] {
  const minWeekly = input.minWeeklyMiles ?? 40;
  const preferred =
    input.preferredDays.length > 0
      ? [...input.preferredDays].sort((a, b) => a - b)
      : [1, 2, 3, 4, 5, 6];

  const raceUtc = utcDateOnly(input.raceDate);
  const planStart = utcDateOnly(input.planStartDate);
  const raceOurDow = ourDowFromUtcDate(raceUtc);
  const q = qualityDayOurDows(raceOurDow);

  const out: GeneratedPlanWorkoutRow[] = [];

  if (planStart.getTime() > raceUtc.getTime()) {
    return out;
  }

  const firstMonday = mondayUtcOfWeekContaining(planStart);
  const weekCount = calendarTrainingWeekCount(planStart, raceUtc);

  let weekNumber = 0;
  for (;;) {
    weekNumber += 1;
    if (weekNumber > weekCount) break;

    const weekAnchor = addDaysUtc(firstMonday, (weekNumber - 1) * 7);

    const weekEnd = addDaysUtc(weekAnchor, 6);
    const nOffset = nOffsetFromWeekAnchor(weekAnchor, raceUtc);
    const phase = phaseForCatalogue(nOffset);

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
          title: formatPlannedWorkoutTitle("LongRun", milesToMeters(input.raceDistanceMiles), {
            isRace: true,
            raceName: input.raceName,
          }),
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
    let weeklyMi = weeklyTotalMiles(
      longMi,
      nOffset,
      input.weeklyMileageTarget,
      minWeekly
    );
    const longCap = Math.floor(weeklyMi * 0.4 * 10) / 10;
    longMi = Math.min(longMi, longCap);

    let tempoMi = 5;
    let intervalMi = 5;
    let packed = compressQualityToCap(weeklyMi, longMi, tempoMi, intervalMi);
    longMi = packed.longMi;
    tempoMi = packed.tempoMi;
    intervalMi = packed.intervalMi;

    const funded = fundEasyMiles(
      weeklyMi,
      longMi,
      tempoMi,
      intervalMi,
      longCap
    );
    longMi = funded.longMi;
    tempoMi = funded.tempoMi;
    intervalMi = funded.intervalMi;
    const easyMi = funded.easyMi;

    type DayKind = "tempo" | "interval" | "long" | "easy";
    const assignment = new Map<number, { kind: DayKind; miles: number }>();

    const dayInPlanWindow = (ourDowArg: number): boolean => {
      const dt = dateForDayInWeek(input.planStartDate, weekNumber, ourDowArg);
      if (dt.getTime() < planStart.getTime()) return false;
      if (nOffset !== 0 && dt.getTime() > raceUtc.getTime()) return false;
      return true;
    };

    const tryPlace = (ourDow: number, kind: DayKind, miles: number) => {
      if (miles <= 0) return;
      if (blockedOurDow.has(ourDow)) return;
      if (assignment.has(ourDow)) return;
      const slotDate = dateForDayInWeek(input.planStartDate, weekNumber, ourDow);
      if (slotDate.getTime() < planStart.getTime()) return;
      if (nOffset !== 0 && slotDate.getTime() > raceUtc.getTime()) return;
      assignment.set(ourDow, { kind, miles: round2(miles) });
    };

    tryPlace(q.tempoOurDow, "tempo", tempoMi);
    tryPlace(q.intervalOurDow, "interval", intervalMi);

    const skipLongOnLongRunDay = nOffset === -1;
    const longDayTarget = skipLongOnLongRunDay ? null : q.longRunOurDow;
    if (longDayTarget != null && longMi > 0) {
      tryPlace(longDayTarget, "long", longMi);
    }

    let absorbLongIntoEasy = 0;
    if (skipLongOnLongRunDay && longMi > 0) {
      const candidates = preferred.filter(
        (d) =>
          !blockedOurDow.has(d) &&
          !assignment.has(d) &&
          d !== q.tempoOurDow &&
          d !== q.intervalOurDow &&
          dayInPlanWindow(d)
      );
      const fallback = candidates[0];
      if (fallback != null) {
        assignment.set(fallback, { kind: "long", miles: round2(longMi) });
      } else {
        absorbLongIntoEasy = longMi;
      }
    }

    const usedForQuality = new Set(assignment.keys());
    const easyCandidates = preferred.filter(
      (d) =>
        !blockedOurDow.has(d) &&
        !usedForQuality.has(d) &&
        dayInPlanWindow(d)
    );
    const easyDays =
      easyCandidates.length > 0
        ? easyCandidates
        : [1, 2, 3, 4, 5, 6, 7].filter(
            (d) =>
              !blockedOurDow.has(d) &&
              !usedForQuality.has(d) &&
              dayInPlanWindow(d)
          );

    let easyBudget = easyMi + absorbLongIntoEasy;

    if (easyBudget > 0 && easyDays.length > 0) {
      const base = Math.floor((easyBudget / easyDays.length) * 10) / 10;
      for (let i = 0; i < easyDays.length; i++) {
        let m =
          i === easyDays.length - 1
            ? round2(easyBudget - base * (easyDays.length - 1))
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
      const miss = easyBudget - sumEasy;
      if (Math.abs(miss) > 0.15 && lastEasy != null) {
        const cur = assignment.get(lastEasy);
        if (cur?.kind === "easy") {
          assignment.set(lastEasy, {
            kind: "easy",
            miles: Math.max(MIN_EASY_PER_DAY_MI, round2(cur.miles + miss)),
          });
        }
      }
    }

    trimEasyAssignmentsToWeeklyTotal({ assignment, weeklyCap: weeklyMi });

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
      out.push({
        title: formatPlannedWorkoutTitle(workoutType, milesToMeters(miles)),
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

export type PlanWeekSlot = { weekNumber: number; schedule: string };

/**
 * Freeze-frame snapshot aligned to week 1..N (Mon–Sun from plan start math in generator).
 * Emitted from the same draft rows as bulk insert so strings cannot drift from assigned loads.
 */
export function planWeeksSnapshotFromGeneratedRows(
  rows: GeneratedPlanWorkoutRow[],
  totalWeeks: number
): PlanWeekSlot[] {
  const byWeek = new Map<number, GeneratedPlanWorkoutRow[]>();
  for (const r of rows) {
    const list = byWeek.get(r.weekNumber) ?? [];
    list.push(r);
    byWeek.set(r.weekNumber, list);
  }
  const out: PlanWeekSlot[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const list = byWeek.get(w) ?? [];
    list.sort(
      (a, b) =>
        DAY_NAMES.indexOf(a.dayAssigned as (typeof DAY_NAMES)[number]) -
        DAY_NAMES.indexOf(b.dayAssigned as (typeof DAY_NAMES)[number])
    );
    const parts = list.map((r) => {
      const abbr = dayNameToAbbr(r.dayAssigned);
      const mi = r.estimatedDistanceInMeters / 1609.34;
      const milesStr = formatMilesForScheduleToken(mi);
      const suf = workoutTypeToScheduleSuffix(r.workoutType);
      return `${abbr}:${milesStr}${suf}`;
    });
    out.push({ weekNumber: w, schedule: parts.join(" ") });
  }
  return out;
}
