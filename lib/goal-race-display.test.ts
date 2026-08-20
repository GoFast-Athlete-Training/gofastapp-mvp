import assert from "node:assert/strict";
import test from "node:test";
import {
  goalRaceDisplayFromAthleteRace,
  goalRaceFromGoal,
  goalRaceRegistryId,
} from "@/lib/goal-race-display";
import { snapshotDataFromRegistry } from "@/lib/athlete-races-service";

const sampleAthleteRace = {
  id: "ar-1",
  raceRegistryId: "reg-mcm",
  name: "Marine Corps Marathon",
  raceDate: new Date("2026-10-25T00:00:00.000Z"),
  distanceMeters: 42195,
  distanceLabel: "Marathon",
  city: "Arlington",
  state: "VA",
  slug: "marine-corps-marathon",
  logoUrl: "https://cdn.example/mcm.png",
};

test("goalRaceRegistryId resolves from nested athlete_race only", () => {
  assert.equal(
    goalRaceRegistryId({ athlete_race: sampleAthleteRace }),
    "reg-mcm"
  );
  assert.equal(goalRaceRegistryId({ athlete_race: null }), null);
  assert.equal(goalRaceRegistryId({}), null);
});

test("goalRaceDisplayFromAthleteRace maps snapshot fields without registration URL", () => {
  const display = goalRaceDisplayFromAthleteRace(sampleAthleteRace);
  assert.deepEqual(display, {
    id: "reg-mcm",
    slug: "marine-corps-marathon",
    name: "Marine Corps Marathon",
    raceDate: sampleAthleteRace.raceDate,
    distanceLabel: "Marathon",
    distanceMeters: 42195,
    city: "Arlington",
    state: "VA",
    logoUrl: "https://cdn.example/mcm.png",
  });
  assert.equal("registrationUrl" in (display ?? {}), false);
});

test("goalRaceFromGoal returns null for raceless goals", () => {
  assert.equal(goalRaceFromGoal({ athlete_race: null }), null);
  assert.equal(goalRaceFromGoal(null), null);
});

test("snapshotDataFromRegistry copies slug and logoUrl at claim time", () => {
  const snap = snapshotDataFromRegistry({
    name: "Boulderthon",
    raceDate: new Date("2026-09-27T00:00:00.000Z"),
    distanceMeters: 21097,
    distanceLabel: "Half Marathon",
    city: "Boulder",
    state: "CO",
    slug: "boulderthon",
    logoUrl: "https://cdn.example/boulder.png",
  });
  assert.equal(snap.slug, "boulderthon");
  assert.equal(snap.logoUrl, "https://cdn.example/boulder.png");
  assert.equal("registrationUrl" in snap, false);
});
