import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyMileageTargetsByWeek } from "@/lib/training/build-weekly-mileage-curve";

test("build weeks stay at athlete weekly goal", () => {
  const map = buildWeeklyMileageTargetsByWeek({
    totalWeeks: 12,
    taperStartWeekNumber: 11,
    peakWeekNumber: 10,
    athleteStartMiles: 42,
    presetMinMiles: 45,
    presetPeakMiles: 42,
    taperWeeks: null,
    raceWeek: null,
  });

  assert.equal(map.get(1), 42);
  assert.equal(map.get(10), 42);
  assert.equal(map.get(5), 42);
});

test("hold weeks stay at the athlete and the peak block ramps to peak volume", () => {
  const map = buildWeeklyMileageTargetsByWeek({
    totalWeeks: 18,
    taperStartWeekNumber: 17,
    peakWeekNumber: 16,
    athleteStartMiles: 42,
    presetMinMiles: 40,
    presetPeakMiles: 55,
    taperWeeks: null,
    raceWeek: null,
    holdWeekNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
    holdWeeklyMiles: 42,
    rampStartWeekNumber: 9,
  });

  assert.equal(map.get(1), 42);
  assert.equal(map.get(8), 42);
  const rampMid = map.get(12);
  assert.ok(rampMid != null && rampMid > 42 && rampMid < 55);
  assert.equal(map.get(16), 55);
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
