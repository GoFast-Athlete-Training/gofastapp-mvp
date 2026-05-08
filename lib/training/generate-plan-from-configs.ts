/**
 * Plan generation driven by preset + workout_catalogue rows.
 * Orchestration: catalogue mileage (stub) + long-run-engine + placement; no qualityFraction.
 * cycle-pool: macro-cycle anchors from preset volume constrain weekly mileage ceiling per cycle block.
 */

import type { WorkoutType } from "@prisma/client";
import {
  dateForDayInWeek,
  dayNameToAbbr,
  formatMilesForScheduleToken,
  workoutTypeToScheduleSuffix,
} from "@/lib/training/schedule-parser";
import {
  addDaysUtc,
  mondayUtcOfWeekContaining,
  ymdFromDate,
  nOffsetFromWeekAnchor,
  phaseForCatalogue,
  utcDateOnly,
} from "@/lib/training/plan-utils";
import { formatPlannedWorkoutTitle } from "@/lib/training/workout-display-title";
import { PACE_ANCHOR_MP_SIMULATION } from "@/lib/training/goal-pace-calculator";
import { generateLongRunSchedule, longRunConfigFromPlanGen } from "@/lib/training/long-run-engine";
import { generateCyclePoolTotals } from "@/lib/training/cycle-pool";
import { estimateCatalogueWorkoutMiles, type CatalogueMileEstimateInput } from "@/lib/training/catalogue-mileage";

export type CatalogueGenerationRow = CatalogueMileEstimateInput & { id: string };

/** Subset of preset volume + workout boltons merged for the generator. */
export interface PlanGenConfig {
  cycleLen?: number;
  minWeeklyMiles?: number;
  peakMiles?: number;
  baseMiles?: number;
  taperMiles?: number;
  maxWeeklyMiles?: number | null;
  minTempoMiles?: number;
  minIntervalMiles?: number;
  tempoIdealDow?: number;
  intervalIdealDow?: number;
  longRunDefaultDow?: number;
}

export type RunTypePosition = {
  cyclePosition: number;
  catalogueWorkoutId: string | null;
  distributionWeight?: number;
};

export type RunTypeConfigInput = {
  workoutType: WorkoutType;
  positions: RunTypePosition[];
};

export type GeneratedPlanWorkoutRow = {
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
  planCycleIndex: number | null;
};

export type GeneratePlanCoreInput = {
  planId: string;
  athleteId: string;
  totalWeeks: number;
  planStartDate: Date;
  raceDate: Date;
  weeklyMileageTarget: number;
  minWeeklyMiles: number;
  cycleLen: number;
  tempoIdealDow: number;
  intervalIdealDow: number;
  longRunDefaultDow: number;
  minTempoMiles: number;
  minIntervalMiles: number;
  minLongMiles: number;
  minEasyPerDayMiles: number;
  peakMiles?: number | null;
  preferredDays: number[];
  raceName: string;
  raceDistanceMiles: number;
  preferredLongRunDow?: number | null;
  preferredIntervalTempoDays?: number[];
};

export type GeneratePlanFromConfigsInput = {
  planId: string;
  athleteId: string;
  totalWeeks: number;
  planStartDate: Date;
  raceDate: Date;
  weeklyMileageTarget: number;
  minWeeklyMiles: number;
  preferredDays: number[];
  raceName: string;
  raceDistanceMiles: number;
  preferredLongRunDow?: number | null;
  /** Up to two DOWs for interval then tempo placement (excluding long-run day); matches legacy preferredQualityDays */
  preferredQualityDays?: number[];
  planConfig?: PlanGenConfig;
  runTypeConfigs?: RunTypeConfigInput[];
  /** Full or partial catalogue rows for mileage stub */
  catalogueRowsById?: Map<string, CatalogueGenerationRow>;
};

