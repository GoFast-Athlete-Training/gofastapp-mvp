import assert from "node:assert/strict";
import test from "node:test";
import { pickHeroAthleteRace } from "@/lib/races/my-races-hero";

const upcoming = [
  { athleteRaceId: "boulder", raceDate: "2026-09-27T00:00:00.000Z" },
  { athleteRaceId: "mcm", raceDate: "2026-10-25T00:00:00.000Z" },
];

test("pickHeroAthleteRace prefers isPrimaryRace on the row", () => {
  const hero = pickHeroAthleteRace({
    upcoming: [
      { ...upcoming[0], trainingPlanId: "tp-1" },
      { ...upcoming[1], isPrimaryRace: true },
    ],
  });
  assert.equal(hero?.athleteRaceId, "mcm");
});

test("pickHeroAthleteRace falls back to row with trainingPlanId when no primary", () => {
  const hero = pickHeroAthleteRace({
    upcoming: [
      upcoming[0],
      { ...upcoming[1], trainingPlanId: "tp-9" },
    ],
  });
  assert.equal(hero?.athleteRaceId, "mcm");
});

test("pickHeroAthleteRace falls back to nearest upcoming", () => {
  const hero = pickHeroAthleteRace({ upcoming });
  assert.equal(hero?.athleteRaceId, "boulder");
});
