import assert from "node:assert/strict";
import test from "node:test";
import { pickHeroAthleteRace } from "@/lib/races/my-races-hero";

const upcoming = [
  { athleteRaceId: "boulder", raceDate: "2026-09-27T00:00:00.000Z" },
  { athleteRaceId: "mcm", raceDate: "2026-10-25T00:00:00.000Z" },
];

test("pickHeroAthleteRace prefers active plan athleteRaceId", () => {
  const hero = pickHeroAthleteRace({
    upcoming,
    planAthleteRaceId: "mcm",
    goalAthleteRaceId: "boulder",
  });
  assert.equal(hero?.athleteRaceId, "mcm");
});

test("pickHeroAthleteRace falls back to goal bolt when no plan FK", () => {
  const hero = pickHeroAthleteRace({
    upcoming,
    planAthleteRaceId: null,
    goalAthleteRaceId: "boulder",
  });
  assert.equal(hero?.athleteRaceId, "boulder");
});

test("pickHeroAthleteRace falls back to nearest upcoming", () => {
  const hero = pickHeroAthleteRace({
    upcoming,
    planAthleteRaceId: null,
    goalAthleteRaceId: null,
  });
  assert.equal(hero?.athleteRaceId, "boulder");
});
