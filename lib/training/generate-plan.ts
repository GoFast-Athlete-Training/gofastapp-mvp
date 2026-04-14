/**
 * Marathon-style week builder. Pipeline per calendar week (Mon-Sun, UTC):
 *
 * 1. Race day - anchor end of plan; race week (`nOffset === 0`) is race-only; day-before-race
 *    is hard-blocked for any workout.
 * 2. Taper - `nOffsetFromWeekAnchor` sets phase and taper-shaped long-run miles + weekly cap
 *    (`longRunMilesForOffset`, `weeklyTotalMiles`, skip LR at `nOffset === -1`).
 * 3. Long run as weekly load - the LR mileage for that week (e.g. 22 mi) is chosen first under
 *    the athlete's desired weekly miles (`weeklyMileageTarget`, `longCap`, `compressQualityToCap`,
 *    `fundEasyMiles`). That LR is a large slice of `weeklyMi`; tempo, interval, and easy split
 *    what remains.
 * 4. Placement - place LR on picker Sat/Sun (preferred-only), then tempo (Tue) and intervals
 *    (Thu) on preferred days with nearest fallback, then easy only on leftover preferred days.
 *
 * Partial week 1: skip tempo/interval; LR only if preferred Sat/Sun fall in-window; easy on prefs.
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
  ymdFromDate,
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

/**
 * Subset of preset volume + workout boltons merged for the generator.
 * Omitted fields fall back to hardcoded defaults when no preset is linked.
 */
export interface PlanGenConfig {
  taperWeeks?: number;
  peakWeeks?: number;
  taperLongRunAnchors?: Record<string, number>;
  peakLongRunMiles?: number;
  cutbackWeekModulo?: number;
  weeklyMileageMultiplier?: number;
  taperMileageReduction?: number;
  longRunCapFraction?: number;
  minWeeklyMiles?: number;
  tempoStartMiles?: number;
  intervalStartMiles?: number;
  minTempoMiles?: number;
  minIntervalMiles?: number;
  minLongMiles?: number;
  minEasyPerDayMiles?: number;
  minEasyWeekMiles?: number;
  tempoIdealDow?: number;
  intervalIdealDow?: number;
  longRunDefaultDow?: number;
}

const DEFAULT_ANCHORS: Record<number, number> = {
  0: 0,
  [-1]: 9,
  [-2]: 13,
  [-3]: 15,
  [-4]: 21,
  [-5]: 21,
};

export function phaseForCatalogue(nOffset: number, cfg?: PlanGenConfig): string {
  const taperWeeks = cfg?.taperWeeks ?? 3;
  const peakWeeks = cfg?.peakWeeks ?? 4;
  if (nOffset >= -taperWeeks) return "taper";
  if (nOffset >= -(taperWeeks + peakWeeks)) return "peak";
  if (nOffset >= -(taperWeeks + peakWeeks + 7)) return "build";
  return "base";
}

export function longRunMilesForOffset(nOffset: number, cfg?: PlanGenConfig): number {
  const taperWeeks = cfg?.taperWeeks ?? 3;
  const anchors = cfg?.taperLongRunAnchors ?? DEFAULT_ANCHORS;
  const peakLongRunMiles = cfg?.peakLongRunMiles ?? 22;
  const cutbackWeekModulo = cfg?.cutbackWeekModulo ?? 3;

  const anchorKey = String(nOffset);
  if (Object.prototype.hasOwnProperty.call(anchors, anchorKey)) {
    return (anchors as Record<string, number>)[anchorKey];
  }
  if (nOffset >= -taperWeeks) {
    return 0;
  }
  const baseOffset = Math.abs(nOffset) - (taperWeeks + 1);
  let miles = peakLongRunMiles - baseOffset * 2;
  if (Math.abs(nOffset) % cutbackWeekModulo === 0) miles -= 2;
  return Math.max(8, Math.min(peakLongRunMiles, miles));
}

