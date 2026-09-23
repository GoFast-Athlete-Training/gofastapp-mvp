import test from "node:test";
import assert from "node:assert/strict";
import { buildLongRunSchedule } from "./long-run-builder";

test("buildLongRunSchedule places peak on last build week when no room for cutback", () => {
  const rows = buildLongRunSchedule({
    totalWeeks: 8,
    peakLongRunMiles: 21,
    taperCalendarWeeks: 2,
    slots: [
      { cyclePosition: 0, slotMiles: 12 },
      { cyclePosition: 1, slotMiles: 12 },
      { cyclePosition: 2, slotMiles: 14 },
    ],
  });
  const peak = rows.find((r) => r.role === "peak");
  assert.ok(peak);
  assert.equal(peak!.miles, 21);
  assert.equal(rows.filter((r) => r.role === "cutback").length, 0);
});

test("buildLongRunSchedule includes cutback when enough build weeks", () => {
  const rows = buildLongRunSchedule({
    totalWeeks: 16,
    peakLongRunMiles: 22,
    taperCalendarWeeks: 2,
    slots: [
      { cyclePosition: 0, slotMiles: 12 },
      { cyclePosition: 1, slotMiles: 12 },
      { cyclePosition: 2, slotMiles: 14 },
      { cyclePosition: 3, slotMiles: 9, isCutback: true },
    ],
  });
  assert.ok(rows.some((r) => r.role === "cutback"));
  assert.ok(rows.some((r) => r.role === "peak" && r.miles === 22));
});
