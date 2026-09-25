import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import type { PhaseWeekRow } from "@/lib/training/phase-week-pins";
import type { TrainingManagePresetForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";
import { TAPER_CALENDAR_WEEKS } from "@/lib/training/preset-volume-helpers";
import { mapPositionRow } from "@/lib/training/plan-generate-presets-loader";
import type { RunTypePosition } from "@/lib/training/run-type-config-shared";

function round1(n: number): number {
  return Math.max(0, Math.round(n * 10) / 10);
}

export function positionsFromPhaseRotation(
  config: TrainingManagePresetForGenerate["build"]["longRunConfig"],
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
  longRunPositions: readonly RunTypePosition[];
}): void {
  const start = input.startLongRunMiles ?? 8;
  const peak = Math.max(start, input.peakLongRunMiles ?? 20);
  const peakWeek = Math.max(1, input.peakWeekNumber);
  const rows = [...input.longRunPositions].sort((a, b) => a.cyclePosition - b.cyclePosition);

  for (const week of input.planSchedule) {
    if (week.weekNumber >= input.taperStartWeekNumber) continue;
    const w = week.weekNumber;
    const denom = Math.max(1, peakWeek - 1);
    const t = w >= peakWeek ? 1 : (w - 1) / denom;
    const lrMi = round1(start + (peak - start) * t);
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

export function applyPhaseTaperAndRaceLongRunCaps(input: {
  planSchedule: PlanWeekSchedule[];
  totalWeeks: number;
  taperWeeks: PhaseWeekRow[] | null | undefined;
  raceWeek: PhaseWeekRow[] | null | undefined;
}): void {
  const taperRows = input.taperWeeks ?? [];
  for (let i = 0; i < TAPER_CALENDAR_WEEKS; i++) {
    const weekNum = input.totalWeeks - TAPER_CALENDAR_WEEKS + 1 + i;
    const row = taperRows.find((r) => r.weekIndex === i + 1);
    const cap = row?.longRunCapMiles;
    if (cap == null || cap <= 0) continue;
    const week = input.planSchedule.find((w) => w.weekNumber === weekNum);
    if (!week) continue;
    for (const d of week.days) {
      if (d.workoutType === "LongRun") {
        d.miles = round1(Math.min(d.miles, cap));
        break;
      }
    }
  }

  const raceRow = input.raceWeek?.find((r) => r.weekIndex === 1);
  const raceLrCap = raceRow?.longRunCapMiles;
  if (raceLrCap != null && raceLrCap > 0) {
    const week = input.planSchedule.find((w) => w.weekNumber === input.totalWeeks);
    if (week) {
      for (const d of week.days) {
        if (d.workoutType === "LongRun") {
          d.miles = round1(Math.min(d.miles, raceLrCap));
          break;
        }
      }
    }
  }
}

/** Apply catalogue pins on taper + race weeks (tempo / intervals / long run). */
export function applyPhaseWeekCataloguePins(input: {
  planSchedule: PlanWeekSchedule[];
  totalWeeks: number;
  taperWeeks: PhaseWeekRow[] | null | undefined;
  raceWeek: PhaseWeekRow[] | null | undefined;
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
  for (let i = 0; i < TAPER_CALENDAR_WEEKS; i++) {
    const weekNum = input.totalWeeks - TAPER_CALENDAR_WEEKS + 1 + i;
    applyRow(weekNum, taperRows.find((r) => r.weekIndex === i + 1));
  }

  applyRow(input.totalWeeks, input.raceWeek?.find((r) => r.weekIndex === 1));
}