export function weeklyTotalMiles(
  longRun: number,
  nOffset: number,
  weeklyMileageTarget: number,
  minWeeklyMiles: number = 40,
  cfg?: PlanGenConfig
): number {
  const multiplier = cfg?.weeklyMileageMultiplier ?? 2.5;
  const taperReduction = cfg?.taperMileageReduction ?? 0.75;
  const taperWeeks = cfg?.taperWeeks ?? 3;
  let total = longRun * multiplier;
  if (nOffset >= -taperWeeks) total *= taperReduction;
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

/** Fallback DOW values used when no config is provided. */
const DEFAULT_TEMPO_IDEAL_OUR_DOW = 2;
const DEFAULT_INTERVAL_IDEAL_OUR_DOW = 4;
const DEFAULT_LONG_RUN_OUR_DOW = 6;

function circularDistOurDow(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 7 - d);
}

function normalizeLongRunOurDow(pref: number | null | undefined, defaultDow: number = DEFAULT_LONG_RUN_OUR_DOW): number {
  if (pref === 6 || pref === 7) return pref;
  return defaultDow === 7 ? 7 : 6;
}

function orderQualityCandidates(
  idealOurDow: number,
  isLongRun: boolean,
  preferredSorted: number[]
): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  if (isLongRun) {
    /* LR only ever lands on Sat/Sun if those are preferred — never Mon–Fri fallback. */
    const other = idealOurDow === 6 ? 7 : 6;
    for (const d of [idealOurDow, other]) {
      if (preferredSorted.includes(d) && !seen.has(d)) {
        out.push(d);
        seen.add(d);
      }
    }
    return out;
  }
  if (preferredSorted.includes(idealOurDow)) {
    out.push(idealOurDow);
    seen.add(idealOurDow);
  }
  const rest = preferredSorted
    .filter((d) => !seen.has(d))
    .sort(
      (a, b) =>
        circularDistOurDow(a, idealOurDow) - circularDistOurDow(b, idealOurDow)
    );
  return out.concat(rest);
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
  intervalMi: number,
  minTempo: number = 3,
  minInterval: number = 3,
  minLong: number = 8
): { longMi: number; tempoMi: number; intervalMi: number } {
  let L = longMi;
  let T = tempoMi;
  let I = intervalMi;
  let over = L + T + I - weeklyCap;
  while (over > 0.05) {
    let progressed = false;
    if (I > minInterval) {
      const d = Math.min(I - minInterval, over);
      I -= d;
      over -= d;
      progressed = true;
    }
    if (over <= 0) break;
    if (T > minTempo) {
      const d = Math.min(T - minTempo, over);
      T -= d;
      over -= d;
      progressed = true;
    }
    if (over <= 0) break;
    if (L > minLong) {
      const d = Math.min(L - minLong, over);
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
  longCapFromWeekly: number,
  minTempo: number = 3,
  minInterval: number = 3,
  minLong: number = 8,
  minEasyPerDay: number = 3,
  minEasyWeek: number = 4
): { longMi: number; tempoMi: number; intervalMi: number; easyMi: number } {
  let L = Math.min(longMi, longCapFromWeekly);
  let T = tempoMi;
  let I = intervalMi;
  let easyMi = weeklyCap - L - T - I;

  if (easyMi >= minEasyWeek) {
    return { longMi: L, tempoMi: T, intervalMi: I, easyMi };
  }

  const need = minEasyWeek - easyMi;
  if (need > 0 && L - minLong > 0) {
    const take = Math.min(need, L - minLong);
    L -= take;
    easyMi += take;
  }

  easyMi = weeklyCap - L - T - I;
  if (easyMi >= minEasyWeek) {
    return { longMi: L, tempoMi: T, intervalMi: I, easyMi };
  }

  const need2 = minEasyWeek - easyMi;
  if (need2 > 0) {
    if (I - minInterval > 0) {
      const take = Math.min(need2, I - minInterval);
      I -= take;
      easyMi += take;
    }
    easyMi = weeklyCap - L - T - I;
  }
  if (easyMi >= minEasyWeek) {
    return { longMi: L, tempoMi: T, intervalMi: I, easyMi };
  }

  const need3 = minEasyWeek - easyMi;
  if (need3 > 0 && T - minTempo > 0) {
    const take = Math.min(need3, T - minTempo);
    T -= take;
    easyMi += take;
  }

  easyMi = Math.max(0, weeklyCap - L - T - I);
  const packed = compressQualityToCap(weeklyCap, L, T, I, minTempo, minInterval, minLong);
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
  /** Preferred long-run day: 6=Sat, 7=Sun (default 6). */
  preferredLongRunDow?: number | null;
  /** Optional persisted config; omit to use hardcoded defaults for backward compatibility. */
  config?: PlanGenConfig;
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
  /** Intervals/Tempo: set in phase B via assignRotationalIdentifiers */
  planLadderIndex: number | null;
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
  minEasyPerDay: number;
  minTempo: number;
  minInterval: number;
  minLong: number;
}): void {
  const { assignment, weeklyCap, minEasyPerDay, minTempo, minInterval, minLong } = params;
  const sumAssigned = (): number => {
    let s = 0;
    for (const v of assignment.values()) s += v.miles;
    return Math.round(s * 100) / 100;
  };
  let over = sumAssigned() - weeklyCap;
  if (over <= 0.05) return;

  const easyEntries = [...assignment.entries()].filter(
    ([, v]) => v.kind === "easy" && v.miles > minEasyPerDay
  );
  easyEntries.sort((a, b) => b[1].miles - a[1].miles);

  for (const [dow, v] of easyEntries) {
    if (over <= 0.05) break;
    const room = v.miles - minEasyPerDay;
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
        kind === "interval" ? minInterval : kind === "tempo" ? minTempo : minLong;
      const room = v.miles - minM;
      if (room <= 0) continue;
      const shave = Math.min(room, over);
      assignment.set(dow, { kind: v.kind, miles: round2(v.miles - shave) });
      over -= shave;
    }
  }
}

