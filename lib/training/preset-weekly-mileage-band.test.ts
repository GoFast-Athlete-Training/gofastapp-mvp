import test from "node:test";
import assert from "node:assert/strict";
import {
  clampWeeklyMilesToPresetBand,
  presetWeeklyMilesBand,
  weeklyMileageTargetWithinPresetBand,
} from "./preset-weekly-mileage-band";

test("clampWeeklyMilesToPresetBand lifts below preset min", () => {
  const band = presetWeeklyMilesBand({ minWeeklyMiles: 42, maxWeeklyMiles: 50 });
  assert.equal(clampWeeklyMilesToPresetBand(34, band), 42);
});

test("weeklyMileageTargetWithinPresetBand rejects out of band", () => {
  const band = presetWeeklyMilesBand({ minWeeklyMiles: 42, maxWeeklyMiles: 50 });
  assert.equal(weeklyMileageTargetWithinPresetBand(34, band), false);
  assert.equal(weeklyMileageTargetWithinPresetBand(45, band), true);
});
