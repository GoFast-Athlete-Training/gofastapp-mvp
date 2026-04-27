/**
 * Marathon-style week builder (Mon–Sun, UTC). Plan generate pipeline inside `generatePlanWorkoutRows`:
 *
 * 1. **Total weeks** — `input.totalWeeks` (caller: `calendarTrainingWeekCount` from start → race).
 * 2. **Long-run block count (cycles for LRE)** — `longRunBlockCountFromTotalWeeks(weeks)` = ceil(weeks/4); used inside `generateLongRunSchedule`. Each week is still one row; last block = taper, second-to-last = pre-peak.
 * 3. **Weekly volume** — `weeklyMileageTarget` + `minWeeklyMiles` / quality / easy splits; long-run miles come from the engine. Catalogue phase labels use `cycleLen`-sized blocks from race day (`phaseForCatalogue`).
 * 4. **Preferred days** — `input.preferredDays` (Mon–7); quality days from `preferredQualityDays` or DOWs from the resolved input.
 * 5. **Long-run day of week** — `normalizeLongRunOurDow(preferredLongRunDow, longRunDefaultDow)`.
 * 6. **Call long-run engine** — `generateLongRunSchedule(longRunConfigFromPlanGen(weekCount, { minLongMiles, longRunPeakPool }))` → per-week `distance` array.
 * 7. **Per calendar week** — assign tempo/interval/long/easy to DOWs. `catalogueWorkoutId` is null; hydration lives in `generate-plan-from-configs`.
 *
 * **Config-free module:** all tuning (`PlanGenConfig`) is resolved by callers, typically
 * `generatePlanFromConfigs` in `generate-plan-from-configs.ts` — do not add optional config bags here.
 *
 * Race week (`nOffset === 0`) is race-only; day-before-race is blocked. Partial week 1: skip tempo/interval; LR only if Sat/Sun fall in-range; easy on prefs. Taper long-run pattern comes from the engine for the last block.
 */

import type { WorkoutType } from "@prisma/client";
import {
  dateForDayInWeek,
  dayNameToAbbr,
  formatMilesForScheduleToken,
  workoutTypeToScheduleSuffix,
} from "@/lib/training/schedule-parser";
import { mondayUtcOfWeekContaining, ymdFromDate } from "@/lib/training/plan-utils";
import { formatPlannedWorkoutTitle } from "@/lib/training/workout-display-title";
import { PACE_ANCHOR_MP_SIMULATION } from "@/lib/training/goal-pace-calculator";
import { generateLongRunSchedule, longRunConfigFromPlanGen } from "@/lib/training/long-run-engine";

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
 * Phases are contiguous `cycleLen`-week blocks from the race backward (last block = taper, prior = peak, then build, then base).
 * `nOffset`: 0 = race week; negative = weeks before race.
 * @param cycleLen e.g. 4 — must match the resolved `cycleLen` passed into `GeneratePlanInput` when building rows.
 */
export function phaseForCatalogue(nOffset: number, cycleLen: number): string {
  const L = Math.max(1, Math.floor(Math.abs(cycleLen)));
  if (nOffset === 0) return "taper";
  if (nOffset > 0) return "base";
  const w = -nOffset;
  if (w <= L) return "taper";
  if (w <= 2 * L) return "peak";
  if (w <= 3 * L) return "build";
  return "base";
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

function circularDistOurDow(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 7 - d);
}

function normalizeLongRunOurDow(pref: number | null | undefined, defaultDow: number): number {
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
  weekNumber: number,
  cycleLen: number = 4
): string {
  const planStart = utcDateOnly(
    typeof planStartRaw === "string" ? new Date(planStartRaw) : planStartRaw
  );
  const raceUtc = utcDateOnly(typeof raceRaw === "string" ? new Date(raceRaw) : raceRaw);
  const firstMonday = mondayUtcOfWeekContaining(planStart);
  const weekAnchor = addDaysUtc(firstMonday, (weekNumber - 1) * 7);
  const nOffset = nOffsetFromWeekAnchor(weekAnchor, raceUtc);
  return phaseForCatalogue(nOffset, cycleLen);
}

