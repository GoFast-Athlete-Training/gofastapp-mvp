import assert from "node:assert/strict";
import test from "node:test";
import { splitPlanWeekPhases } from "@/lib/training/plan-week-phase-split";

test("two-week plan: one taper week and race week, empty build", () => {
  const s = splitPlanWeekPhases(2);
  assert.deepEqual(s.buildWeekNumbers, []);
  assert.deepEqual(s.taperWeekNumbers, [1]);
  assert.equal(s.raceWeekNumber, 2);
  assert.equal(s.taperStartWeekNumber, 1);
  assert.equal(s.peakWeekNumber, null);
});

test("three-week plan: two taper weeks and race week, empty build", () => {
  const s = splitPlanWeekPhases(3);
  assert.deepEqual(s.buildWeekNumbers, []);
  assert.deepEqual(s.taperWeekNumbers, [1, 2]);
  assert.equal(s.raceWeekNumber, 3);
  assert.equal(s.taperStartWeekNumber, 1);
});

test("sixteen-week plan: thirteen build, two taper, one race", () => {
  const s = splitPlanWeekPhases(16);
  assert.deepEqual(s.buildWeekNumbers, Array.from({ length: 13 }, (_, i) => i + 1));
  assert.deepEqual(s.taperWeekNumbers, [14, 15]);
  assert.equal(s.raceWeekNumber, 16);
  assert.equal(s.taperStartWeekNumber, 14);
  assert.equal(s.peakWeekNumber, 13);
});

test("single-week plan: race week only", () => {
  const s = splitPlanWeekPhases(1);
  assert.deepEqual(s.buildWeekNumbers, []);
  assert.deepEqual(s.taperWeekNumbers, []);
  assert.equal(s.raceWeekNumber, 1);
  assert.equal(s.taperStartWeekNumber, 2);
});
