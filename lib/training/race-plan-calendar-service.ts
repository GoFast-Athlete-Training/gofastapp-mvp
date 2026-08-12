/**
 * Race → plan calendar service.
 * Resolves athlete_races in a plan window and imprints bolt-ons onto planSchedule JSON.
 */

import { WorkoutType as WT } from "@prisma/client";
import { metersToMiles } from "@/lib/pace-utils";
import { prisma } from "@/lib/prisma";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import {
  isStructuredPlanWeek,
  type PlanDaySchedule,
  type PlanWeekSchedule,
} from "@/lib/training/plan-schedule-schema";
import { utcDateOnly, ymdFromDate, currentTrainingWeekNumber } from "@/lib/training/plan-utils";

export type PlanRaceCalendarEntry = {
  athleteRaceId: string;
  raceRegistryId: string;
  role: "PRIMARY" | "SECONDARY";
  inclusion: "INCLUDED" | "EXCLUDED";
  raceName: string;
  raceDate: Date;
  distanceMeters: number | null;
  distanceLabel: string | null;
};

export type PlanRaceCalendar = {
  primary: PlanRaceCalendarEntry | null;
  secondaries: PlanRaceCalendarEntry[];
};

export type PlanRaceCollisionPreview = {
  planId: string;
  athleteRaceId: string;
  raceRegistryId: string;
  raceName: string;
  raceDate: string;
  weekNumber: number;
  collision: {
    hasCollision: boolean;
    existingWorkoutType: string | null;
    replacesLongRun: boolean;
  };
  nearbyChanges: string[];
  recoveryDaysEstimate: number;
};

export type ImprintPlanRaceCalendarResult = {
  collisions: Array<{
    athleteRaceId: string;
    raceName: string;
    raceDate: string;
    weekNumber: number;
    replacedWorkoutType: string | null;
  }>;
};

function raceDistanceMiles(entry: Pick<PlanRaceCalendarEntry, "distanceMeters">): number {
  if (entry.distanceMeters != null && Number.isFinite(entry.distanceMeters)) {
    return metersToMiles(entry.distanceMeters);
  }
  return 26.21875;
}

function recoveryDaysAfterSecondary(distanceMiles: number): number {
  if (distanceMiles >= 20) return 5;
  if (distanceMiles >= 13) return 4;
  if (distanceMiles >= 6) return 3;
  return 2;
}

function recoveryDaysEstimate(distanceMiles: number): number {
  return recoveryDaysAfterSecondary(distanceMiles);
}

function findDayPositionForRaceDate(
  planStart: Date,
  totalWeeks: number,
  raceDate: Date
): { weekNumber: number; dow: number } | null {
  const raceUtc = utcDateOnly(raceDate);
  for (let w = 1; w <= totalWeeks; w++) {
    for (let dow = 1; dow <= 7; dow++) {
      const dt = dateForDayInWeek(planStart, w, dow);
      if (utcDateOnly(dt).getTime() === raceUtc.getTime()) {
        return { weekNumber: w, dow };
      }
    }
  }
  return null;
}

function findDayInSchedule(
  planStart: Date,
  schedule: PlanWeekSchedule[],
  raceDate: Date
): { weekNumber: number; dow: number; existingType: string | null } | null {
  const raceUtc = utcDateOnly(raceDate);
  for (const week of schedule) {
    for (const day of week.days) {
      const dt = dateForDayInWeek(planStart, week.weekNumber, day.dow);
      if (utcDateOnly(dt).getTime() === raceUtc.getTime()) {
        return {
          weekNumber: week.weekNumber,
          dow: day.dow,
          existingType: day.workoutType,
        };
      }
    }
  }
  return null;
}

function athleteRaceToEntry(
  row: {
    id: string;
    raceRegistryId: string;
    name: string;
    raceDate: Date;
    distanceMeters: number | null;
    distanceLabel: string | null;
  },
  role: PlanRaceCalendarEntry["role"],
  inclusion: PlanRaceCalendarEntry["inclusion"]
): PlanRaceCalendarEntry {
  return {
    athleteRaceId: row.id,
    raceRegistryId: row.raceRegistryId,
    role,
    inclusion,
    raceName: row.name,
    raceDate: row.raceDate,
    distanceMeters: row.distanceMeters,
    distanceLabel: row.distanceLabel,
  };
}

