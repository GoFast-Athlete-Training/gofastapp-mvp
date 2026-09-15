import assert from "node:assert/strict";
import test from "node:test";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import {
  applyRaceDayRolesOnSchedule,
  raceDayRoleOn,
  raceDayWindow,
} from "@/lib/training/race-day-service";
import { ymdFromDate } from "@/lib/training/plan-utils";

test("raceDayWindow maps shakeout rest race", () => {
  const race = new Date("2026-10-25T00:00:00.000Z");
  assert.deepEqual(raceDayWindow(race), [
    { dateKey: "2026-10-23", role: "shakeout" },
    { dateKey: "2026-10-24", role: "rest" },
    { dateKey: "2026-10-25", role: "race" },
  ]);
});

test("raceDayRoleOn returns null outside window", () => {
  const race = new Date("2026-10-26T00:00:00.000Z");
  assert.equal(raceDayRoleOn(race, "2026-10-23"), null);
  assert.equal(raceDayRoleOn(race, "2026-10-24"), "shakeout");
});

test("applyRaceDayRolesOnSchedule removes rest and downgrades shakeout long runs", () => {
  const planStart = new Date("2026-10-06T00:00:00.000Z");
  const raceDate = new Date("2026-10-25T00:00:00.000Z");
  const schedule = [
    {
      weekNumber: 3,
      days: [
        { dow: 5, workoutType: "Easy" as const, miles: 0, catalogueWorkoutId: null, planCycleIndex: null },
        { dow: 6, workoutType: "LongRun" as const, miles: 0, catalogueWorkoutId: null, planCycleIndex: null },
        { dow: 7, workoutType: "Race" as const, miles: 0, catalogueWorkoutId: null, planCycleIndex: null },
      ],
    },
  ];

  applyRaceDayRolesOnSchedule({
    planStart,
    totalWeeks: 4,
    schedule,
    raceDate,
  });

  const byDow = new Map(schedule[0]!.days.map((d) => [d.dow, d.workoutType]));
  assert.equal(byDow.get(5), "Easy");
  assert.equal(byDow.has(6), false);
  assert.equal(byDow.get(7), "Race");
});
