import assert from "node:assert/strict";
import test from "node:test";
import { computeCityRunStartsAt } from "./city-run-starts-at-setter";

function inputFor(
  calendarDateKey: string,
  clock: { hour: number; minute: number; period: string },
  timezone: string
) {
  return {
    calendarDateKey,
    startTimeHour: clock.hour,
    startTimeMinute: clock.minute,
    startTimePeriod: clock.period,
    timezone,
  };
}

test("9:00 AM Eastern on Oct 17 2026 → 13:00 UTC (EDT)", () => {
  const { timezone, startsAt } = computeCityRunStartsAt(
    inputFor("2026-10-17", { hour: 9, minute: 0, period: "AM" }, "America/New_York")
  );
  assert.equal(timezone, "America/New_York");
  assert.equal(startsAt.toISOString(), "2026-10-17T13:00:00.000Z");
});

test("8:30 AM Eastern on Oct 24 2026 → 12:30 UTC (EDT)", () => {
  const { startsAt } = computeCityRunStartsAt(
    inputFor("2026-10-24", { hour: 8, minute: 30, period: "AM" }, "America/New_York")
  );
  assert.equal(startsAt.toISOString(), "2026-10-24T12:30:00.000Z");
});

test("8:30 AM Eastern on Dec 12 2026 → 13:30 UTC (EST)", () => {
  const { startsAt } = computeCityRunStartsAt(
    inputFor("2026-12-12", { hour: 8, minute: 30, period: "AM" }, "America/New_York")
  );
  assert.equal(startsAt.toISOString(), "2026-12-12T13:30:00.000Z");
});

test("8:30 AM Central on Oct 24 2026 → 13:30 UTC (CDT)", () => {
  const { startsAt } = computeCityRunStartsAt(
    inputFor("2026-10-24", { hour: 8, minute: 30, period: "AM" }, "America/Chicago")
  );
  assert.equal(startsAt.toISOString(), "2026-10-24T13:30:00.000Z");
});

test("defaults timezone to America/New_York when omitted", () => {
  const { timezone } = computeCityRunStartsAt({
    calendarDateKey: "2026-10-17",
    startTimeHour: 9,
    startTimeMinute: 0,
    startTimePeriod: "AM",
  });
  assert.equal(timezone, "America/New_York");
});
