import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import type { PhaseWeekRow } from "@/lib/training/phase-week-pins";
import type {
  RaceWeekSlotForGenerate,
  TrainingManagePresetForGenerate,
} from "@/lib/training/fetch-training-manage-preset-for-generate";
import { splitPlanWeekPhases } from "@/lib/training/plan-week-phase-split";
import { mapPositionRow } from "@/lib/training/plan-generate-presets-loader";
import type { RunTypePosition } from "@/lib/training/run-type-config-shared";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import { addDaysUtc, utcDateOnly, ymdFromDate } from "@/lib/training/plan-utils";
import { WorkoutType as WT } from "@prisma/client";

function round1(n: number): number {
  return Math.max(0, Math.round(n * 10) / 10);
}

export function positionsFromPhaseRotation(
  config: NonNullable<TrainingManagePresetForGenerate["build"]>["longRunConfig"],
): ReturnType<typeof mapPositionRow>[] {
  if (!config?.positions?.length) return [];
  return config.positions.map(mapPositionRow);
}

/** Interpolate build-phase long runs from start → peak (replaces pool-derived LR miles). */
export function applyBuildPhaseLongRunMiles(input: {
  planSchedule: PlanWeekSchedule[];
  taperStartWeekNumber: number;
  peakWeekNumber: number;
  startLongRunMiles: number | null;
  peakLongRunMiles: number | null;
  longRunCutback: number | null;
  longRunPositions: readonly RunTypePosition[];
}): void {
  const start = input.startLongRunMiles ?? 8;
  const peak = Math.max(start, input.peakLongRunMiles ?? 20);
  const peakWeek = Math.max(1, input.peakWeekNumber);
  const cutback = Math.max(0, Math.min(1, input.longRunCutback ?? 0));
  const rows = [...input.longRunPositions].sort((a, b) => a.cyclePosition - b.cyclePosition);

  for (const week of input.planSchedule) {
    if (week.weekNumber >= input.taperStartWeekNumber) continue;
    const w = week.weekNumber;
    const denom = Math.max(1, peakWeek - 1);
    const t = w >= peakWeek ? 1 : (w - 1) / denom;
    let lrMi = round1(start + (peak - start) * t);
    const isPeakWeek = w === peakWeek;
    if (cutback > 0 && w % 4 === 0 && !isPeakWeek) {
      lrMi = round1(lrMi * (1 - cutback));
    }
    const cyclePos = (w - 1) % Math.max(1, rows.length);
    const catId = rows[cyclePos]?.catalogueWorkoutId ?? null;

    for (const d of week.days) {
      if (d.workoutType !== "LongRun") continue;
      d.miles = lrMi;
      if (catId) d.catalogueWorkoutId = catId;
      d.planCycleIndex = cyclePos;
      break;
    }
  }
}

/** Taper weeks: set long run to the prescribed cap (not a ceiling). */
export function applyPhaseTaperLongRunMiles(input: {
  planSchedule: PlanWeekSchedule[];
  totalWeeks: number;
  taperWeeks: PhaseWeekRow[] | null | undefined;
  taperWeekNumbers?: number[];
}): void {
  const taperRows = input.taperWeeks ?? [];
  const calendarTaperWeeks =
    input.taperWeekNumbers ?? splitPlanWeekPhases(input.totalWeeks).taperWeekNumbers;
  for (let i = 0; i < calendarTaperWeeks.length; i++) {
    const weekNum = calendarTaperWeeks[i]!;
    const row = taperRows.find((r) => r.weekIndex === i + 1);
    const cap = row?.longRunCapMiles;
    if (cap == null || cap <= 0) continue;
    const week = input.planSchedule.find((w) => w.weekNumber === weekNum);
    if (!week) continue;
    for (const d of week.days) {
      if (d.workoutType === "LongRun") {
        d.miles = round1(cap);
        break;
      }
    }
  }
}

/** After easy distribution, trim taper weeks to week total caps (long run stays fixed). */
export function applyPhaseTaperWeekTotalCaps(input: {
  planSchedule: PlanWeekSchedule[];
  totalWeeks: number;
  taperWeeks: PhaseWeekRow[] | null | undefined;
  taperWeekNumbers?: number[];
}): void {
  const taperRows = input.taperWeeks ?? [];
  const calendarTaperWeeks =
    input.taperWeekNumbers ?? splitPlanWeekPhases(input.totalWeeks).taperWeekNumbers;
  for (let i = 0; i < calendarTaperWeeks.length; i++) {
    const weekNum = calendarTaperWeeks[i]!;
    const row = taperRows.find((r) => r.weekIndex === i + 1);
    const weekCap = row?.totalMilesCap;
    if (weekCap == null || weekCap <= 0) continue;
    const week = input.planSchedule.find((w) => w.weekNumber === weekNum);
    if (!week) continue;

    const sum = (): number => week.days.reduce((s, d) => s + d.miles, 0);
    let safety = 0;
    while (sum() > weekCap + 0.05 && safety++ < 500) {
      let shaved = false;
      for (const d of [...week.days].reverse()) {
        if (d.workoutType === "LongRun") continue;
        if (d.workoutType === "Race") continue;
        if (d.miles <= 0) continue;
        d.miles = round1(Math.max(0, d.miles - 0.25));
        shaved = true;
        if (sum() <= weekCap + 0.05) break;
      }
      if (!shaved) break;
    }
  }
}

