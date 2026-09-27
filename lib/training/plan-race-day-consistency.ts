/**
 * Helpers to detect race-day schedule vs athlete snapshot drift (investigation / QA).
 */

import { planScheduleDayForDateKey, type PlanScheduleDay } from "@/lib/training/plan-schedule";
import { utcDateOnly } from "@/lib/training/plan-utils";
import { planRaceScheduleContextFromPlan } from "@/lib/training/plan-race-schedule-context";

export type PlanRaceDayConsistencyInput = {
  planStartDate: Date;
  planSchedule: unknown;
  totalWeeks: number;
  athlete_race?: {
    raceDate: Date;
    name: string;
    distanceMeters: number | null;
  } | null;
  race_registry?: {
    raceDate: Date;
    name: string;
    distanceMeters: number | null;
  } | null;
  catalogueTitleById?: Readonly<Record<string, string>>;
};

export type PlanRaceDayConsistencyResult = {
  athleteRaceDateKey: string | null;
  registryRaceDateKey: string | null;
  scheduledOnAthleteRaceDate: PlanScheduleDay | null;
  scheduledOnRegistryRaceDate: PlanScheduleDay | null;
  /** Athlete race day exists in schedule but is not typed Race. */
  jankOnAthleteRaceDate: boolean;
  /** Registry and athlete race dates differ (common when snapshot moved). */
  raceDateKeysDiffer: boolean;
};

function dateKeyFromDate(d: Date): string {
  return utcDateOnly(d).toISOString().slice(0, 10);
}

export function analyzePlanRaceDayConsistency(
  params: PlanRaceDayConsistencyInput
): PlanRaceDayConsistencyResult {
  const ctx = planRaceScheduleContextFromPlan(params);
  const athleteRaceDateKey = ctx.raceDate ? dateKeyFromDate(ctx.raceDate) : null;

  const regDate = params.race_registry?.raceDate ?? null;
  const registryRaceDateKey = regDate ? dateKeyFromDate(regDate) : null;

  const base = {
    planStartDate: params.planStartDate,
    planSchedule: params.planSchedule,
    raceName: ctx.raceName,
    raceDistanceMiles: ctx.raceDistanceMiles,
    maxWeekNumber: params.totalWeeks,
    catalogueTitleById: params.catalogueTitleById ?? {},
  };

  const scheduledOnAthleteRaceDate =
    athleteRaceDateKey != null
      ? planScheduleDayForDateKey({
          ...base,
          raceDate: ctx.raceDate,
          dateKey: athleteRaceDateKey,
        })
      : null;

  const scheduledOnRegistryRaceDate =
    registryRaceDateKey != null && params.race_registry
      ? planScheduleDayForDateKey({
          ...base,
          raceDate: params.race_registry.raceDate,
          raceName: params.race_registry.name?.trim() || ctx.raceName,
          raceDistanceMiles: planRaceScheduleContextFromPlan({
            race_registry: params.race_registry,
          }).raceDistanceMiles,
          dateKey: registryRaceDateKey,
        })
      : null;

  const jankOnAthleteRaceDate =
    athleteRaceDateKey != null &&
    scheduledOnAthleteRaceDate != null &&
    scheduledOnAthleteRaceDate.workoutType !== "Race";

  const raceDateKeysDiffer =
    athleteRaceDateKey != null &&
    registryRaceDateKey != null &&
    athleteRaceDateKey !== registryRaceDateKey;

  return {
    athleteRaceDateKey,
    registryRaceDateKey,
    scheduledOnAthleteRaceDate,
    scheduledOnRegistryRaceDate,
    jankOnAthleteRaceDate,
    raceDateKeysDiffer,
  };
}
