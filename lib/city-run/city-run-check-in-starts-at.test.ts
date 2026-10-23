import test from "node:test";
import assert from "node:assert/strict";
import { computeCityRunStartsAt } from "./city-run-starts-at-setter";

test("startsAt uses group departure only when check-in is also set (EDT)", () => {
  const { startsAt, timezone } = computeCityRunStartsAt({
    calendarDateKey: "2026-10-24",
    timezone: "America/New_York",
    startTimeHour: 8,
    startTimeMinute: 30,
    startTimePeriod: "AM",
  });
  assert.equal(timezone, "America/New_York");
  assert.equal(startsAt.toISOString(), "2026-10-24T12:30:00.000Z");
});

test("startsAt uses group departure on EST standard-time date", () => {
  const { startsAt } = computeCityRunStartsAt({
    calendarDateKey: "2026-01-15",
    timezone: "America/New_York",
    startTimeHour: 8,
    startTimeMinute: 30,
    startTimePeriod: "AM",
  });
  assert.equal(startsAt.toISOString(), "2026-01-15T13:30:00.000Z");
});
