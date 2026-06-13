import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysUtc,
  mondayUtcOfWeekContaining,
  utcDateOnly,
  ymdFromDate,
} from "@/lib/training/plan-utils";

describe("weekly garmin push week window", () => {
  it("uses Monday through Sunday for the week containing a Monday cron run", () => {
    const mondayCron = new Date("2026-06-15T04:00:00.000Z");
    const weekStart = mondayUtcOfWeekContaining(mondayCron);
    const weekEnd = addDaysUtc(weekStart, 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    assert.equal(ymdFromDate(weekStart), "2026-06-15");
    assert.equal(ymdFromDate(utcDateOnly(weekEnd)), "2026-06-21");
  });

  it("uses the current ISO week when cron runs mid-week", () => {
    const wednesday = new Date("2026-06-17T04:00:00.000Z");
    const weekStart = mondayUtcOfWeekContaining(wednesday);
    assert.equal(ymdFromDate(weekStart), "2026-06-15");
  });
});
