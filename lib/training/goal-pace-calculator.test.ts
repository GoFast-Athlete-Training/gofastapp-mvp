import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPaceMinSec,
  goalPaceSecondsPerMileFromPlan,
  isPlausibleGoalPaceSecPerMile,
  resolveGoalRacePace,
  resolveRaceDistanceMiles,
  resolveRacePaceSecondsPerMileForPlan,
} from "./goal-pace-calculator";
import { goalPaceSecondsPerMileFromRaceDistance } from "@/lib/workout-generator/pace-calculator";

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

const TEN_MILE_METERS = 10 * 1609.344;

test("goal pace for 10-mile race uses actual miles not 10K snap", () => {
  const spm = goalPaceSecondsPerMileFromPlan("1:09:00", 10);
  assert.equal(spm, 414);
  assert.equal(formatPaceMinSec(spm!), "6:54");
});

test("goal pace for 10K at same finish time stays on 10K distance", () => {
  const spm = goalPaceSecondsPerMileFromRaceDistance(69 * 60, 6.21371);
  assert.equal(spm, 666);
  assert.equal(formatPaceMinSec(spm), "11:06");
});

test("resolveGoalRacePace rejects stale 10K pace when Ten-Miler name implies 10 miles", () => {
  const resolved = resolveGoalRacePace({
    goalTime: "1:09:00",
    dbGoalRacePaceSecPerMile: 666,
    distanceMeters: 10000,
    distanceLabel: "10 Mile",
    raceName: "Army Ten-Miler",
  });
  assert.equal(resolved.source, "derived_from_goal_time");
  assert.equal(resolved.goalPaceSecPerMile, 414);
});

test("resolveGoalRacePace derives 6:54/mi for Army Ten-Miler style 10 miles at 1:09:00", () => {
  const resolved = resolveGoalRacePace({
    goalTime: "1:09:00",
    distanceMeters: TEN_MILE_METERS,
    distanceLabel: "10 Mile",
  });
  assert.equal(resolved.source, "derived_from_goal_time");
  assert.equal(resolved.goalPaceSecPerMile, 414);
  assert.equal(resolved.goalPaceDisplay, "6:54");
});

test("resolveGoalRacePace derives ~6:58/mi for MCM 3:02:30", () => {
  const resolved = resolveGoalRacePace({
    goalTime: "3:02:30",
    distanceMeters: MCM_METERS,
    distanceLabel: "Marathon",
  });
  assert.equal(resolved.source, "derived_from_goal_time");
  assert.ok(resolved.goalPaceSecPerMile != null);
  assert.ok(resolved.goalPaceSecPerMile! >= 415 && resolved.goalPaceSecPerMile! <= 425);
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
