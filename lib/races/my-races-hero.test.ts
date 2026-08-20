import assert from "node:assert/strict";
import test from "node:test";
import { pickHeroAthleteRace } from "@/lib/races/my-races-hero";

const boulder = {
  athleteRaceId: "boulder",
  raceDate: "2026-09-12T00:00:00.000Z",
};
const mcm = {
  athleteRaceId: "mcm",
  raceDate: "2026-10-24T00:00:00.000Z",
};

test("pickHeroAthleteRace prefers plan terminal over nearer upcoming race", () => {
  const hero = pickHeroAthleteRace({
    upcoming: [boulder, mcm],
    primaryPlanAthleteRaceId: "mcm",
    goalAthleteRaceId: null,
  });
  assert.equal(hero?.athleteRaceId, "mcm");
});

test("pickHeroAthleteRace uses goal bolt when no plan FK", () => {
  const hero = pickHeroAthleteRace({
    upcoming: [boulder, mcm],
    primaryPlanAthleteRaceId: null,
    goalAthleteRaceId: "mcm",
  });
  assert.equal(hero?.athleteRaceId, "mcm");
});

test("pickHeroAthleteRace falls back to nearest upcoming", () => {
  const hero = pickHeroAthleteRace({
    upcoming: [boulder, mcm],
    primaryPlanAthleteRaceId: null,
    goalAthleteRaceId: null,
  });
  assert.equal(hero?.athleteRaceId, "boulder");
});
