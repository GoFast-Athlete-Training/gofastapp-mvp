import assert from "node:assert/strict";
import test from "node:test";
import { computeCityRunStartsAt } from "./city-run-starts-at-setter";
import { dateKeyToUtcNoonDate } from "@/lib/calendar-date";

test("9:00 AM Eastern on Oct 17 2026 → 13:00 UTC (EDT)", () => {
  const date = dateKeyToUtcNoonDate("2026-10-17");
  const { timezone, startsAt } = computeCityRunStartsAt({
    date,
    startTimeHour: 9,
    startTimeMinute: 0,
    startTimePeriod: "AM",
    timezone: "America/New_York",
  });
  assert.equal(timezone, "America/New_York");
  assert.equal(startsAt.toISOString(), "2026-10-17T13:00:00.000Z");
});

test("defaults timezone to America/New_York when omitted", () => {
  const date = dateKeyToUtcNoonDate("2026-10-17");
  const { timezone } = computeCityRunStartsAt({
    date,
    startTimeHour: 9,
    startTimeMinute: 0,
    startTimePeriod: "AM",
  });
  assert.equal(timezone, "America/New_York");
});
