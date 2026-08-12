import assert from "node:assert/strict";
import test from "node:test";
import { WorkoutType as WT } from "@prisma/client";
import { assignWorkoutDays } from "@/lib/training/assign-workout-days";
import {
  imprintPlanRaceCalendarOnSchedule,
  type PlanRaceCalendarEntry,
} from "@/lib/training/race-plan-calendar-service";
import { filterSignupsInPlanWindow } from "@/lib/training/race-calendar-hydrate";
import type { HydratedRaceCalendarSignup } from "@/lib/training/race-calendar-hydrate";

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

test("filterSignupsInPlanWindow keeps races between start and primary inclusive", () => {
  const signups: HydratedRaceCalendarSignup[] = [
    {
      athleteRaceId: "s1",
      signupId: "s1",
      raceRegistryId: "early",
      goalId: null,
      calendarRole: "OTHER",
      positionRelativeToPrimary: "BEFORE",
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
      signupId: "s2",
      raceRegistryId: "primary",
      goalId: "g1",
      calendarRole: "PRIMARY",
      positionRelativeToPrimary: "ON",
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

  const inWindow = filterSignupsInPlanWindow(
    signups,
    new Date("2026-05-20T00:00:00.000Z"),
    new Date("2026-10-24T00:00:00.000Z")
  );
  assert.deepEqual(inWindow.map((s) => s.athleteRaceId), ["s1", "s2"]);
});
