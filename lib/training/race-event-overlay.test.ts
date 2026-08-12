import assert from "node:assert/strict";
import test from "node:test";
import { WorkoutType as WT } from "@prisma/client";
import { assignWorkoutDays } from "@/lib/training/assign-workout-days";
import { applyRaceEventOverlay } from "@/lib/training/apply-race-event-overlay";
import type { PlanRaceEventRow } from "@/lib/training/plan-race-events";
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

function secondaryEvent(
  partial: Pick<PlanRaceEventRow, "raceRegistryId" | "raceName" | "raceDate"> &
    Partial<PlanRaceEventRow>
): PlanRaceEventRow {
  return {
    id: partial.id ?? "ev-1",
    trainingPlanId: partial.trainingPlanId ?? "plan-1",
    athleteRaceSignupId: partial.athleteRaceSignupId ?? "signup-1",
    role: partial.role ?? "SECONDARY",
    source: partial.source ?? "CALENDAR",
    inclusion: partial.inclusion ?? "INCLUDED",
    distanceMeters: partial.distanceMeters ?? 42195,
    distanceLabel: partial.distanceLabel ?? "Half Marathon",
    ...partial,
  };
}

test("applyRaceEventOverlay replaces long run on secondary race day", () => {
  const { schedule } = assignWorkoutDays(baseInput);
  const boulderDate = new Date("2026-09-12T00:00:00.000Z");

  const result = applyRaceEventOverlay({
    planStart: baseInput.planStartDate,
    totalWeeks: baseInput.totalWeeks,
    schedule,
    primaryRaceId: "mcm-id",
    primaryRaceDate: baseInput.raceDate,
    secondaryEvents: [
      secondaryEvent({
        raceRegistryId: "boulder-id",
        raceName: "Boulder Half",
        raceDate: boulderDate,
      }),
    ],
  });

  assert.equal(result.collisions.length, 1);
  assert.equal(result.collisions[0]?.replacedWorkoutType, WT.LongRun);

  const hitWeek = schedule.find((w) => w.weekNumber === result.collisions[0]!.weekNumber);
  const raceDay = hitWeek?.days.find((d) => d.workoutType === WT.Race && d.planRaceEventRole === "SECONDARY");
  assert.ok(raceDay);
  assert.equal(raceDay.raceRegistryId, "boulder-id");
  assert.equal(raceDay.raceName, "Boulder Half");
});

test("applyRaceEventOverlay is no-op with zero secondary events (one-race regression)", () => {
  const { schedule } = assignWorkoutDays(baseInput);
  const before = JSON.stringify(schedule);

  applyRaceEventOverlay({
    planStart: baseInput.planStartDate,
    totalWeeks: baseInput.totalWeeks,
    schedule,
    primaryRaceId: "mcm-id",
    primaryRaceDate: baseInput.raceDate,
    secondaryEvents: [],
  });

  const longRuns = schedule.flatMap((w) => w.days.filter((d) => d.workoutType === WT.LongRun));
  assert.ok(longRuns.length > 0);
  assert.notEqual(before, JSON.stringify(schedule)); // primary race stamps role
});

test("filterSignupsInPlanWindow keeps races between start and primary inclusive", () => {
  const signups: HydratedRaceCalendarSignup[] = [
    {
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
    {
      signupId: "s3",
      raceRegistryId: "after",
      goalId: null,
      calendarRole: "OTHER",
      positionRelativeToPrimary: "AFTER",
      race: {
        id: "after",
        slug: null,
        name: "Later 5K",
        distanceLabel: "5K",
        distanceMeters: 5000,
        raceDate: "2026-11-01T00:00:00.000Z",
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
  assert.deepEqual(inWindow.map((s) => s.signupId), ["s1", "s2"]);
});