/**
 * All numeric / rotation fields are pre-resolved. Callers should use
 * `generatePlanFromConfigs` in `generate-plan-from-configs.ts` to merge `PlanGenConfig` + defaults.
 */
export interface GeneratePlanInput {
  planId: string;
  athleteId: string;
  /** Must match `calendarTrainingWeekCount(planStartDate, raceDate)`; drives LRE block count and the week loop. */
  totalWeeks: number;
  planStartDate: Date;
  raceDate: Date;
  weeklyMileageTarget: number;
  /** Effective weekly floor (miles) after preset merge. */
  minWeeklyMiles: number;
  /** Contiguous L-week base/peak/bundle blocks; drives `phase` labels. */
  cycleLen: number;
  tempoIdealDow: number;
  intervalIdealDow: number;
  longRunDefaultDow: number;
  minTempoMiles: number;
  minIntervalMiles: number;
  minLongMiles: number;
  minEasyPerDayMiles: number;
  qualityFraction: number;
  qualitySessions: number;
  /** Scales LRE long-run cap; omit or null for default engine behavior. */
  longRunPeakPool?: number | null;
  preferredDays: number[];
  raceName: string;
  raceDistanceMiles: number;
  /** Preferred long-run day: 6=Sat, 7=Sun. */
  preferredLongRunDow?: number | null;
  /** User-selected quality session DOWs (1–7); max 2. Empty = use tempoIdealDow / intervalIdealDow. */
  preferredQualityDays?: number[];
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
  catalogueWorkoutId: string | null;
  /** Intervals/Tempo: set in phase B via assignRotationalIdentifiers */
  planCycleIndex: number | null;
}

type DayKind = "tempo" | "interval" | "long" | "easy";

type AssignEntry = {
  kind: DayKind;
  miles: number;
  catalogueWorkoutId?: string | null;
  workoutTypeOverride?: WorkoutType;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function trimEasyAssignmentsToWeeklyTotal(params: {
  assignment: Map<number, AssignEntry>;
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
    assignment.set(dow, { ...v, kind: "easy", miles: round2(v.miles - shave) });
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
      assignment.set(dow, { ...v, kind: v.kind, miles: round2(v.miles - shave) });
      over -= shave;
    }
  }
}

