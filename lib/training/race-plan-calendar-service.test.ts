import assert from "node:assert/strict";
import test from "node:test";
import { WorkoutType as WT } from "@prisma/client";
import { assignWorkoutDays } from "@/lib/training/assign-workout-days";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import { ymdFromDate } from "@/lib/training/plan-utils";
import {
  imprintPlanRaceCalendarOnSchedule,
  type PlanRaceCalendarEntry,
} from "@/lib/training/race-plan-calendar-service";
import { filterAthleteRacesInPlanWindow } from "@/lib/training/race-calendar-hydrate";
import type { HydratedRaceCalendarAthleteRace } from "@/lib/training/race-calendar-hydrate";

const baseInput = {
  planStartDate: new Date("2026-05-20T00:00:00.000Z"),
  raceDate: new Date("2026-10-24T00:00:00.000Z"),
  raceName: "Marine Corps Marathon",
  raceDistanceMiles: 26.2,
  totalWeeks: 23,
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
};

function calendarEntry(
  partial: Pick<PlanRaceCalendarEntry, "athleteRaceId" | "raceRegistryId" | "raceName" | "raceDate"> &
    Partial<PlanRaceCalendarEntry>
): PlanRaceCalendarEntry {
  return {
    role: partial.role ?? "SECONDARY",
    inclusion: partial.inclusion ?? "INCLUDED",
    distanceMeters: partial.distanceMeters ?? 42195,
    distanceLabel: partial.distanceLabel ?? "Half Marathon",
    ...partial,
  };
}

test("imprintPlanRaceCalendarOnSchedule replaces long run on secondary race day", () => {
  const { schedule } = assignWorkoutDays(baseInput);
  const boulderDate = new Date("2026-09-12T00:00:00.000Z");

  const result = imprintPlanRaceCalendarOnSchedule({
    planStart: baseInput.planStartDate,
    totalWeeks: baseInput.totalWeeks,
    schedule,
    defaultEasyCatalogueWorkoutId: "easy-1",
    calendar: {
      primary: calendarEntry({
        athleteRaceId: "mcm-ar",
        raceRegistryId: "mcm-id",
        raceName: "Marine Corps Marathon",
        raceDate: baseInput.raceDate,
        role: "PRIMARY",
        inclusion: "INCLUDED",
      }),
      secondaries: [
        calendarEntry({
          athleteRaceId: "boulder-ar",
          raceRegistryId: "boulder-id",
          raceName: "Boulder Half",
          raceDate: boulderDate,
        }),
      ],
    },
  });

  assert.equal(result.collisions.length, 1);
  assert.equal(result.collisions[0]?.replacedWorkoutType, WT.LongRun);

  const hitWeek = schedule.find((w) => w.weekNumber === result.collisions[0]!.weekNumber);
  const raceDay = hitWeek?.days.find(
    (d) => d.workoutType === WT.Race && d.planRaceEventRole === "SECONDARY"
  );
  assert.ok(raceDay);
  assert.equal(raceDay.athleteRaceId, "boulder-ar");
  assert.equal(raceDay.raceRegistryId, "boulder-id");
  assert.equal(raceDay.replacedWorkoutType, WT.LongRun);

  const easyWithoutCatalogue = schedule.some((w) =>
    w.days.some((d) => d.workoutType === WT.Easy && !d.catalogueWorkoutId?.trim()),
  );
  assert.equal(
    easyWithoutCatalogue,
    false,
    "calendar imprint should not leave Easy days without a catalogue workout",
  );
});

