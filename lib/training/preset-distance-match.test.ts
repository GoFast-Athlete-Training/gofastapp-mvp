import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeDistanceInput,
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
  assert.equal(resolveRaceDistanceLabel(null, "26.2 mi"), "Marathon");
  assert.equal(resolveRaceDistanceLabel(null, "Custom 10 miler"), null);
});

test("raceDistanceForPresetMatch uses athlete snapshot then registry", () => {
  const resolved = raceDistanceForPresetMatch({
    athleteRaceMeters: null,
    registryMeters: 42195,
    distanceLabel: null,
  });
  assert.equal(resolved.meters, 42195);
  assert.equal(resolved.label, "Marathon");
});

test("presetMatchesRaceDistance rejects labeled preset when meters unknown", () => {
  assert.equal(
    presetMatchesRaceDistance("Marathon", {
      athleteRaceMeters: null,
      registryMeters: null,
      distanceLabel: null,
    }),
    false
  );
});

test("presetMatchesRaceDistance does not match from race name alone", () => {
  assert.equal(
    presetMatchesRaceDistance("Marathon", {
      athleteRaceMeters: null,
      registryMeters: null,
      distanceLabel: null,
    }),
    false
  );
});

test("presetMatchesRaceDistance accepts any-distance preset when meters unknown", () => {
  assert.equal(
    presetMatchesRaceDistance(null, {
      athleteRaceMeters: null,
      registryMeters: null,
      distanceLabel: null,
    }),
    true
  );
});

test("presetMatchesRaceDistance matches on meters snap", () => {
  assert.equal(
    presetMatchesRaceDistance("Marathon", {
      athleteRaceMeters: 42195,
      registryMeters: null,
      distanceLabel: null,
    }),
    true
  );
  assert.equal(
    presetMatchesRaceDistance("Half Marathon", {
      athleteRaceMeters: 42195,
      registryMeters: null,
      distanceLabel: null,
    }),
    false
  );
});

test("normalizeDistanceInput converts 26.2 to Marathon meters", () => {
  const n = normalizeDistanceInput("26.2");
  assert.equal(n.label, "Marathon");
  assert.ok(n.meters != null && Math.abs(n.meters - 42195) <= 300);
});
