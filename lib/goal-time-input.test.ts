import assert from "node:assert/strict";
import test from "node:test";
import { validateAndAssembleGoalTime } from "./goal-time-input";

const marathonCtx = { distanceLabel: "Marathon", distanceMeters: 42195 };

test("validateAndAssembleGoalTime rejects MM:SS-only input for marathon", () => {
  const result = validateAndAssembleGoalTime(marathonCtx, "", "2", "59");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /hours, minutes, and seconds/i);
  }
});

test("validateAndAssembleGoalTime accepts H:MM:SS for marathon", () => {
  const result = validateAndAssembleGoalTime(marathonCtx, "2", "59", "00");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.goalTime, "02:59:00");
  }
});

test("validateAndAssembleGoalTime accepts MM:SS for 5K", () => {
  const result = validateAndAssembleGoalTime(
    { distanceLabel: "5K", distanceMeters: 5000 },
    "",
    "22",
    "30"
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.goalTime, "22:30");
  }
});
