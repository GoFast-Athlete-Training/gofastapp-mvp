import assert from "node:assert/strict";
import test from "node:test";
import { phaseWeekRowsFromLegacyTaper } from "@/lib/training/phase-week-pins";

test("phaseWeekRowsFromLegacyTaper prefers weekPins over legacy scalars", () => {
  const rows = phaseWeekRowsFromLegacyTaper({
    week1TotalMiles: 99,
    week1LongRunMiles: 99,
    week2TotalMiles: 88,
    week2LongRunMiles: 88,
    weekPins: [
      { weekIndex: 1, totalMilesCap: 40, longRunCapMiles: 12, pins: [] },
      { weekIndex: 2, totalMilesCap: 30, longRunCapMiles: 8, pins: [] },
    ],
  });
  assert.equal(rows[0]?.totalMilesCap, 40);
  assert.equal(rows[0]?.longRunCapMiles, 12);
  assert.equal(rows[1]?.totalMilesCap, 30);
});