test("imprintPlanRaceCalendarOnSchedule modularRaceWeek skips shakeout/rest/recovery", () => {
  const { schedule } = assignWorkoutDays(baseInput);
  const boulderDate = new Date("2026-09-12T00:00:00.000Z");
  const shakeoutYmd = "2026-09-10";
  const restYmd = "2026-09-11";

  function typeOn(ymd: string): string | null {
    for (const week of schedule) {
      for (const day of week.days) {
        const dt = dateForDayInWeek(baseInput.planStartDate, week.weekNumber, day.dow);
        if (ymdFromDate(dt) === ymd) return day.workoutType;
      }
    }
    return null;
  }

  const beforeShakeout = typeOn(shakeoutYmd);
  const beforeRest = typeOn(restYmd);
  assert.ok(beforeShakeout, "expected a workout on shakeout-adjacent day before imprint");

  imprintPlanRaceCalendarOnSchedule({
    planStart: baseInput.planStartDate,
    totalWeeks: baseInput.totalWeeks,
    schedule,
    modularRaceWeek: true,
    calendar: {
      primary: calendarEntry({
        athleteRaceId: "mcm-ar",
        raceRegistryId: "mcm-id",
        raceName: "Marine Corps Marathon",
        raceDate: baseInput.raceDate,
        role: "PRIMARY",
        inclusion: "INCLUDED",
      }),
      secondaries: [
        calendarEntry({
          athleteRaceId: "boulder-ar",
          raceRegistryId: "boulder-id",
          raceName: "Boulder Half",
          raceDate: boulderDate,
        }),
      ],
    },
  });

  assert.equal(typeOn(shakeoutYmd), beforeShakeout, "modular path must not rewrite days before secondary");
  assert.equal(typeOn(restYmd), beforeRest, "modular path must not clear rest day before secondary");
  assert.equal(typeOn("2026-09-12"), WT.Race);
});

test("imprintPlanRaceCalendarOnSchedule is no-op with zero secondary events", () => {
  const { schedule } = assignWorkoutDays(baseInput);

  imprintPlanRaceCalendarOnSchedule({
    planStart: baseInput.planStartDate,
    totalWeeks: baseInput.totalWeeks,
    schedule,
    calendar: {
      primary: calendarEntry({
        athleteRaceId: "mcm-ar",
        raceRegistryId: "mcm-id",
        raceName: "Marine Corps Marathon",
        raceDate: baseInput.raceDate,
        role: "PRIMARY",
        inclusion: "INCLUDED",
      }),
      secondaries: [],
    },
  });

  const longRuns = schedule.flatMap((w) => w.days.filter((d) => d.workoutType === WT.LongRun));
  assert.ok(longRuns.length > 0);
});

test("filterAthleteRacesInPlanWindow keeps races between start and terminal inclusive", () => {
  const athleteRaces: HydratedRaceCalendarAthleteRace[] = [
    {
      athleteRaceId: "s1",
      raceRegistryId: "early",
      goalTime: null,
      goalName: null,
      hasGoal: false,
      isPrimaryRace: false,
      isPlanTarget: false,
      positionRelativeToPlanRace: "BEFORE",
      race: {
        id: "early",
        slug: null,
        name: "Early 10K",
        distanceLabel: "10K",
        distanceMeters: 10000,
        raceDate: "2026-06-01T00:00:00.000Z",
        city: null,
        state: null,
        logoUrl: null,
      },
    },
    {
      athleteRaceId: "s2",
      raceRegistryId: "primary",
      goalTime: "3:30:00",
      goalName: "Goal Marathon",
      hasGoal: true,
      isPrimaryRace: true,
      isPlanTarget: true,
      positionRelativeToPlanRace: "ON",
      race: {
        id: "primary",
        slug: null,
        name: "Goal Marathon",
        distanceLabel: "Marathon",
        distanceMeters: 42195,
        raceDate: "2026-10-24T00:00:00.000Z",
        city: null,
        state: null,
        logoUrl: null,
      },
    },
  ];

  const inWindow = filterAthleteRacesInPlanWindow(
    athleteRaces,
    new Date("2026-05-20T00:00:00.000Z"),
    new Date("2026-10-24T00:00:00.000Z")
  );
  assert.deepEqual(inWindow.map((s) => s.athleteRaceId), ["s1", "s2"]);
});