const DEFAULT_CYCLE_LEN = 4;
const DEFAULT_TEMPO_DOW = 2;
const DEFAULT_INTERVAL_DOW = 4;
const DEFAULT_LONG_DOW = 6;
const DEFAULT_MIN_TEMPO = 3;
const DEFAULT_MIN_INTERVAL = 3;
const DEFAULT_MIN_LONG = 8;
const DEFAULT_MIN_EASY_DAY = 3;
/** Two hard sessions per week when schedule allows */
const HARD_SESSION_SLOTS = 2;

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayKind = "tempo" | "interval" | "long" | "easy";

type AssignEntry = {
  kind: DayKind;
  miles: number;
  catalogueWorkoutId?: string | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function milesToMeters(miles: number): number {
  return miles * 1609.34;
}

function ourDowFromUtcDate(d: Date): number {
  const js = utcDateOnly(d).getUTCDay();
  return js === 0 ? 7 : js;
}

function circularDistOurDow(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 7 - d);
}

function normalizeLongRunOurDow(pref: number | null | undefined, defaultDow: number): number {
  if (pref === 6 || pref === 7) return pref;
  return defaultDow === 7 ? 7 : 6;
}

function orderSessionCandidates(
  idealOurDow: number,
  isLongRun: boolean,
  preferredSorted: number[]
): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  if (isLongRun) {
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

  const order: Array<"interval" | "tempo" | "long"> = ["interval", "tempo", "long"];
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

function resolvedPositions(cfg: RunTypeConfigInput): RunTypePosition[] {
  return [...cfg.positions].sort((a, b) => a.cyclePosition - b.cyclePosition);
}

function catalogueRowForHardSessionOrdinal(
  workoutType: "Intervals" | "Tempo",
  sessionOrdinalSoFar: number,
  runTypeConfigs: RunTypeConfigInput[] | undefined,
  catalogueRowsById: Map<string, CatalogueGenerationRow>
): CatalogueGenerationRow | null {
  const rtc = runTypeConfigs?.find((r) => r.workoutType === workoutType);
  const pos = rtc ? resolvedPositions(rtc) : [];
  if (pos.length === 0) return null;
  const p = pos[sessionOrdinalSoFar % pos.length];
  if (!p.catalogueWorkoutId) return null;
  return catalogueRowsById.get(p.catalogueWorkoutId) ?? null;
}

function mergePlanConfigToCoreInput(
  base: GeneratePlanFromConfigsInput
): GeneratePlanCoreInput {
  const c = base.planConfig;
  const minWeeklyMiles = c?.minWeeklyMiles ?? base.minWeeklyMiles ?? 40;
  return {
    planId: base.planId,
    athleteId: base.athleteId,
    totalWeeks: base.totalWeeks,
    planStartDate: base.planStartDate,
    raceDate: base.raceDate,
    weeklyMileageTarget: base.weeklyMileageTarget,
    minWeeklyMiles,
    cycleLen: c?.cycleLen ?? DEFAULT_CYCLE_LEN,
    tempoIdealDow: c?.tempoIdealDow ?? DEFAULT_TEMPO_DOW,
    intervalIdealDow: c?.intervalIdealDow ?? DEFAULT_INTERVAL_DOW,
    longRunDefaultDow: c?.longRunDefaultDow ?? DEFAULT_LONG_DOW,
    minTempoMiles: c?.minTempoMiles ?? DEFAULT_MIN_TEMPO,
    minIntervalMiles: c?.minIntervalMiles ?? DEFAULT_MIN_INTERVAL,
    minLongMiles: DEFAULT_MIN_LONG,
    minEasyPerDayMiles: DEFAULT_MIN_EASY_DAY,
    peakMiles: c?.peakMiles,
    preferredDays: base.preferredDays,
    raceName: base.raceName,
    raceDistanceMiles: base.raceDistanceMiles,
    preferredLongRunDow: base.preferredLongRunDow,
    preferredIntervalTempoDays: base.preferredQualityDays,
  };
}

/**
 * Macro-cycle ceiling on weekly mileage from preset base/peak/taper pool anchors (spread across cycle weeks).
 */
function weeklyMileageCeilingFromCyclePool(params: {
  weekNumber: number;
  cycleLen: number;
  totalWeeks: number;
  baseMiles?: number | null;
  peakMiles?: number | null;
  taperMiles?: number | null;
}): number | null {
  const { weekNumber, cycleLen, totalWeeks } = params;
  const base = params.baseMiles;
  const peak = params.peakMiles;
  const taper = params.taperMiles;
  if (
    base == null ||
    peak == null ||
    taper == null ||
    !Number.isFinite(Number(base)) ||
    !Number.isFinite(Number(peak)) ||
    !Number.isFinite(Number(taper))
  ) {
    return null;
  }
  const len = Math.max(1, Math.floor(cycleLen));
  const { poolMilesByCycle, nCycles } = generateCyclePoolTotals({
    totalWeeks,
    cycleLen: len,
    baseMiles: Number(base),
    peakMiles: Number(peak),
    taperMiles: Number(taper),
  });
  if (nCycles < 1) return null;
  const cycleIdx = Math.min(nCycles - 1, Math.floor((weekNumber - 1) / len));
  const pool = poolMilesByCycle[cycleIdx];
  if (pool == null || !Number.isFinite(pool) || pool <= 0) return null;
  const perWeekSuggested = pool / len;
  return Math.max(minWeeklyFloorsSuggested(perWeekSuggested), Math.round(perWeekSuggested * 10) / 10);
}

/** Avoid returning nonsensically low ceilings */
function minWeeklyFloorsSuggested(n: number): number {
  return Math.max(20, Math.min(n, 100));
}

export function buildPlanWorkoutRowsFromPreset(
  input: GeneratePlanCoreInput,
  runTypeConfigs: RunTypeConfigInput[] | undefined,
  catalogueRowsById: Map<string, CatalogueGenerationRow>,
  volumeAnchors?: { baseMiles?: number | null; peakMiles?: number | null; taperMiles?: number | null }
): GeneratedPlanWorkoutRow[] {
  const minWeekly = input.minWeeklyMiles;
  const tempoIdealDow = input.tempoIdealDow;
  const intervalIdealDow = input.intervalIdealDow;
  const longRunDefaultDow = input.longRunDefaultDow;
  const minTempoMi = input.minTempoMiles;
  const minIntervalMi = input.minIntervalMiles;
  const minLongMi = input.minLongMiles;
  const minEasyPerDay = input.minEasyPerDayMiles;
  let tempoSessionOrdinal = 0;
  let intervalSessionOrdinal = 0;

  const preferred =
    input.preferredDays.length > 0
      ? [...input.preferredDays].sort((a, b) => a - b)
      : [1, 2, 3, 4, 5, 6];

  const raceUtc = utcDateOnly(input.raceDate);
  const planStart = utcDateOnly(input.planStartDate);
  const raceOurDow = ourDowFromUtcDate(raceUtc);
  const longRunIdeal = normalizeLongRunOurDow(input.preferredLongRunDow, longRunDefaultDow);

  const qd = (input.preferredIntervalTempoDays ?? [])
    .filter((d) => d >= 1 && d <= 7)
    .filter((d) => d !== longRunIdeal);
  let tempoDow1 = tempoIdealDow;
  let intervalDow2 = intervalIdealDow;
  if (qd.length >= 1) tempoDow1 = qd[0]!;
  if (qd.length >= 2) intervalDow2 = qd[1]!;

  const out: GeneratedPlanWorkoutRow[] = [];

  if (planStart.getTime() > raceUtc.getTime()) {
    return out;
  }

  const firstMonday = mondayUtcOfWeekContaining(planStart);
  const weekCount = input.totalWeeks;
  const longRunSchedule = generateLongRunSchedule(
    longRunConfigFromPlanGen(weekCount, {
      minLongMiles: minLongMi,
      peakMiles: input.peakMiles,
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

    const weeklyMiRequested = Math.max(minWeekly, Math.min(100, input.weeklyMileageTarget));
    const poolCap = weeklyMileageCeilingFromCyclePool({
      weekNumber,
      cycleLen: input.cycleLen,
      totalWeeks: weekCount,
      baseMiles: volumeAnchors?.baseMiles,
      peakMiles: volumeAnchors?.peakMiles,
      taperMiles: volumeAnchors?.taperMiles,
    });
    const weeklyMi =
      poolCap != null ? Math.min(weeklyMiRequested, poolCap) : weeklyMiRequested;

    const weekIndex0 = weekNumber - 1;
    const lrFromSchedule = longRunSchedule[weekIndex0];
    const longMiRaw = lrFromSchedule?.distance ?? 0;

    const preferredInWeek1 =
      weekNumber === 1
        ? preferred.filter((d) => {
            const dt = dateForDayInWeek(input.planStartDate, weekNumber, d);
            if (dt.getTime() < planStart.getTime()) return false;
            if (nOffset !== 0 && dt.getTime() > raceUtc.getTime()) return false;
            return true;
          }).length
        : 999;
    const partialWeek1 = weekNumber === 1 && preferredInWeek1 < 4;

    let tempoMiles = 0;
    let intervalMiles = 0;
    if (!partialWeek1) {
      const tempoRow = catalogueRowForHardSessionOrdinal(
        "Tempo",
        tempoSessionOrdinal,
        runTypeConfigs,
        catalogueRowsById
      );
      const intervalRow = catalogueRowForHardSessionOrdinal(
        "Intervals",
        intervalSessionOrdinal,
        runTypeConfigs,
        catalogueRowsById
      );
      tempoMiles = estimateCatalogueWorkoutMiles(tempoRow, "Tempo");
      intervalMiles = estimateCatalogueWorkoutMiles(intervalRow, "Intervals");
    }

    let longMi = longMiRaw;
    const sessionMilesReserved = tempoMiles + intervalMiles;
    if (longMi + sessionMilesReserved > weeklyMi) {
      longMi = Math.max(minLongMi, weeklyMi - sessionMilesReserved);
    }
    let easyMi = Math.max(0, weeklyMi - longMi - sessionMilesReserved);

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

    const tryPlaceSessionEntry = (
      idealOurDow: number,
      entry: AssignEntry,
      isLongRun: boolean
    ): boolean => {
      for (const dow of orderSessionCandidates(idealOurDow, isLongRun, preferred)) {
        if (tryPlaceEntry(dow, entry)) return true;
      }
      return false;
    };

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
      } else if (!tryPlaceSessionEntry(longRunIdeal, longEntry, true)) {
        absorbLongIntoEasy = longMi;
      }
    }

    if (!partialWeek1) {
      for (let slot = 0; slot < HARD_SESSION_SLOTS; slot++) {
        const slotMiles = slot === 0 ? tempoMiles : intervalMiles;
        if (slotMiles <= 0) continue;
        const idealDow = slot === 0 ? tempoDow1 : intervalDow2;
        const fallbackKind: DayKind = slot === 0 ? "tempo" : "interval";
        const entry: AssignEntry = {
          kind: fallbackKind,
          miles: slotMiles,
          catalogueWorkoutId: undefined,
        };
        if (tryPlaceSessionEntry(idealDow, entry, false)) {
          if (slot === 0) tempoSessionOrdinal += 1;
          else intervalSessionOrdinal += 1;
        }
      }
    }

    const used = new Set(assignment.keys());
    const easyDayList = preferred.filter(
      (d) =>
        !used.has(d) && dayInPlanWindow(d) && !blockedDates.has(slotYmd(d))
    );

    let easyBudget = easyMi + absorbLongIntoEasy;

    if (easyBudget > 0 && easyDayList.length > 0) {
      const baseShare = Math.floor((easyBudget / easyDayList.length) * 10) / 10;
      for (let i = 0; i < easyDayList.length; i++) {
        let m =
          i === easyDayList.length - 1
            ? round2(easyBudget - baseShare * (easyDayList.length - 1))
            : baseShare;
        if (m < 0.25) continue;
        const d = easyDayList[i]!;
        if (assignment.has(d)) continue;
        assignment.set(d, { kind: "easy", miles: m });
      }
      const lastEasy = easyDayList[easyDayList.length - 1];
      const sumEasy = easyDayList.reduce((s, d) => {
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
        ent.kind === "tempo"
          ? "Tempo"
          : ent.kind === "interval"
            ? "Intervals"
            : ent.kind === "long"
              ? "LongRun"
              : "Easy";
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

export function hydrateCatalogueFromRunTypeConfigs(
  rows: GeneratedPlanWorkoutRow[],
  runTypeConfigs: RunTypeConfigInput[] | undefined
): void {
  if (!runTypeConfigs?.length) return;
  for (const r of rows) {
    const rtc = runTypeConfigs.find((x) => x.workoutType === r.workoutType);
    if (!rtc) continue;
    const pos = resolvedPositions(rtc);
    if (!pos.length || r.planCycleIndex == null) continue;
    const slot = pos[r.planCycleIndex % pos.length];
    if (slot.catalogueWorkoutId) {
      r.catalogueWorkoutId = slot.catalogueWorkoutId;
    }
  }
}

const CYCLE_ROTATION_TYPES = ["Intervals", "Tempo"] as const;

export function assignRotationalIdentifiers(
  rows: GeneratedPlanWorkoutRow[],
  catalogueById?: Map<string, { paceAnchor: string }>,
  runTypeConfigs?: RunTypeConfigInput[]
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
    const rtc = runTypeConfigs?.find((x) => x.workoutType === wt);
    const n = rtc?.positions?.length ?? 0;
    const mod = n > 0 ? n : 4;
    subset.forEach((x, ord) => {
      x.r.planCycleIndex = ord % mod;
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
  const lrRtc = runTypeConfigs?.find((x) => x.workoutType === "LongRun");
  const lrN = lrRtc?.positions?.length ?? 0;
  const lrMod = lrN > 0 ? lrN : 4;
  mpLongSubset.forEach((x, ord) => {
    x.r.planCycleIndex = ord % lrMod;
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

export type GeneratePlanFromConfigsOptions = {
  cataloguePaceById?: Map<string, { paceAnchor: string }>;
};

/**
 * Loads preset-aligned rows: catalogue mileage + LR engine + hydration + rotation indices.
 */
export function generatePlanFromConfigs(
  input: GeneratePlanFromConfigsInput,
  options: GeneratePlanFromConfigsOptions = {}
): GeneratedPlanWorkoutRow[] {
  const core = mergePlanConfigToCoreInput(input);
  const catalogueRowsById = input.catalogueRowsById ?? new Map<string, CatalogueGenerationRow>();
  const anchors = input.planConfig;

  let rows = buildPlanWorkoutRowsFromPreset(
    core,
    input.runTypeConfigs,
    catalogueRowsById,
    {
      baseMiles: anchors?.baseMiles,
      peakMiles: anchors?.peakMiles,
      taperMiles: anchors?.taperMiles,
    }
  );

  assignRotationalIdentifiers(rows, undefined, input.runTypeConfigs);
  hydrateCatalogueFromRunTypeConfigs(rows, input.runTypeConfigs);
  assignRotationalIdentifiers(rows, options.cataloguePaceById, input.runTypeConfigs);
  hydrateCatalogueFromRunTypeConfigs(rows, input.runTypeConfigs);
  return rows;
}

/** Maps one rotation config (and its positions) to generator rotation input. */
export function runTypeConfigPositionsToInputs(
  workoutType: WorkoutType,
  positions: Array<{
    cyclePosition: number;
    catalogueWorkoutId: string | null;
    distributionWeight: number;
  }>
): RunTypeConfigInput[] {
  if (positions.length === 0) return [];
  const pos = positions.map((p) => ({
    cyclePosition: p.cyclePosition,
    catalogueWorkoutId: p.catalogueWorkoutId,
    distributionWeight: p.distributionWeight,
  }));
  return [{ workoutType, positions: pos }];
}
