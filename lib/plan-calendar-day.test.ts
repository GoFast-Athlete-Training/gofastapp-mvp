import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  calendarTrainingWeekCountFromKeys,
  productTodayKey,
  raceCalendarBeforeProductToday,
  totalWeeksFromDayKeys,
} from "@/lib/plan-calendar-day";

describe("plan-calendar-day", () => {
  test("week count from civil day keys matches marathon block", () => {
    const start = "2026-06-01";
    const race = "2026-10-24";
    assert.equal(calendarTrainingWeekCountFromKeys(start, race), totalWeeksFromDayKeys(start, race));
    assert.ok(totalWeeksFromDayKeys(start, race) >= 16);
  });

  test("product today does not flip to next UTC day during US evening", () => {
    // 9pm Eastern on Oct 23, 2026 = Oct 24 01:00 UTC
    const easternEvening = new Date("2026-10-24T01:00:00.000Z");
    assert.equal(productTodayKey(easternEvening, "America/New_York"), "2026-10-23");
  });

  test("race before today uses product calendar not UTC midnight", () => {
    const easternEvening = new Date("2026-10-24T01:00:00.000Z");
    const today = productTodayKey(easternEvening, "America/New_York");
    assert.equal(raceCalendarBeforeProductToday("2026-10-22"), true);
    assert.equal(raceCalendarBeforeProductToday(today), false);
    assert.equal(raceCalendarBeforeProductToday("2026-10-23"), false);
  });
});