export function generatePlanWorkoutRows(input: GeneratePlanInput): GeneratedPlanWorkoutRow[] {
  const minWeekly = input.minWeeklyMiles;
  const tempoIdealDow = input.tempoIdealDow;
  const intervalIdealDow = input.intervalIdealDow;
  const longRunDefaultDow = input.longRunDefaultDow;
  const minTempoMi = input.minTempoMiles;
  const minIntervalMi = input.minIntervalMiles;
  const minLongMi = input.minLongMiles;
  const minEasyPerDay = input.minEasyPerDayMiles;
  const qualityFraction = input.qualityFraction;
  const qualitySessions = Math.min(2, Math.max(0, input.qualitySessions));

  const preferred =
    input.preferredDays.length > 0
      ? [...input.preferredDays].sort((a, b) => a - b)
      : [1, 2, 3, 4, 5, 6];

  const raceUtc = utcDateOnly(input.raceDate);
  const planStart = utcDateOnly(input.planStartDate);
  const raceOurDow = ourDowFromUtcDate(raceUtc);
  const longRunIdeal = normalizeLongRunOurDow(input.preferredLongRunDow, longRunDefaultDow);

  const qd = (input.preferredQualityDays ?? [])
    .filter((d) => d >= 1 && d <= 7)
    .filter((d) => d !== longRunIdeal);
  let qualityDow1 = tempoIdealDow;
  let qualityDow2 = intervalIdealDow;
  if (qd.length >= 1) qualityDow1 = qd[0];
  if (qd.length >= 2) qualityDow2 = qd[1];

  const out: GeneratedPlanWorkoutRow[] = [];

  if (planStart.getTime() > raceUtc.getTime()) {
    return out;
  }

  const firstMonday = mondayUtcOfWeekContaining(planStart);
  const weekCount = input.totalWeeks;
  const longRunSchedule = generateLongRunSchedule(
    longRunConfigFromPlanGen(weekCount, {
      minLongMiles: minLongMi,
      longRunPeakPool: input.longRunPeakPool,
    })
  );

  let weekNumber = 0;
  for (;;) {
    weekNumber += 1;
    if (weekNumber > weekCount) break;

    const weekAnchor = addDaysUtc(firstMonday, (weekNumber - 1) * 7);

    const weekEnd = addDaysUtc(weekAnchor, 6);
    const nOffset = nOffsetFromWeekAnchor(weekAnchor, raceUtc);
    const phase = phaseForCatalogue(nOffset, input.cycleLen);

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
          planCycleIndex: null,
        });
      }
      continue;
    }

    // 1) Long run — miles from `generateLongRunSchedule`; catalogue via slug (see `long-run-engine` LR_SLUGS)
    const weekIndex0 = weekNumber - 1;
    const lrFromSchedule = longRunSchedule[weekIndex0];
    const longMiRaw = lrFromSchedule?.distance ?? 0;
    const weeklyMi = Math.max(minWeekly, Math.min(100, input.weeklyMileageTarget));
    const qualityMiTotal =
      qualitySessions > 0 ? Math.round(weeklyMi * qualityFraction) : 0;
    let longMi = longMiRaw;
    if (longMi + qualityMiTotal > weeklyMi) {
      longMi = Math.max(minLongMi, weeklyMi - qualityMiTotal);
    }
    const easyMi = Math.max(0, weeklyMi - longMi - qualityMiTotal);
    const perSession =
      qualitySessions > 0 ? Math.max(1, Math.round(qualityMiTotal / qualitySessions)) : 0;

    const assignment = new Map<number, AssignEntry>();

    const dayInPlanWindow = (ourDowArg: number): boolean => {
      const dt = dateForDayInWeek(input.planStartDate, weekNumber, ourDowArg);
      if (dt.getTime() < planStart.getTime()) return false;
      if (nOffset !== 0 && dt.getTime() > raceUtc.getTime()) return false;
      return true;
    };

    const slotYmd = (ourDow: number): string =>
      ymdFromDate(dateForDayInWeek(input.planStartDate, weekNumber, ourDow));

    const tryPlaceEntry = (ourDow: number, entry: AssignEntry): boolean => {
      if (entry.miles <= 0) return false;
      if (assignment.has(ourDow)) return false;
      const slotDate = dateForDayInWeek(input.planStartDate, weekNumber, ourDow);
      if (slotDate.getTime() < planStart.getTime()) return false;
      if (nOffset !== 0 && slotDate.getTime() > raceUtc.getTime()) return false;
      if (blockedDates.has(ymdFromDate(slotDate))) return false;
      assignment.set(ourDow, { ...entry, miles: round2(entry.miles) });
      return true;
    };

    const tryPlaceQualityEntry = (
      idealOurDow: number,
      entry: AssignEntry,
      isLongRun: boolean
    ): boolean => {
      for (const dow of orderQualityCandidates(idealOurDow, isLongRun, preferred)) {
        if (tryPlaceEntry(dow, entry)) return true;
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
      extraEasyFromSkippedQuality += qualityMiTotal;
    }

    const skipLongOnLongRunDay = nOffset === -1;
    let absorbLongIntoEasy = 0;
    const longEntry: AssignEntry = {
      kind: "long",
      miles: longMi,
      catalogueWorkoutId: null,
    };
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
        if (lrDay != null && tryPlaceEntry(lrDay, longEntry)) {
          /* ok */
        } else {
          absorbLongIntoEasy = longMi;
        }
      } else if (!tryPlaceQualityEntry(longRunIdeal, longEntry, true)) {
        absorbLongIntoEasy = longMi;
      }
    }

    // 2) Tempo / interval quality slots (catalogue links at materialization)
    if (!partialWeek1 && qualitySessions > 0 && perSession > 0) {
      for (let slot = 0; slot < qualitySessions; slot++) {
        const idealDow = slot === 0 ? qualityDow1 : qualityDow2;
        const fallbackKind: DayKind = slot === 0 ? "tempo" : "interval";
        const entry: AssignEntry = { kind: fallbackKind, miles: perSession };
        if (!tryPlaceQualityEntry(idealDow, entry, false)) {
          extraEasyFromSkippedQuality += perSession;
        }
      }
    }

    // 3) Easy days — fill remaining preferred days
    const usedForQuality = new Set(assignment.keys());
    const easyDayList = preferred.filter(
      (d) =>
        !usedForQuality.has(d) &&
        dayInPlanWindow(d) &&
        !blockedDates.has(slotYmd(d))
    );
    const easyDays = easyDayList;

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
        assignment.set(d, {
          kind: "easy",
          miles: m,
        });
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
            ...cur,
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

    for (const [ourDow, ent] of assignment) {
      if (ent.miles < 0.25) continue;
      const workoutType: WorkoutType =
        ent.workoutTypeOverride ??
        (ent.kind === "tempo"
          ? "Tempo"
          : ent.kind === "interval"
            ? "Intervals"
            : ent.kind === "long"
              ? "LongRun"
              : "Easy");
      const date = dateForDayInWeek(input.planStartDate, weekNumber, ourDow);
      out.push({
        title: formatPlannedWorkoutTitle(workoutType, milesToMeters(ent.miles)),
        workoutType,
        athleteId: input.athleteId,
        planId: input.planId,
        date,
        phase,
        estimatedDistanceInMeters: milesToMeters(ent.miles),
        nOffset,
        weekNumber,
        dayAssigned: DAY_NAMES[ourDow - 1],
        catalogueWorkoutId: ent.catalogueWorkoutId ?? null,
        planCycleIndex: null,
      });
    }

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
        phase: phaseForCatalogue(0, input.cycleLen),
        estimatedDistanceInMeters: milesToMeters(input.raceDistanceMiles),
        nOffset: 0,
        weekNumber,
        dayAssigned: DAY_NAMES[raceOurDow - 1],
        catalogueWorkoutId: null,
        planCycleIndex: null,
      });
    }
  }

  return out;
}