export function generatePlanWorkoutRows(input: GeneratePlanInput): GeneratedPlanWorkoutRow[] {
  const cfg = input.config;
  const minWeekly = cfg?.minWeeklyMiles ?? input.minWeeklyMiles ?? 40;
  const tempoIdealDow = cfg?.tempoIdealDow ?? DEFAULT_TEMPO_IDEAL_OUR_DOW;
  const intervalIdealDow = cfg?.intervalIdealDow ?? DEFAULT_INTERVAL_IDEAL_OUR_DOW;
  const longRunDefaultDow = cfg?.longRunDefaultDow ?? DEFAULT_LONG_RUN_OUR_DOW;
  const tempoStart = cfg?.tempoStartMiles ?? 5;
  const intervalStart = cfg?.intervalStartMiles ?? 5;
  const minTempoMi = cfg?.minTempoMiles ?? 3;
  const minIntervalMi = cfg?.minIntervalMiles ?? 3;
  const minLongMi = cfg?.minLongMiles ?? 8;
  const minEasyPerDay = cfg?.minEasyPerDayMiles ?? 3;
  const minEasyWeek = cfg?.minEasyWeekMiles ?? 4;
  const longRunCap = cfg?.longRunCapFraction ?? 0.4;

  const preferred =
    input.preferredDays.length > 0
      ? [...input.preferredDays].sort((a, b) => a - b)
      : [1, 2, 3, 4, 5, 6];

  const raceUtc = utcDateOnly(input.raceDate);
  const planStart = utcDateOnly(input.planStartDate);
  const raceOurDow = ourDowFromUtcDate(raceUtc);
  const longRunIdeal = normalizeLongRunOurDow(input.preferredLongRunDow, longRunDefaultDow);

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
    const phase = phaseForCatalogue(nOffset, cfg);

    const blockedDates = new Set<string>();
    blockedDates.add(ymdFromDate(addDaysUtc(raceUtc, -1)));

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
          planLadderIndex: null,
        });
      }
      continue;
    }

    /* LR miles + weekly envelope: long-run distance drives the week's total budget. */
    let longMi = longRunMilesForOffset(nOffset, cfg);
    let weeklyMi = weeklyTotalMiles(longMi, nOffset, input.weeklyMileageTarget, minWeekly, cfg);
    const weeklyLongCap = Math.floor(weeklyMi * longRunCap * 10) / 10;
    longMi = Math.min(longMi, weeklyLongCap);

    let tempoMi = tempoStart;
    let intervalMi = intervalStart;
    let packed = compressQualityToCap(weeklyMi, longMi, tempoMi, intervalMi, minTempoMi, minIntervalMi, minLongMi);
    longMi = packed.longMi;
    tempoMi = packed.tempoMi;
    intervalMi = packed.intervalMi;

    const funded = fundEasyMiles(
      weeklyMi,
      longMi,
      tempoMi,
      intervalMi,
      weeklyLongCap,
      minTempoMi,
      minIntervalMi,
      minLongMi,
      minEasyPerDay,
      minEasyWeek
    );
    longMi = funded.longMi;
    tempoMi = funded.tempoMi;
    intervalMi = funded.intervalMi;
    /* Easy pool after LR + tempo + interval are budgeted against weeklyMi. */
    const easyMi = funded.easyMi;

    type DayKind = "tempo" | "interval" | "long" | "easy";
    const assignment = new Map<number, { kind: DayKind; miles: number }>();

    const dayInPlanWindow = (ourDowArg: number): boolean => {
      const dt = dateForDayInWeek(input.planStartDate, weekNumber, ourDowArg);
      if (dt.getTime() < planStart.getTime()) return false;
      if (nOffset !== 0 && dt.getTime() > raceUtc.getTime()) return false;
      return true;
    };

    const slotYmd = (ourDow: number): string =>
      ymdFromDate(dateForDayInWeek(input.planStartDate, weekNumber, ourDow));

    const tryPlace = (ourDow: number, kind: DayKind, miles: number): boolean => {
      if (miles <= 0) return false;
      if (assignment.has(ourDow)) return false;
      const slotDate = dateForDayInWeek(input.planStartDate, weekNumber, ourDow);
      if (slotDate.getTime() < planStart.getTime()) return false;
      if (nOffset !== 0 && slotDate.getTime() > raceUtc.getTime()) return false;
      if (blockedDates.has(ymdFromDate(slotDate))) return false;
      assignment.set(ourDow, { kind, miles: round2(miles) });
      return true;
    };

    const tryPlaceQuality = (
      idealOurDow: number,
      kind: DayKind,
      miles: number,
      isLongRun: boolean
    ): boolean => {
      for (const dow of orderQualityCandidates(idealOurDow, isLongRun, preferred)) {
        if (tryPlace(dow, kind, miles)) return true;
      }
      return false;
    };

    const preferredInWeek1 =
      weekNumber === 1
        ? preferred.filter((d) => dayInPlanWindow(d)).length
        : 999;
    const partialWeek1 = weekNumber === 1 && preferredInWeek1 < 4;

    let extraEasyFromSkippedQuality = 0;
    if (partialWeek1) {
      extraEasyFromSkippedQuality += tempoMi + intervalMi;
    }

    const skipLongOnLongRunDay = nOffset === -1;
    let absorbLongIntoEasy = 0;
    if (skipLongOnLongRunDay) {
      absorbLongIntoEasy = longMi;
    } else if (longMi > 0) {
      if (partialWeek1) {
        const other = longRunIdeal === 6 ? 7 : 6;
        const lrDay =
          preferred.includes(longRunIdeal) && dayInPlanWindow(longRunIdeal)
            ? longRunIdeal
            : preferred.includes(other) && dayInPlanWindow(other)
              ? other
              : null;
        if (lrDay != null && tryPlace(lrDay, "long", longMi)) {
          /* ok */
        } else {
          absorbLongIntoEasy = longMi;
        }
      } else if (!tryPlaceQuality(longRunIdeal, "long", longMi, true)) {
        absorbLongIntoEasy = longMi;
      }
    }

    if (!partialWeek1) {
      if (!tryPlaceQuality(tempoIdealDow, "tempo", tempoMi, false)) {
        extraEasyFromSkippedQuality += tempoMi;
      }
      if (!tryPlaceQuality(intervalIdealDow, "interval", intervalMi, false)) {
        extraEasyFromSkippedQuality += intervalMi;
      }
    }

    const usedForQuality = new Set(assignment.keys());
    const easyCandidates = preferred.filter(
      (d) =>
        !usedForQuality.has(d) &&
        dayInPlanWindow(d) &&
        !blockedDates.has(slotYmd(d))
    );
    /* Easy only on preferred days (no Mon-Sun fallback). */
    const easyDays = easyCandidates;

    let easyBudget = easyMi + absorbLongIntoEasy + extraEasyFromSkippedQuality;

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
            miles: Math.max(minEasyPerDay, round2(cur.miles + miss)),
          });
        }
      }
    }

    trimEasyAssignmentsToWeeklyTotal({
      assignment,
      weeklyCap: weeklyMi,
      minEasyPerDay,
      minTempo: minTempoMi,
      minInterval: minIntervalMi,
      minLong: minLongMi,
    });

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
        planLadderIndex: null,
      });
    }

    /* Race on Monday immediately after this week's Sunday: folded into this week (see calendarTrainingWeekCount). */
    const mondayFolded =
      weekNumber === weekCount &&
      raceUtc.getUTCDay() === 1 &&
      utcDateOnly(addDaysUtc(weekAnchor, 7)).getTime() === raceUtc.getTime();
    if (mondayFolded) {
      out.push({
        title: formatPlannedWorkoutTitle(
          "LongRun",
          milesToMeters(input.raceDistanceMiles),
          { isRace: true, raceName: input.raceName }
        ),
        workoutType: "LongRun",
        athleteId: input.athleteId,
        planId: input.planId,
        date: utcDateOnly(raceUtc),
        phase: phaseForCatalogue(0),
        estimatedDistanceInMeters: milesToMeters(input.raceDistanceMiles),
        nOffset: 0,
        weekNumber,
        dayAssigned: DAY_NAMES[raceOurDow - 1],
        catalogueWorkoutId: null,
        planLadderIndex: null,
      });
    }
  }

  return out;
}

