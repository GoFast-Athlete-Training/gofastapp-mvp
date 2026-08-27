import assert from "node:assert/strict";
import test from "node:test";
import { resolveGoalRaceMetersInput } from "./resolve-goal-race-meters";

test("resolveGoalRaceMetersInput uses athlete snapshot meters first", () => {
  const r = resolveGoalRaceMetersInput({
    id: "ar-1",
    name: "Boulderthon Marathon",
    distanceMeters: 42195,
    distanceLabel: "Marathon",
    race_registry: { distanceMeters: null, distanceLabel: null },
  });
  assert.equal(r.meters, 42195);
  assert.equal(r.label, "Marathon");
});

test("resolveGoalRaceMetersInput falls back to registry meters", () => {
  const r = resolveGoalRaceMetersInput({
    id: "ar-1",
    name: "Boulderthon Marathon",
    distanceMeters: null,
    distanceLabel: null,
    race_registry: { distanceMeters: 42195, distanceLabel: "Marathon" },
  });
  assert.equal(r.meters, 42195);
});

test("resolveGoalRaceMetersInput infers marathon from race name when meta missing", () => {
  const r = resolveGoalRaceMetersInput({
    id: "ar-1",
    name: "Boulderthon Marathon",
    distanceMeters: null,
    distanceLabel: null,
    race_registry: null,
  });
  assert.equal(r.meters, 42195);
  assert.equal(r.label, "Marathon");
});

test("resolveGoalRaceMetersInput returns null when distance truly unknown", () => {
  const r = resolveGoalRaceMetersInput({
    id: "ar-1",
    name: "Mystery Fun Run",
    distanceMeters: null,
    distanceLabel: null,
    race_registry: null,
  });
  assert.equal(r.meters, null);
});
