import assert from "node:assert/strict";
import test from "node:test";
import {
  presetMatchesRaceDistance,
  raceDistanceForPresetMatch,
  resolveRaceDistanceLabel,
  resolveRaceDistanceMeters,
} from "./preset-distance-match";

test("resolveRaceDistanceMeters prefers athlete snapshot over registry", () => {
  assert.equal(resolveRaceDistanceMeters(21098, 42195), 21098);
  assert.equal(resolveRaceDistanceMeters(null, 42195), 42195);
  assert.equal(resolveRaceDistanceMeters(undefined, null), null);
});

test("resolveRaceDistanceLabel snaps meters before label fallback", () => {
  assert.equal(resolveRaceDistanceLabel(42195, "Half Marathon"), "Marathon");
  assert.equal(resolveRaceDistanceLabel(null, "Half Marathon"), "Half Marathon");
  assert.equal(resolveRaceDistanceLabel(null, "Custom 10 miler"), null);
});

test("raceDistanceForPresetMatch uses athlete snapshot then label fallback", () => {
  const resolved = raceDistanceForPresetMatch({
    athleteRaceMeters: null,
    registryMeters: null,
    distanceLabel: "Marathon",
  });
  assert.equal(resolved.meters, null);
  assert.equal(resolved.label, "Marathon");
});

test("presetMatchesRaceDistance rejects labeled preset when distance unknown", () => {
  assert.equal(
    presetMatchesRaceDistance("Marathon", {
      athleteRaceMeters: null,
      registryMeters: null,
      distanceLabel: null,
    }),
    false
  );
});

test("presetMatchesRaceDistance accepts any-distance preset when distance unknown", () => {
  assert.equal(
    presetMatchesRaceDistance(null, {
      athleteRaceMeters: null,
      registryMeters: null,
      distanceLabel: null,
    }),
    true
  );
});

test("presetMatchesRaceDistance matches registry when athlete snapshot missing meters", () => {
  assert.equal(
    presetMatchesRaceDistance("Marathon", {
      athleteRaceMeters: null,
      registryMeters: 42195,
      distanceLabel: null,
    }),
    true
  );
});