const LADDER_ROTATION_TYPES = ["Intervals", "Tempo"] as const;

/**
 * Phase B: freeze ladder step 0–3 from ordinal position in plan (per type), not completion.
 * Call after generatePlanWorkoutRows.
 */
export function assignRotationalIdentifiers(rows: GeneratedPlanWorkoutRow[]): void {
  const indexed = rows.map((r, idx) => ({ r, idx }));
  for (const wt of LADDER_ROTATION_TYPES) {
    const subset = indexed
      .filter((x) => x.r.workoutType === wt)
      .sort((a, b) => {
        const ta = a.r.date.getTime();
        const tb = b.r.date.getTime();
        if (ta !== tb) return ta - tb;
        return a.idx - b.idx;
      });
    subset.forEach((x, ord) => {
      x.r.planLadderIndex = ord % 4;
    });
  }
  for (const r of rows) {
    if (!LADDER_ROTATION_TYPES.includes(r.workoutType as (typeof LADDER_ROTATION_TYPES)[number])) {
      r.planLadderIndex = null;
    }
  }
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
      let token = `${abbr}:${milesStr}${suf}`;
      if (
        (r.workoutType === "Intervals" || r.workoutType === "Tempo") &&
        r.planLadderIndex != null
      ) {
        token += `-i${r.planLadderIndex}`;
      }
      return token;
    });
    out.push({ weekNumber: w, schedule: parts.join(" ") });
  }
  return out;
}
