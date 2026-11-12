import test from "node:test";
import assert from "node:assert/strict";
import {
  clampWeeklyMilesToPresetBand,
  presetWeeklyMilesBand,
  weeklyMileageTargetWithinPresetBand,
} from "./preset-weekly-mileage-band";

test("clampWeeklyMilesToPresetBand only caps preset max", () => {
  const band = presetWeeklyMilesBand({ minWeeklyMiles: 42, maxWeeklyMiles: 50 });
  assert.equal(clampWeeklyMilesToPresetBand(34, band), 34);
  assert.equal(clampWeeklyMilesToPresetBand(52, band), 50);
});

test("weeklyMileageTargetWithinPresetBand allows below preset min", () => {
  const band = presetWeeklyMilesBand({ minWeeklyMiles: 42, maxWeeklyMiles: 50 });
  assert.equal(weeklyMileageTargetWithinPresetBand(34, band), true);
  assert.equal(weeklyMileageTargetWithinPresetBand(45, band), true);
  assert.equal(weeklyMileageTargetWithinPresetBand(55, band), false);
});
