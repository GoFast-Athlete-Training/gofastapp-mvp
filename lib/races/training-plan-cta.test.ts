import assert from "node:assert/strict";
import test from "node:test";
import { trainingPlanCtaForRace } from "@/lib/races/training-plan-cta";

test("trainingPlanCtaForRace routes existing plan to Training Hub", () => {
  const cta = trainingPlanCtaForRace({
    athleteRaceId: "ar-1",
    trainingPlanId: "tp-1",
    goalTime: "3:30:00",
    myRaceHref: "/myrace/boston",
  });
  assert.equal(cta.href, "/training");
  assert.match(cta.label, /View plan/i);
});

test("trainingPlanCtaForRace offers Add a plan when goal time but no plan", () => {
  const cta = trainingPlanCtaForRace({
    athleteRaceId: "ar-1",
    trainingPlanId: null,
    goalTime: "3:30:00",
    myRaceHref: "/myrace/boston",
  });
  assert.equal(cta.href, "/training-setup?athleteRaceId=ar-1");
  assert.equal(cta.label, "Add a plan");
});
