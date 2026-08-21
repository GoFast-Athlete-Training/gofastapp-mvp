import assert from "node:assert/strict";
import test from "node:test";
import { pickHeroAthleteRace } from "@/lib/races/my-races-hero";

const upcoming = [
  { athleteRaceId: "boulder", raceDate: "2026-09-27T00:00:00.000Z" },
  { athleteRaceId: "mcm", raceDate: "2026-10-25T00:00:00.000Z" },
];

test("pickHeroAthleteRace prefers explicit primaryAthleteRaceId", () => {
  const hero = pickHeroAthleteRace({
    upcoming,
    primaryAthleteRaceId: "mcm",
    planAthleteRaceId: "boulder",
  });
  assert.equal(hero?.athleteRaceId, "mcm");
});

test("pickHeroAthleteRace falls back to plan FK when no primary", () => {
  const hero = pickHeroAthleteRace({
    upcoming,
    primaryAthleteRaceId: null,
    planAthleteRaceId: "mcm",
  });
  assert.equal(hero?.athleteRaceId, "mcm");
});

test("pickHeroAthleteRace falls back to nearest upcoming", () => {
  const hero = pickHeroAthleteRace({
    upcoming,
    primaryAthleteRaceId: null,
    planAthleteRaceId: null,
  });
  assert.equal(hero?.athleteRaceId, "boulder");
});
