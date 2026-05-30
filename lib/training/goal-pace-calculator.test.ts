import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPaceMinSec,
  isPlausibleGoalPaceSecPerMile,
  resolveGoalRacePace,
  resolveRaceDistanceMiles,
  resolveRacePaceSecondsPerMileForPlan,
} from "./goal-pace-calculator";

const MCM_METERS = 42195;

test("isPlausibleGoalPaceSecPerMile rejects finish-time fragments stored as pace", () => {
  assert.equal(isPlausibleGoalPaceSecPerMile(57 * 60 + 37), false);
  assert.equal(isPlausibleGoalPaceSecPerMile(412), true);
});

test("resolveRaceDistanceMiles uses race_registry distanceMeters for MCM", () => {
  const miles = resolveRaceDistanceMiles({ distanceMeters: MCM_METERS });
  assert.ok(miles != null);
  assert.ok(Math.abs(miles! - 26.21875) < 0.01);
});

test("resolveGoalRacePace derives marathon pace from 2:59:00 at 42195m", () => {
  const resolved = resolveGoalRacePace({
    goalTime: "2:59:00",
    dbGoalRacePaceSecPerMile: null,
    planGoalRacePace: null,
    distanceMeters: MCM_METERS,
    distanceLabel: "Marathon",
  });
  assert.equal(resolved.source, "derived_from_goal_time");
  assert.ok(resolved.goalPaceSecPerMile != null);
  assert.ok(resolved.goalPaceSecPerMile! >= 400 && resolved.goalPaceSecPerMile! <= 430);
  assert.equal(resolved.goalPaceDisplay, formatPaceMinSec(resolved.goalPaceSecPerMile!));
});

test("resolveGoalRacePace ignores bogus 57:37 plan cache and derives from goal time", () => {
  const resolved = resolveGoalRacePace({
    goalTime: "2:59:00",
    dbGoalRacePaceSecPerMile: null,
    planGoalRacePace: "57:37",
    distanceMeters: MCM_METERS,
    distanceLabel: "Marathon",
  });
  assert.equal(resolved.source, "derived_from_goal_time");
  assert.ok(resolved.goalPaceSecPerMile != null);
  assert.ok(resolved.goalPaceSecPerMile! >= 400 && resolved.goalPaceSecPerMile! <= 430);
});

test("resolveGoalRacePace ignores implausible db goal pace and repairs from goal time", () => {
  const resolved = resolveGoalRacePace({
    goalTime: "2:59:00",
    dbGoalRacePaceSecPerMile: 57 * 60 + 37,
    planGoalRacePace: "57:37",
    distanceMeters: MCM_METERS,
    distanceLabel: "Marathon",
  });
  assert.equal(resolved.source, "derived_from_goal_time");
  assert.ok(resolved.goalPaceSecPerMile != null);
  assert.ok(resolved.goalPaceSecPerMile! >= 400 && resolved.goalPaceSecPerMile! <= 430);
});

test("resolveGoalRacePace prefers plausible db goal pace when aligned with derivation", () => {
  const derived = resolveGoalRacePace({
    goalTime: "2:59:00",
    distanceMeters: MCM_METERS,
  });
  assert.ok(derived.goalPaceSecPerMile != null);

  const resolved = resolveGoalRacePace({
    goalTime: "2:59:00",
    dbGoalRacePaceSecPerMile: derived.goalPaceSecPerMile,
    planGoalRacePace: "57:37",
    distanceMeters: MCM_METERS,
  });
  assert.equal(resolved.source, "db_goal_pace");
  assert.equal(resolved.goalPaceSecPerMile, derived.goalPaceSecPerMile);
});

test("resolveRacePaceSecondsPerMileForPlan legacy wrapper matches canonical resolver", () => {
  const spm = resolveRacePaceSecondsPerMileForPlan({
    goalRacePace: "57:37",
    goalRaceTime: "2:59:00",
    raceDistanceMiles: 26.21875,
  });
  assert.ok(spm != null);
  assert.ok(spm! >= 400 && spm! <= 430);
});

test("resolveRacePaceSecondsPerMileForPlan derives marathon pace from goal time when plan cache is wrong", () => {
  const spm = resolveRacePaceSecondsPerMileForPlan({
    goalRacePace: "57:37",
    goalRaceTime: "3:57:37",
    raceDistanceMiles: 26.21875,
  });
  assert.ok(spm != null);
  assert.ok(spm! >= 480 && spm! <= 600);
});
