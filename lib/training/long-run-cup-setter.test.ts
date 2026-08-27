import assert from "node:assert/strict";
import test from "node:test";
import { longRunCupSetter } from "./long-run-cup-setter";

test("longRunCupSetter full 4-week block at peak uses full cup", () => {
  const { poolMilesByCycle, weeksInCycle } = longRunCupSetter({
    totalWeeks: 4,
    peakLongRunPoolMiles: 70,
    fitnessPhase: "PEAK",
  });
  assert.deepEqual(weeksInCycle, [4]);
  assert.equal(poolMilesByCycle[0], 70);
});

test("longRunCupSetter equal weights yield ~17.5 mi Saturday from cup 70", () => {
  const { poolMilesByCycle } = longRunCupSetter({
    totalWeeks: 4,
    peakLongRunPoolMiles: 70,
    fitnessPhase: "PEAK",
  });
  assert.equal(poolMilesByCycle[0]! / 4, 17.5);
});

test("longRunCupSetter 5-week plan uses peak pool not stored base ghost", () => {
  const { poolMilesByCycle, weeksInCycle } = longRunCupSetter({
    totalWeeks: 5,
    peakLongRunPoolMiles: 70,
    fitnessPhase: "PEAK",
  });
  assert.deepEqual(weeksInCycle, [4, 1]);
  assert.equal(poolMilesByCycle[0], 70);
  assert.equal(poolMilesByCycle[1], 17.5);
});

test("longRunCupSetter N=2 no longer returns base+taper ghost pair", () => {
  const { poolMilesByCycle, nCycles } = longRunCupSetter({
    totalWeeks: 8,
    peakLongRunPoolMiles: 70,
    fitnessPhase: "PEAK",
  });
  assert.equal(nCycles, 2);
  assert.equal(poolMilesByCycle[0], 70);
  assert.equal(poolMilesByCycle[1], 70);
});

test("longRunCupSetter 2-week stub scales pool by weeks/4", () => {
  const { poolMilesByCycle, weeksInCycle } = longRunCupSetter({
    totalWeeks: 2,
    peakLongRunPoolMiles: 70,
    fitnessPhase: "PEAK",
  });
  assert.deepEqual(weeksInCycle, [2]);
  assert.equal(poolMilesByCycle[0], 35);
});

test("longRunCupSetter BASE ramps first build block below peak", () => {
  const peak = longRunCupSetter({
    totalWeeks: 12,
    peakLongRunPoolMiles: 70,
    fitnessPhase: "PEAK",
  });
  const base = longRunCupSetter({
    totalWeeks: 12,
    peakLongRunPoolMiles: 70,
    fitnessPhase: "BASE",
  });
  assert.ok(base.poolMilesByCycle[0]! < peak.poolMilesByCycle[0]!);
  assert.equal(peak.poolMilesByCycle[1], 70);
});

test("longRunCupSetter PEAK skips ramp on first block", () => {
  const { poolMilesByCycle } = longRunCupSetter({
    totalWeeks: 8,
    peakLongRunPoolMiles: 70,
    fitnessPhase: "PEAK",
  });
  assert.equal(poolMilesByCycle[0], 70);
});

test("longRunCupSetter throws when peak missing", () => {
  assert.throws(
    () =>
      longRunCupSetter({
        totalWeeks: 8,
        peakLongRunPoolMiles: 0,
      }),
    /peakLongRunPoolMiles/
  );
});

test("longRunCupSetter FINISH-scale peak ~30 proportions correctly", () => {
  const { poolMilesByCycle } = longRunCupSetter({
    totalWeeks: 4,
    peakLongRunPoolMiles: 30,
    fitnessPhase: "PEAK",
  });
  assert.equal(poolMilesByCycle[0], 30);
  assert.equal(poolMilesByCycle[0]! / 4, 7.5);
});
