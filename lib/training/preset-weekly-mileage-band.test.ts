import test from "node:test";
import assert from "node:assert/strict";
import {
  clampWeeklyMilesToPresetBand,
  presetWeeklyMilesBand,
  weeklyMileageTargetWithinPresetBand,
  weeklyTargetOfframpMessage,
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

test("weeklyTargetOfframpMessage names the floor or the ceiling", () => {
  const band = presetWeeklyMilesBand({ minWeeklyMiles: 40, maxWeeklyMiles: 50 });
  assert.equal(
    weeklyTargetOfframpMessage(36, band),
    "This plan starts at 40 miles a week. Choose a higher target, or pick a different preset.",
  );
  assert.equal(
    weeklyTargetOfframpMessage(55, band),
    "This plan goes up to 50 miles a week. Choose a lower target, or pick a different preset.",
  );
  assert.equal(weeklyTargetOfframpMessage(45, band), null);
});
