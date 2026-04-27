/**
 * Config layer for marathon plan generation: merges `PlanGenConfig` + defaults,
 * optional `RunTypeConfig` → `catalogueWorkoutId` hydration, and `assignRotationalIdentifiers`.
 *
 * The pure scheduling algorithm is `generatePlanWorkoutRows` in `generate-plan.ts` (config-free).
 * Add new preset/rotation/defaults here, not in `generate-plan.ts`.
 */

import type { WorkoutType } from "@prisma/client";
import {
  assignRotationalIdentifiers,
  generatePlanWorkoutRows,
  type GeneratePlanInput,
  type GeneratedPlanWorkoutRow,
} from "@/lib/training/generate-plan";

/** Subset of preset volume + workout boltons merged for the generator. */
export interface PlanGenConfig {
  cycleLen?: number;
  minWeeklyMiles?: number;
  /** Peak block long-run pool miles; scales the long-run engine cap. */
  peakMiles?: number;
  baseMiles?: number;
  taperMiles?: number;
  maxWeeklyMiles?: number | null;
  /** Not stored on presets; merge uses `DEFAULT_QUALITY_FRACTION` when unset. */
  qualityFraction?: number;
  qualitySessions?: number;
  minLongMiles?: number;
  minEasyPerDayMiles?: number;
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

/** One rotation track: maps cycle index to catalogue. */
export type RunTypeConfigInput = {
  workoutType: WorkoutType;
  positions: RunTypePosition[];
};

export type GeneratePlanFromConfigsInput = {
  planId: string;
  athleteId: string;
  totalWeeks: number;
  planStartDate: Date;
  raceDate: Date;
  weeklyMileageTarget: number;
  /** Floor (miles) before preset `minWeeklyMiles` override. */
  minWeeklyMiles: number;
  preferredDays: number[];
  raceName: string;
  raceDistanceMiles: number;
  preferredLongRunDow?: number | null;
  preferredQualityDays?: number[];
  planConfig?: PlanGenConfig;
  runTypeConfigs?: RunTypeConfigInput[];
};

const DEFAULT_MIN_WEEKLY = 40;
const DEFAULT_CYCLE_LEN = 4;
const DEFAULT_TEMPO_DOW = 2;
const DEFAULT_INTERVAL_DOW = 4;
const DEFAULT_LONG_DOW = 6;
const DEFAULT_MIN_TEMPO = 3;
const DEFAULT_MIN_INTERVAL = 3;
const DEFAULT_MIN_LONG = 8;
const DEFAULT_MIN_EASY_DAY = 3;
const DEFAULT_QUALITY_FRACTION = 0.22;
const DEFAULT_QUALITY_SESSIONS = 1;

/**
 * Merges optional `PlanGenConfig` and caller floors into a single `GeneratePlanInput`
 * (what `generatePlanWorkoutRows` requires).
 */
export function mergePlanConfigToGenerateInput(
  base: GeneratePlanFromConfigsInput
): GeneratePlanInput {
  const c = base.planConfig;
  const minWeeklyMiles = c?.minWeeklyMiles ?? base.minWeeklyMiles ?? DEFAULT_MIN_WEEKLY;
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
    minLongMiles: c?.minLongMiles ?? DEFAULT_MIN_LONG,
    minEasyPerDayMiles: c?.minEasyPerDayMiles ?? DEFAULT_MIN_EASY_DAY,
    qualityFraction: c?.qualityFraction ?? DEFAULT_QUALITY_FRACTION,
    qualitySessions: c?.qualitySessions ?? DEFAULT_QUALITY_SESSIONS,
    peakMiles: c?.peakMiles,
    preferredDays: base.preferredDays,
    raceName: base.raceName,
    raceDistanceMiles: base.raceDistanceMiles,
    preferredLongRunDow: base.preferredLongRunDow,
    preferredQualityDays: base.preferredQualityDays,
  };
}

/**
 * Maps one rotation config (and its positions) to generator rotation input.
 * Catalogue hydration uses the given `workoutType`.
 */
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

function hydrateCatalogueFromRunTypeConfigs(
  rows: GeneratedPlanWorkoutRow[],
  runTypeConfigs: RunTypeConfigInput[] | undefined
): void {
  if (!runTypeConfigs?.length) return;
  const map = new Map<string, string>();
  for (const rtc of runTypeConfigs) {
    for (const p of rtc.positions) {
      if (p.catalogueWorkoutId) {
        map.set(`${rtc.workoutType}:${p.cyclePosition}`, p.catalogueWorkoutId);
      }
    }
  }
  for (const r of rows) {
    if (r.planCycleIndex == null) continue;
    const id = map.get(`${r.workoutType}:${r.planCycleIndex}`);
    if (id) {
      r.catalogueWorkoutId = id;
    }
  }
}

export type GeneratePlanFromConfigsOptions = {
  /**
   * When set, second pass of `assignRotationalIdentifiers` can tag MP long runs
   * that received a `catalogueWorkoutId` from `runTypeConfigs`.
   */
  cataloguePaceById?: Map<string, { paceAnchor: string }>;
};

/**
 * 1) Merge config → `GeneratePlanInput`
 * 2) `generatePlanWorkoutRows` (no catalogue IDs on draft rows)
 * 3) `assignRotationalIdentifiers` (T/I + MP when catalogue known)
 * 4) Hydrate `catalogueWorkoutId` from `runTypeConfigs` (cycle + workout type)
 * 5) Second `assignRotationalIdentifiers` with pace map (MP long `planCycleIndex`)
 */
export function generatePlanFromConfigs(
  input: GeneratePlanFromConfigsInput,
  options: GeneratePlanFromConfigsOptions = {}
): GeneratedPlanWorkoutRow[] {
  const resolved = mergePlanConfigToGenerateInput(input);
  const rows = generatePlanWorkoutRows(resolved);
  assignRotationalIdentifiers(rows);
  hydrateCatalogueFromRunTypeConfigs(rows, input.runTypeConfigs);
  assignRotationalIdentifiers(rows, options.cataloguePaceById);
  return rows;
}
