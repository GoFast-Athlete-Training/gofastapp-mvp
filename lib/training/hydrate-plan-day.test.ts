import assert from "node:assert/strict";
import test from "node:test";
import type { PlanDayCard } from "./fetch-plan-week-client";
import {
  detailIdForHydrated,
  hydratePlanButSwapIfExecuted,
  matchTargetIdForHydrated,
  prescribeIdForHydrated,
} from "./hydrate-plan-day";

function day(partial: Partial<PlanDayCard> & Pick<PlanDayCard, "dateKey">): PlanDayCard {
  return {
    plannedWorkoutId: null,
    workoutId: null,
    date: partial.dateKey,
    title: "Easy Run",
    workoutType: "Easy",
    phase: "base",
    estimatedDistanceInMeters: 5000,
    matchedActivityId: null,
    skippedAt: null,
    skipReason: null,
    actualDistanceMeters: null,
    actualAvgPaceSecPerMile: null,
    actualAverageHeartRate: null,
    actualDurationSeconds: null,
    ...partial,
  };
}

test("planned only — never-done Saturday", () => {
  const result = hydratePlanButSwapIfExecuted(
    day({ dateKey: "2026-03-14", plannedWorkoutId: "plan-1" })
  );
  assert.ok(result);
  assert.equal(result.kind, "planned");
  if (result.kind === "planned") {
    assert.equal(result.plannedWorkoutId, "plan-1");
  }
});

test("executed — same-id spawn (workouts.id = planned_workouts.id)", () => {
  const result = hydratePlanButSwapIfExecuted(
    day({
      dateKey: "2026-03-14",
      plannedWorkoutId: "plan-1",
      workoutId: "plan-1",
      matchedActivityId: "act-1",
    })
  );
  assert.ok(result);
  assert.equal(result.kind, "executed");
  if (result.kind === "executed") {
    assert.equal(result.workoutId, "plan-1");
    assert.equal(result.plannedWorkoutId, "plan-1");
    assert.equal(detailIdForHydrated(result), "plan-1");
  }
});

test("executed — legacy FK spawn (different instance id)", () => {
  const result = hydratePlanButSwapIfExecuted(
    day({
      dateKey: "2026-03-14",
      plannedWorkoutId: "plan-1",
      workoutId: "inst-1",
      matchedActivityId: "act-1",
    })
  );
  assert.ok(result);
  assert.equal(result.kind, "executed");
  if (result.kind === "executed") {
    assert.equal(result.workoutId, "inst-1");
    assert.equal(result.plannedWorkoutId, "plan-1");
  }
});

test("no ids — rest or unmaterialized day", () => {
  assert.equal(hydratePlanButSwapIfExecuted(day({ dateKey: "2026-03-14" })), null);
});

test("match and detail ids follow kind", () => {
  const planned = hydratePlanButSwapIfExecuted(
    day({ dateKey: "2026-03-14", plannedWorkoutId: "plan-1" })
  )!;
  assert.equal(matchTargetIdForHydrated(planned), "plan-1");
  assert.equal(detailIdForHydrated(planned), "plan-1");
  assert.equal(prescribeIdForHydrated(planned), "plan-1");

  const executed = hydratePlanButSwapIfExecuted(
    day({ dateKey: "2026-03-14", plannedWorkoutId: "plan-1", workoutId: "inst-1" })
  )!;
  assert.equal(matchTargetIdForHydrated(executed), "inst-1");
  assert.equal(detailIdForHydrated(executed), "inst-1");
  assert.equal(prescribeIdForHydrated(executed), "plan-1");
});
