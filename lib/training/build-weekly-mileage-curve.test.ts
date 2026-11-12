import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyMileageTargetsByWeek } from "@/lib/training/build-weekly-mileage-curve";

test("build weeks climb from athlete 48 to preset peak 55 by peak week", () => {
  const map = buildWeeklyMileageTargetsByWeek({
    totalWeeks: 12,
    taperStartWeekNumber: 11,
    peakWeekNumber: 10,
    athleteStartMiles: 48,
    presetMinMiles: 45,
    presetPeakMiles: 55,
    taperWeeks: null,
    raceWeek: null,
  });

  assert.equal(map.get(1), 48);
  assert.equal(map.get(10), 55);
  const w5 = map.get(5);
  assert.ok(w5 != null && w5 > 48 && w5 < 55);
});

test("hold weeks stay flat before the 8-week ramp", () => {
  const map = buildWeeklyMileageTargetsByWeek({
    totalWeeks: 18,
    taperStartWeekNumber: 17,
    peakWeekNumber: 16,
    athleteStartMiles: 48,
    presetMinMiles: 45,
    presetPeakMiles: 60,
    taperWeeks: null,
    raceWeek: null,
    holdWeekNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
    holdWeeklyMiles: 50,
    rampStartWeekNumber: 9,
  });

  assert.equal(map.get(1), 50);
  assert.equal(map.get(8), 50);
  const rampMid = map.get(12);
  assert.ok(rampMid != null && rampMid > 50 && rampMid < 60);
  assert.equal(map.get(16), 60);
});

test("taper weeks use preset caps when set (no generic taper target)", () => {
  const map = buildWeeklyMileageTargetsByWeek({
    totalWeeks: 13,
    taperStartWeekNumber: 11,
    peakWeekNumber: 10,
    athleteStartMiles: 48,
    presetMinMiles: 45,
    presetPeakMiles: 55,
    taperWeeks: [
      { weekIndex: 1, totalMilesCap: 40, longRunCapMiles: 12, pins: [] },
      { weekIndex: 2, totalMilesCap: 30, longRunCapMiles: 8, pins: [] },
    ],
    raceWeek: null,
    taperWeekNumbers: [11, 12],
  });
  assert.equal(map.get(11), 40);
  assert.equal(map.get(12), 30);
});

test("foundation weekly map does not replace taper or race week", () => {
  const map = buildWeeklyMileageTargetsByWeek({
    totalWeeks: 13,
    taperStartWeekNumber: 11,
    peakWeekNumber: 10,
    athleteStartMiles: 22,
    presetMinMiles: 45,
    presetPeakMiles: 55,
    taperWeeks: [
      { weekIndex: 1, totalMilesCap: 40, longRunCapMiles: 12, pins: [] },
      { weekIndex: 2, totalMilesCap: 30, longRunCapMiles: 8, pins: [] },
    ],
    raceWeek: [{ weekIndex: 1, totalMilesCap: 18, longRunCapMiles: 6, pins: [] }],
    taperWeekNumbers: [11, 12],
    weeklyMilesByWeek: new Map([
      [1, 22],
      [10, 55],
    ]),
  });
  assert.equal(map.get(1), 22);
  assert.equal(map.get(10), 55);
  assert.equal(map.get(11), 40);
  assert.equal(map.get(12), 30);
  assert.equal(map.get(13), 18);
});