/** @deprecated Use applyPhaseTaperLongRunMiles — race week caps removed. */
export function applyPhaseTaperAndRaceLongRunCaps(input: {
  planSchedule: PlanWeekSchedule[];
  totalWeeks: number;
  taperWeeks: PhaseWeekRow[] | null | undefined;
  raceWeek: PhaseWeekRow[] | null | undefined;
}): void {
  applyPhaseTaperLongRunMiles({
    planSchedule: input.planSchedule,
    totalWeeks: input.totalWeeks,
    taperWeeks: input.taperWeeks,
  });
}

/** Apply catalogue pins on taper weeks (tempo / intervals / long run). */
export function applyPhaseWeekCataloguePins(input: {
  planSchedule: PlanWeekSchedule[];
  totalWeeks: number;
  taperWeeks: PhaseWeekRow[] | null | undefined;
  raceWeek: PhaseWeekRow[] | null | undefined;
  taperWeekNumbers?: number[];
}): void {
  const applyRow = (weekNum: number, row: PhaseWeekRow | undefined) => {
    if (!row?.pins.length) return;
    const week = input.planSchedule.find((w) => w.weekNumber === weekNum);
    if (!week) return;
    for (const pin of row.pins) {
      for (const d of week.days) {
        if (d.workoutType !== pin.workoutType) continue;
        d.catalogueWorkoutId = pin.catalogueWorkoutId;
        break;
      }
    }
  };

  const taperRows = input.taperWeeks ?? [];
  const calendarTaperWeeks =
    input.taperWeekNumbers ?? splitPlanWeekPhases(input.totalWeeks).taperWeekNumbers;
  for (let i = 0; i < calendarTaperWeeks.length; i++) {
    const weekNum = calendarTaperWeeks[i]!;
    applyRow(weekNum, taperRows.find((r) => r.weekIndex === i + 1));
  }
}

function findWeekDayForDateKey(
  planStart: Date,
  schedule: PlanWeekSchedule[],
  dateKey: string,
): { week: PlanWeekSchedule; dayIndex: number } | null {
  for (const week of schedule) {
    for (let i = 0; i < week.days.length; i++) {
      const day = week.days[i]!;
      const dt = dateForDayInWeek(planStart, week.weekNumber, day.dow);
      if (ymdFromDate(dt) === dateKey) {
        return { week, dayIndex: i };
      }
    }
  }
  return null;
}

function workoutTypeForRaceWeekSlot(
  type: RaceWeekSlotForGenerate["type"],
): typeof WT.Easy | typeof WT.Tempo | typeof WT.Intervals | null {
  if (type === "tempo") return WT.Tempo;
  if (type === "intervals") return WT.Intervals;
  if (type === "easy" || type === "shakeout-easy") return WT.Easy;
  return null;
}

/** Stamp race-week JSON slots onto calendar days (offsets from primary race). */
export function applyRaceWeekSlotsFromPreset(input: {
  planStart: Date;
  raceDate: Date;
  schedule: PlanWeekSchedule[];
  slots: RaceWeekSlotForGenerate[];
}): void {
  const raceUtc = utcDateOnly(input.raceDate);

  for (const slot of input.slots) {
    const dateKey = ymdFromDate(addDaysUtc(raceUtc, slot.offsetFromRace));

    if (slot.type === "off") {
      const located = findWeekDayForDateKey(input.planStart, input.schedule, dateKey);
      if (located) {
        located.week.days.splice(located.dayIndex, 1);
      }
      continue;
    }

    if (slot.type === "race") continue;

    const wt = workoutTypeForRaceWeekSlot(slot.type);
    if (!wt) continue;

    const miles = round1(slot.prescribedMiles ?? 0);
    const located = findWeekDayForDateKey(input.planStart, input.schedule, dateKey);

    if (located) {
      const day = located.week.days[located.dayIndex]!;
      if (day.workoutType === WT.Race) continue;
      day.workoutType = wt;
      day.miles = miles;
      day.catalogueWorkoutId = slot.catalogueWorkoutId;
      day.planCycleIndex = null;
      continue;
    }

    for (const week of input.schedule) {
      for (let dow = 1; dow <= 7; dow++) {
        const dt = dateForDayInWeek(input.planStart, week.weekNumber, dow);
        if (ymdFromDate(dt) !== dateKey) continue;
        week.days.push({
          dow,
          workoutType: wt,
          miles,
          catalogueWorkoutId: slot.catalogueWorkoutId,
          planCycleIndex: null,
        });
        week.days.sort((a, b) => a.dow - b.dow);
      }
    }
  }
}