/** Load athlete races in plan window; primary from plan.primaryAthleteRaceId. */
export async function resolvePlanRaceCalendar(params: {
  athleteId: string;
  trainingPlanId: string;
  includedSecondaryAthleteRaceIds?: string[] | null;
}): Promise<PlanRaceCalendar> {
  const plan = await prisma.training_plans.findFirst({
    where: { id: params.trainingPlanId, athleteId: params.athleteId },
    include: {
      primary_athlete_race: true,
      race_registry: {
        select: {
          id: true,
          name: true,
          raceDate: true,
          distanceMeters: true,
          distanceLabel: true,
        },
      },
    },
  });
  if (!plan) {
    throw new Error("Plan not found");
  }

  let primaryRow = plan.primary_athlete_race;
  if (!primaryRow && plan.raceId) {
    primaryRow = await prisma.athlete_races.findUnique({
      where: {
        athleteId_raceRegistryId: {
          athleteId: params.athleteId,
          raceRegistryId: plan.raceId,
        },
      },
    });
  }

  if (!primaryRow && plan.race_registry) {
    primaryRow = {
      id: "synthetic-primary",
      athleteId: params.athleteId,
      raceRegistryId: plan.race_registry.id,
      name: plan.race_registry.name,
      raceDate: plan.race_registry.raceDate,
      distanceMeters: plan.race_registry.distanceMeters,
      distanceLabel: plan.race_registry.distanceLabel,
      city: null,
      state: null,
      selfDeclaredAt: plan.startDate,
      notifyEnabled: true,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  if (!primaryRow) {
    throw new Error("Plan has no primary athlete race");
  }

  const primary = athleteRaceToEntry(primaryRow, "PRIMARY", "INCLUDED");
  const startMs = utcDateOnly(plan.startDate).getTime();
  const endMs = utcDateOnly(primary.raceDate).getTime();

  const allRaces = await prisma.athlete_races.findMany({
    where: { athleteId: params.athleteId },
    orderBy: { raceDate: "asc" },
  });

  const includedSet =
    params.includedSecondaryAthleteRaceIds != null
      ? new Set(params.includedSecondaryAthleteRaceIds)
      : null;

  const secondaries: PlanRaceCalendarEntry[] = [];
  for (const row of allRaces) {
    if (row.id === primary.athleteRaceId) continue;
    const dMs = utcDateOnly(row.raceDate).getTime();
    if (dMs < startMs || dMs > endMs) continue;
    const inclusion =
      includedSet == null || includedSet.has(row.id) ? "INCLUDED" : "EXCLUDED";
    secondaries.push(athleteRaceToEntry(row, "SECONDARY", inclusion));
  }

  return { primary, secondaries };
}

export function previewPlanRaceCollision(params: {
  planId: string;
  planStart: Date;
  totalWeeks: number;
  planSchedule: unknown;
  entry: Pick<
    PlanRaceCalendarEntry,
    "athleteRaceId" | "raceRegistryId" | "raceName" | "raceDate" | "distanceMeters"
  >;
}): PlanRaceCollisionPreview {
  const schedule = Array.isArray(params.planSchedule)
    ? (params.planSchedule.filter(isStructuredPlanWeek) as PlanWeekSchedule[])
    : [];

  const distMi = raceDistanceMiles(params.entry);
  const weekNumber = currentTrainingWeekNumber(
    params.planStart,
    params.totalWeeks,
    params.entry.raceDate
  );

  const hit = findDayInSchedule(params.planStart, schedule, params.entry.raceDate);
  const existingType = hit?.existingType ?? null;

  const nearbyChanges: string[] = [];
  if (existingType === "LongRun") {
    nearbyChanges.push("Race replaces your scheduled long run on that day.");
  } else if (existingType === "Tempo" || existingType === "Intervals") {
    nearbyChanges.push(`Race replaces your ${existingType.toLowerCase()} session.`);
  } else if (existingType === "Easy") {
    nearbyChanges.push("Race replaces an easy run on that day.");
  } else if (existingType === "Race") {
    nearbyChanges.push("Race day already on your plan — will align to this calendar race.");
  } else {
    nearbyChanges.push("Race will be added to your plan on that date.");
  }
  nearbyChanges.push("Quality sessions within a day of the race will be reduced.");
  nearbyChanges.push(
    `About ${recoveryDaysEstimate(distMi)} days of lighter training afterward before rebuilding toward your goal race.`
  );

  return {
    planId: params.planId,
    athleteRaceId: params.entry.athleteRaceId,
    raceRegistryId: params.entry.raceRegistryId,
    raceName: params.entry.raceName,
    raceDate: ymdFromDate(params.entry.raceDate),
    weekNumber,
    collision: {
      hasCollision: existingType != null && existingType !== "Race",
      existingWorkoutType: existingType,
      replacesLongRun: existingType === "LongRun",
    },
    nearbyChanges,
    recoveryDaysEstimate: recoveryDaysEstimate(distMi),
  };
}

function stampPrimaryRaceOnSchedule(
  schedule: PlanWeekSchedule[],
  primary: PlanRaceCalendarEntry
): void {
  for (const week of schedule) {
    for (const day of week.days) {
      if (day.workoutType === WT.Race) {
        day.athleteRaceId = primary.athleteRaceId;
        day.raceRegistryId = primary.raceRegistryId;
        day.planRaceEventRole = "PRIMARY";
        day.raceName = primary.raceName;
      }
    }
  }
}

function replaceDayWithSecondaryRace(
  week: PlanWeekSchedule,
  dow: number,
  event: PlanRaceCalendarEntry,
  replacedWorkoutType: string | null
): PlanDaySchedule {
  return {
    dow,
    workoutType: WT.Race,
    miles: 0,
    catalogueWorkoutId: null,
    planCycleIndex: null,
    athleteRaceId: event.athleteRaceId,
    raceRegistryId: event.raceRegistryId,
    planRaceEventRole: "SECONDARY",
    raceName: event.raceName,
    replacedWorkoutType,
  };
}

function removeHardSessionsNearRace(week: PlanWeekSchedule, raceDow: number): void {
  for (const day of week.days) {
    if (day.dow === raceDow) continue;
    const dist = Math.abs(day.dow - raceDow);
    const wrapDist = Math.min(dist, 7 - dist);
    if (wrapDist <= 1 && (day.workoutType === WT.Tempo || day.workoutType === WT.Intervals)) {
      day.workoutType = WT.Easy;
      day.catalogueWorkoutId = null;
      day.planCycleIndex = null;
    }
  }
}

function applyRecoveryAfterRace(
  schedule: PlanWeekSchedule[],
  startWeekNumber: number,
  raceDow: number,
  recoveryCount: number
): void {
  let remaining = recoveryCount;
  for (let wIdx = 0; wIdx < schedule.length && remaining > 0; wIdx++) {
    const week = schedule[wIdx];
    if (week.weekNumber < startWeekNumber) continue;
    for (const day of week.days) {
      if (week.weekNumber === startWeekNumber && day.dow <= raceDow) continue;
      if (day.workoutType === WT.Race && day.planRaceEventRole === "PRIMARY") break;
      if (remaining <= 0) break;
      if (day.workoutType === WT.Tempo || day.workoutType === WT.Intervals) {
        day.workoutType = WT.Easy;
        day.catalogueWorkoutId = null;
        day.planCycleIndex = null;
      }
      day.recoveryAfterRace = true;
      remaining--;
    }
  }
}

/** Mutates schedule in place. Run after assignWorkoutDays, before volume passes. */
export function imprintPlanRaceCalendarOnSchedule(params: {
  planStart: Date;
  totalWeeks: number;
  schedule: PlanWeekSchedule[];
  calendar: PlanRaceCalendar;
}): ImprintPlanRaceCalendarResult {
  const { schedule, calendar } = params;
  if (!calendar.primary) {
    return { collisions: [] };
  }
  stampPrimaryRaceOnSchedule(schedule, calendar.primary);

  const collisions: ImprintPlanRaceCalendarResult["collisions"] = [];
  const includedSecondaries = calendar.secondaries.filter((e) => e.inclusion === "INCLUDED");

  const sorted = [...includedSecondaries].sort(
    (a, b) => a.raceDate.getTime() - b.raceDate.getTime()
  );

  for (const event of sorted) {
    const pos = findDayPositionForRaceDate(
      params.planStart,
      params.totalWeeks,
      event.raceDate
    );
    if (!pos) continue;

    const week = schedule.find((w) => w.weekNumber === pos.weekNumber);
    if (!week) continue;

    let existing = week.days.find((d) => d.dow === pos.dow);
    const replacedType = existing?.workoutType ?? null;

    if (existing) {
      if (existing.workoutType === WT.Race && existing.planRaceEventRole === "PRIMARY") {
        continue;
      }
      existing.workoutType = WT.Race;
      existing.miles = 0;
      existing.catalogueWorkoutId = null;
      existing.planCycleIndex = null;
      existing.athleteRaceId = event.athleteRaceId;
      existing.raceRegistryId = event.raceRegistryId;
      existing.planRaceEventRole = "SECONDARY";
      existing.raceName = event.raceName;
      existing.replacedWorkoutType = replacedType;
    } else {
      existing = replaceDayWithSecondaryRace(week, pos.dow, event, replacedType);
      week.days.push(existing);
      week.days.sort((a, b) => a.dow - b.dow);
    }

    collisions.push({
      athleteRaceId: event.athleteRaceId,
      raceName: event.raceName,
      raceDate: ymdFromDate(event.raceDate),
      weekNumber: pos.weekNumber,
      replacedWorkoutType: replacedType,
    });

    removeHardSessionsNearRace(week, pos.dow);
    applyRecoveryAfterRace(
      schedule,
      pos.weekNumber,
      pos.dow,
      recoveryDaysAfterSecondary(raceDistanceMiles(event))
    );
  }

  return { collisions };
}

export async function listSecondaryCandidatesForPlan(params: {
  athleteId: string;
  planStart: Date;
  primaryRaceDate: Date;
  primaryAthleteRaceId: string | null;
}) {
  const races = await prisma.athlete_races.findMany({
    where: { athleteId: params.athleteId },
    orderBy: { raceDate: "asc" },
  });
  const startMs = utcDateOnly(params.planStart).getTime();
  const endMs = utcDateOnly(params.primaryRaceDate).getTime();
  const todayMs = utcDateOnly(new Date()).getTime();

  return races.filter((r) => {
    if (params.primaryAthleteRaceId && r.id === params.primaryAthleteRaceId) return false;
    const dMs = utcDateOnly(r.raceDate).getTime();
    return dMs >= startMs && dMs <= endMs && dMs >= todayMs;
  });
}

export async function findActivePlanForAthlete(athleteId: string) {
  const { TrainingPlanLifecycle } = await import("@prisma/client");
  return prisma.training_plans.findFirst({
    where: { athleteId, lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
    orderBy: { updatedAt: "desc" },
    include: {
      primary_athlete_race: true,
      race_registry: {
        select: { id: true, name: true, raceDate: true, distanceMeters: true, distanceLabel: true },
      },
    },
  });
}

export async function athleteRaceAffectsActivePlan(params: {
  athleteId: string;
  athleteRaceId: string;
  raceRegistryId: string;
  raceDate: Date;
}): Promise<{
  affectsPlan: boolean;
  planId: string | null;
  weekNumber: number | null;
  planName: string | null;
}> {
  const plan = await findActivePlanForAthlete(params.athleteId);
  if (!plan) {
    return { affectsPlan: false, planId: null, weekNumber: null, planName: null };
  }

  const primaryId = plan.primaryAthleteRaceId;
  const primaryRegistryId = plan.primary_athlete_race?.raceRegistryId ?? plan.raceId;
  if (
    params.athleteRaceId === primaryId ||
    params.raceRegistryId === primaryRegistryId
  ) {
    return { affectsPlan: false, planId: plan.id, weekNumber: null, planName: plan.name };
  }

  const primaryDate =
    plan.primary_athlete_race?.raceDate ?? plan.race_registry?.raceDate ?? null;
  if (!primaryDate) {
    return { affectsPlan: false, planId: plan.id, weekNumber: null, planName: plan.name };
  }

  const raceMs = utcDateOnly(params.raceDate).getTime();
  const startMs = utcDateOnly(plan.startDate).getTime();
  const endMs = utcDateOnly(primaryDate).getTime();
  if (raceMs < startMs || raceMs > endMs) {
    return { affectsPlan: false, planId: plan.id, weekNumber: null, planName: plan.name };
  }

  const weekNumber = currentTrainingWeekNumber(plan.startDate, plan.totalWeeks, params.raceDate);
  return {
    affectsPlan: true,
    planId: plan.id,
    weekNumber,
    planName: plan.name,
  };
}
