import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicTrainingFor } from "@/lib/gofast-with-me/public-training-for";

const baseRace = {
  id: "ar-1",
  raceRegistryId: "rr-1",
  name: "Marine Corps Marathon",
  raceDate: new Date("2026-10-25T00:00:00.000Z"),
  city: "Arlington",
  state: "VA",
  distanceLabel: "Marathon",
  distanceMeters: 42195,
  slug: "marine-corps-marathon",
  logoUrl: null,
};

test("buildPublicTrainingFor returns primary race without goal fields", () => {
  const result = buildPublicTrainingFor({
    athleteRace: baseRace,
    publicPlans: [],
    isPrimaryRace: true,
  });
  assert.ok(result);
  assert.equal(result!.athleteRace.isPrimaryRace, true);
  assert.equal(result!.goal.name, "Marine Corps Marathon");
  assert.equal(result!.goal.goalTime, null);
  assert.equal(result!.publicPlan, null);
});

test("buildPublicTrainingFor returns null for non-primary race without goal", () => {
  const result = buildPublicTrainingFor({
    athleteRace: baseRace,
    publicPlans: [],
    isPrimaryRace: false,
  });
  assert.equal(result, null);
});

test("buildPublicTrainingFor includes public plan when present", () => {
  const result = buildPublicTrainingFor({
    athleteRace: { ...baseRace, goalTime: "2:59:00" },
    publicPlans: [
      {
        id: "plan-1",
        athleteRaceId: "ar-1",
        name: "MCM Build",
        publicSlug: "mcm-build",
        publicDescription: "18 weeks",
        totalWeeks: 18,
      },
    ],
    isPrimaryRace: true,
  });
  assert.ok(result?.publicPlan);
  assert.equal(result!.publicPlan!.slug, "mcm-build");
});
