import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAlongWaySnaps,
  buildPlanRaceSnapshots,
} from "@/lib/training/plan-race-snapshots";

const mcm = {
  id: "ar-mcm",
  raceRegistryId: "reg-mcm",
  name: "Marine Corps Marathon",
  raceDate: new Date("2026-10-25T00:00:00.000Z"),
  distanceMeters: 42195,
  distanceLabel: "Marathon",
  city: "Arlington",
  state: "VA",
};

const boulder = {
  id: "ar-boulder",
  raceRegistryId: "reg-boulder",
  name: "Boulderthon",
  raceDate: new Date("2026-09-27T00:00:00.000Z"),
  distanceMeters: 21097,
  distanceLabel: "Half Marathon",
  city: "Boulder",
  state: "CO",
};

const planStart = new Date("2026-05-20T00:00:00.000Z");

test("MCM terminal includes Boulderthon in along-way window", () => {
  const snaps = buildPlanRaceSnapshots({
    mainRow: mcm,
    planStart,
    allAthleteRaces: [boulder, mcm],
  });
  assert.equal(snaps.athleteRaceMainSnap.sourceAthleteRaceId, "ar-mcm");
  assert.deepEqual(
    snaps.athleteRaceAlongWaySnaps.map((s) => s.sourceAthleteRaceId),
    ["ar-boulder"]
  );
});

test("Boulderthon terminal ignores MCM after terminal date", () => {
  const snaps = buildPlanRaceSnapshots({
    mainRow: boulder,
    planStart,
    allAthleteRaces: [boulder, mcm],
  });
  assert.equal(snaps.athleteRaceMainSnap.sourceAthleteRaceId, "ar-boulder");
  assert.equal(snaps.athleteRaceAlongWaySnaps.length, 0);
});

test("buildAlongWaySnaps respects includedAlongWayIds filter", () => {
  const along = buildAlongWaySnaps({
    planStart,
    terminalRaceDate: mcm.raceDate,
    terminalAthleteRaceId: mcm.id,
    allAthleteRaces: [boulder, mcm],
    includedAlongWayIds: new Set(),
  });
  assert.equal(along.length, 0);
});