const CYCLE_ROTATION_TYPES = ["Intervals", "Tempo"] as const;

/**
 * Phase B: freeze cycle index 0–3 from ordinal position in plan (per type), not completion.
 * mpSimulation long runs get a separate rotation for embedded MP fraction scaling.
 * Call after generatePlanWorkoutRows.
 */
export function assignRotationalIdentifiers(
  rows: GeneratedPlanWorkoutRow[],
  catalogueById?: Map<string, { paceAnchor: string }>
): void {
  const indexed = rows.map((r, idx) => ({ r, idx }));
  for (const wt of CYCLE_ROTATION_TYPES) {
    const subset = indexed
      .filter((x) => x.r.workoutType === wt)
      .sort((a, b) => {
        const ta = a.r.date.getTime();
        const tb = b.r.date.getTime();
        if (ta !== tb) return ta - tb;
        return a.idx - b.idx;
      });
    subset.forEach((x, ord) => {
      x.r.planCycleIndex = ord % 4;
    });
  }

  const mpLongSubset = indexed
    .filter(
      (x) =>
        x.r.workoutType === "LongRun" &&
        x.r.catalogueWorkoutId != null &&
        catalogueById?.get(x.r.catalogueWorkoutId)?.paceAnchor ===
          PACE_ANCHOR_MP_SIMULATION
    )
    .sort((a, b) => {
      const ta = a.r.date.getTime();
      const tb = b.r.date.getTime();
      if (ta !== tb) return ta - tb;
      return a.idx - b.idx;
    });
  mpLongSubset.forEach((x, ord) => {
    x.r.planCycleIndex = ord % 4;
  });

  for (const r of rows) {
    const isIt = CYCLE_ROTATION_TYPES.includes(
      r.workoutType as (typeof CYCLE_ROTATION_TYPES)[number]
    );
    const isMpLong =
      r.workoutType === "LongRun" &&
      r.catalogueWorkoutId != null &&
      catalogueById?.get(r.catalogueWorkoutId)?.paceAnchor ===
        PACE_ANCHOR_MP_SIMULATION;
    if (!isIt && !isMpLong) {
      r.planCycleIndex = null;
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
      if (r.planCycleIndex != null) {
        token += `-i${r.planCycleIndex}`;
      }
      return token;
    });
    out.push({ weekNumber: w, schedule: parts.join(" ") });
  }
  return out;
}
