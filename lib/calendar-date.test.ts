import assert from "node:assert/strict";
import test from "node:test";
import {
  addCalendarDays,
  dateKeyFromDate,
  dateKeyFromIsoOrDateKey,
  dateKeyToLocalNoonDate,
  dateKeyToUtcNoonDate,
  formatCalendarDate,
  isDateKey,
  parseCalendarDateForWrite,
} from "./calendar-date";

test("isDateKey validates YYYY-MM-DD", () => {
  assert.equal(isDateKey("2026-06-24"), true);
  assert.equal(isDateKey("2026-06-24T00:00:00.000Z"), false);
});

test("dateKeyFromIsoOrDateKey extracts UTC calendar day from midnight ISO", () => {
  assert.equal(dateKeyFromIsoOrDateKey("2026-06-24T00:00:00.000Z"), "2026-06-24");
});

test("parseCalendarDateForWrite anchors date-only input at UTC noon", () => {
  const d = parseCalendarDateForWrite("2026-06-24");
  assert.equal(d.toISOString(), "2026-06-24T12:00:00.000Z");
});

test("addCalendarDays advances by whole weeks", () => {
  assert.equal(addCalendarDays("2026-06-10", 7), "2026-06-17");
  assert.equal(
    addCalendarDays(dateKeyToUtcNoonDate("2026-06-10"), 7),
    "2026-06-17"
  );
});

test("formatCalendarDate keeps Wednesday for UTC-midnight legacy storage", () => {
  const label = formatCalendarDate("2026-06-24T00:00:00.000Z", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  assert.match(label, /Wednesday/);
  assert.match(label, /24/);
});

test("formatCalendarDate keeps Wednesday for UTC-noon storage", () => {
  const label = formatCalendarDate("2026-06-24T12:00:00.000Z", {
    weekday: "long",
  });
  assert.match(label, /Wednesday/);
});

test("dateKeyFromDate reads UTC calendar day from UTC noon Date", () => {
  assert.equal(dateKeyFromDate(dateKeyToUtcNoonDate("2026-06-24")), "2026-06-24");
});

test("dateKeyToLocalNoonDate preserves civil day for display", () => {
  const d = dateKeyToLocalNoonDate("2026-06-24");
  assert.equal(d.getDay(), 3);
});
