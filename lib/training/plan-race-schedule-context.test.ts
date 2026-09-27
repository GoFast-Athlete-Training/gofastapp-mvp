import assert from "node:assert/strict";
import test from "node:test";
import { WorkoutType as WT } from "@prisma/client";
import { assignWorkoutDays } from "@/lib/training/assign-workout-days";
import { analyzePlanRaceDayConsistency } from "@/lib/training/plan-race-day-consistency";
import { planRaceScheduleContextFromPlan } from "@/lib/training/plan-race-schedule-context";
import { planScheduleDayForDateKey } from "@/lib/training/plan-schedule";

test("planRaceScheduleContextFromPlan prefers athlete_races snapshot over registry", () => {
  const athleteDate = new Date("2026-10-25T12:00:00.000Z");
  const registryDate = new Date("2026-10-24T12:00:00.000Z");
  const ctx = planRaceScheduleContextFromPlan({
    athlete_race: {
      raceDate: athleteDate,
      name: "Athlete MCM",
      distanceMeters: 42195,
    },
    race_registry: {
      raceDate: registryDate,
      name: "Registry MCM",
      distanceMeters: 42195,
    },
  });
  assert.equal(ctx.raceDate?.toISOString(), athleteDate.toISOString());
  assert.equal(ctx.raceName, "Athlete MCM");
});

test("primary race day resolves as Race on athlete snapshot date when registry differs", () => {
  const planStartDate = new Date("2026-05-20T00:00:00.000Z");
  const athleteRaceDate = new Date("2026-10-25T12:00:00.000Z");
  const registryRaceDate = new Date("2026-10-24T12:00:00.000Z");
  const totalWeeks = 23;

  const { schedule } = assignWorkoutDays({
    planStartDate,
    raceDate: athleteRaceDate,
    raceName: "Marine Corps Marathon",
    raceDistanceMiles: 26.2,
    totalWeeks,
    preferredDays: [2, 4, 5, 6],
    preferredLongRunDow: 6,
    preferredTempoDow: 2,
    preferredIntervalDow: 4,
    tempoIdealDow: 2,
    intervalIdealDow: 4,
    longRunDefaultDow: 6,
    peakWeeklyMilesForCap: 40,
    longRunCycleLen: 4,
    longRunPositions: [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: "lr-1" }],
    intervalsPositions: [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: "int-1" }],
    tempoPositions: [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: "tempo-1" }],
    easyPositions: [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: "easy-1" }],
  });

  const athleteDateKey = "2026-10-25";

  // Stale plan: race week still has LongRun on athlete date (no regen after date move).
  for (const week of schedule) {
    for (const day of week.days) {
      if (day.workoutType === WT.Race) {
        day.workoutType = WT.LongRun;
        day.miles = 20;
      }
    }
  }

  const withAthleteSot = planScheduleDayForDateKey({
    planStartDate,
    planSchedule: schedule,
    raceDate: athleteRaceDate,
    raceName: "Marine Corps Marathon",
    raceDistanceMiles: 26.2,
    dateKey: athleteDateKey,
    maxWeekNumber: totalWeeks,
  });

  const withRegistryOnly = planScheduleDayForDateKey({
    planStartDate,
    planSchedule: schedule,
    raceDate: registryRaceDate,
    raceName: "Marine Corps Marathon",
    raceDistanceMiles: 26.2,
    dateKey: athleteDateKey,
    maxWeekNumber: totalWeeks,
  });

  assert.ok(withAthleteSot);
  assert.equal(withAthleteSot!.workoutType, WT.Race);
  assert.ok(withRegistryOnly);
  assert.equal(withRegistryOnly!.workoutType, WT.LongRun);
});

test("analyzePlanRaceDayConsistency flags jank when registry SOT would miss athlete race day", () => {
  const planStartDate = new Date("2026-05-20T00:00:00.000Z");
  const athleteRaceDate = new Date("2026-10-25T12:00:00.000Z");
  const registryRaceDate = new Date("2026-10-24T12:00:00.000Z");
  const totalWeeks = 23;

  const { schedule } = assignWorkoutDays({
    planStartDate,
    raceDate: athleteRaceDate,
    raceName: "Marine Corps Marathon",
    raceDistanceMiles: 26.2,
    totalWeeks,
    preferredDays: [2, 4, 5, 6],
    preferredLongRunDow: 6,
    preferredTempoDow: 2,
    preferredIntervalDow: 4,
    tempoIdealDow: 2,
    intervalIdealDow: 4,
    longRunDefaultDow: 6,
    peakWeeklyMilesForCap: 40,
    longRunCycleLen: 4,
    longRunPositions: [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: "lr-1" }],
    intervalsPositions: [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: "int-1" }],
    tempoPositions: [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: "tempo-1" }],
    easyPositions: [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: "easy-1" }],
  });

  for (const week of schedule) {
    for (const day of week.days) {
      if (day.workoutType === WT.Race) {
        day.workoutType = WT.LongRun;
        day.miles = 20;
      }
    }
  }

  const athleteSot = analyzePlanRaceDayConsistency({
    planStartDate,
    planSchedule: schedule,
    totalWeeks,
    athlete_race: {
      raceDate: athleteRaceDate,
      name: "Marine Corps Marathon",
      distanceMeters: 42195,
    },
    race_registry: {
      raceDate: registryRaceDate,
      name: "Marine Corps Marathon",
      distanceMeters: 42195,
    },
  });

  assert.equal(athleteSot.jankOnAthleteRaceDate, false);
  assert.equal(athleteSot.raceDateKeysDiffer, true);
  assert.equal(athleteSot.scheduledOnAthleteRaceDate?.workoutType, WT.Race);
});
