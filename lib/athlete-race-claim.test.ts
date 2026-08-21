import assert from "node:assert/strict";
import test from "node:test";
import {
  serializeAthleteRaceClaimResponse,
  type AthleteRaceClaimResult,
} from "@/lib/athlete-race-claim";
import {
  filterAthleteRacesInPlanWindow,
  filterSignupsInPlanWindow,
  mapAthleteRaceToCalendarRow,
  type HydratedRaceCalendarAthleteRace,
} from "@/lib/training/race-calendar-hydrate";

const sampleAthleteRace = {
  id: "ar-1",
  athleteId: "ath-1",
  raceRegistryId: "reg-1",
  name: "Test Marathon",
  raceDate: new Date("2026-10-24T00:00:00.000Z"),
  distanceMeters: 42195,
  distanceLabel: "Marathon",
  city: "Arlington",
  state: "VA",
  slug: "test-marathon",
  logoUrl: null,
  selfDeclaredAt: new Date(),
  notifyEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  race_registry: null,
};

test("serializeAthleteRaceClaimResponse exposes athleteRace and signup alias", () => {
  const result: AthleteRaceClaimResult = {
    athleteRace: sampleAthleteRace,
    planImpact: { affectsPlan: false, planId: null, weekNumber: null },
    impactPreview: null,
  };

  const body = serializeAthleteRaceClaimResponse(result);
  assert.equal(body.athleteRace.id, "ar-1");
  assert.equal(body.signup.id, "ar-1");
  assert.deepEqual(body.signup, body.athleteRace);
});

test("repeated claim responses reuse the same athleteRaceId", () => {
  const first = serializeAthleteRaceClaimResponse({
    athleteRace: sampleAthleteRace,
    planImpact: { affectsPlan: false, planId: null, weekNumber: null },
    impactPreview: null,
  });
  const second = serializeAthleteRaceClaimResponse({
    athleteRace: { ...sampleAthleteRace, updatedAt: new Date() },
    planImpact: { affectsPlan: false, planId: null, weekNumber: null },
    impactPreview: null,
  });
  assert.equal(first.athleteRace.id, second.athleteRace.id);
});

test("mapAthleteRaceToCalendarRow exposes goal fields on athlete race row", () => {
  const row = mapAthleteRaceToCalendarRow(
    {
      id: "ar-goal",
      raceRegistryId: "reg-goal",
      name: "Goal Half",
      raceDate: new Date("2026-10-24T00:00:00.000Z"),
      distanceLabel: "Half Marathon",
      distanceMeters: 21097,
      city: null,
      state: null,
      slug: null,
      logoUrl: null,
      goalTime: "1:45:00",
      goalName: "Sub-1:45",
    },
    new Date("2026-10-24T00:00:00.000Z"),
    "ar-goal"
  );

  assert.equal(row.athleteRaceId, "ar-goal");
  assert.equal(row.goalTime, "1:45:00");
  assert.equal(row.goalName, "Sub-1:45");
  assert.equal(row.hasGoal, true);
  assert.equal(row.isPlanTarget, true);
  assert.equal(row.positionRelativeToPlanRace, "ON");
});

test("filterAthleteRacesInPlanWindow keeps races between start and terminal inclusive", () => {
  const athleteRaces: HydratedRaceCalendarAthleteRace[] = [
    {
      athleteRaceId: "s1",
      raceRegistryId: "early",
      goalTime: null,
      goalName: null,
      hasGoal: false,
      isPlanTarget: false,
      positionRelativeToPlanRace: "BEFORE",
      race: {
        id: "early",
        slug: null,
        name: "Early 10K",
        distanceLabel: "10K",
        distanceMeters: 10000,
        raceDate: "2026-06-01T00:00:00.000Z",
        city: null,
        state: null,
        logoUrl: null,
      },
    },
    {
      athleteRaceId: "s2",
      raceRegistryId: "primary",
      goalTime: "3:30:00",
      goalName: "Goal Marathon",
      hasGoal: true,
      isPlanTarget: true,
      positionRelativeToPlanRace: "ON",
      race: {
        id: "primary",
        slug: null,
        name: "Goal Marathon",
        distanceLabel: "Marathon",
        distanceMeters: 42195,
        raceDate: "2026-10-24T00:00:00.000Z",
        city: null,
        state: null,
        logoUrl: null,
      },
    },
  ];

  const inWindow = filterAthleteRacesInPlanWindow(
    athleteRaces,
    new Date("2026-05-20T00:00:00.000Z"),
    new Date("2026-10-24T00:00:00.000Z")
  );
  assert.deepEqual(inWindow.map((s) => s.athleteRaceId), ["s1", "s2"]);

  const compat = filterSignupsInPlanWindow(
    athleteRaces.map((r) => ({ ...r, goalId: r.hasGoal ? r.athleteRaceId : null })),
    new Date("2026-05-20T00:00:00.000Z"),
    new Date("2026-10-24T00:00:00.000Z")
  );
  assert.deepEqual(compat.map((s) => s.athleteRaceId), ["s1", "s2"]);
});
