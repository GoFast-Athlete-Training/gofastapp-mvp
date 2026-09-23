import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarTrainingWeekCount,
  mondayRaceFoldsIntoPriorPlanWeek,
  utcDateOnly,
} from "@/lib/training/plan-utils";

test("Sunday race UTC does not trigger Monday fold", () => {
  const planStart = new Date("2026-09-21T00:00:00.000Z");
  const sundayRace = new Date("2026-10-25T00:00:00.000Z");
  assert.equal(sundayRace.getUTCDay(), 0);
  assert.equal(mondayRaceFoldsIntoPriorPlanWeek(planStart, sundayRace), false);
});

test("Monday race UTC triggers fold when not in plan-start week", () => {
  const planStart = new Date("2026-09-21T00:00:00.000Z");
  const mondayRace = new Date("2026-10-26T00:00:00.000Z");
  assert.equal(mondayRace.getUTCDay(), 1);
  assert.equal(mondayRaceFoldsIntoPriorPlanWeek(planStart, mondayRace), true);
});

test("calendarTrainingWeekCount: Sunday race in 5-week plan is 5, Monday fold subtracts phantom week", () => {
  const planStart = new Date("2026-09-21T00:00:00.000Z");
  const sundayRace = new Date("2026-10-25T00:00:00.000Z");
  const mondayRace = new Date("2026-10-26T00:00:00.000Z");

  assert.equal(calendarTrainingWeekCount(planStart, sundayRace), 5);
  assert.equal(calendarTrainingWeekCount(planStart, mondayRace), 5);
});

test("Monday fold is calendar-only: same week count for Sunday vs next-day Monday UTC storage", () => {
  const planStart = utcDateOnly(new Date("2026-09-21T00:00:00.000Z"));
  const sundayStored = utcDateOnly(new Date("2026-10-25T00:00:00.000Z"));
  const mondayStored = utcDateOnly(new Date("2026-10-26T00:00:00.000Z"));

  assert.equal(mondayRaceFoldsIntoPriorPlanWeek(planStart, sundayStored), false);
  assert.equal(mondayRaceFoldsIntoPriorPlanWeek(planStart, mondayStored), true);
});
