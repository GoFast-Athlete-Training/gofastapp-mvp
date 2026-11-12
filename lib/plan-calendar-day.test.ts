import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  calendarTrainingWeekCountFromKeys,
  productTodayKey,
  raceCalendarBeforeProductToday,
  scheduleAnchorDayKey,
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

  test("Sunday start with Monday–Saturday training moves week 1 to the next Monday", () => {
    assert.equal(
      scheduleAnchorDayKey("2026-11-15", [1, 2, 3, 4, 5, 6], "2027-04-18"),
      "2026-11-16"
    );
  });

  test("Sunday start stays when Sunday is a training day", () => {
    assert.equal(
      scheduleAnchorDayKey("2026-11-15", [1, 2, 3, 4, 5, 6, 7], "2027-04-18"),
      "2026-11-15"
    );
  });

  test("mid-week start with a later training day keeps that week", () => {
    assert.equal(
      scheduleAnchorDayKey("2026-05-20", [2, 4, 5, 6], "2026-10-24"),
      "2026-05-20"
    );
  });

  test("does not move the start onto or past race day", () => {
    assert.equal(scheduleAnchorDayKey("2026-11-15", [1, 2, 3, 4, 5, 6], "2026-11-16"), "2026-11-15");
  });

  test("race before today uses product calendar not UTC midnight", () => {
    const easternEvening = new Date("2026-10-24T01:00:00.000Z");
    const today = productTodayKey(easternEvening, "America/New_York");
    assert.equal(raceCalendarBeforeProductToday("2026-10-22"), true);
    assert.equal(raceCalendarBeforeProductToday(today), false);
    assert.equal(raceCalendarBeforeProductToday("2026-10-23"), false);
  });
});
