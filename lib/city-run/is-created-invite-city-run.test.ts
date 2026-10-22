import { describe, expect, it } from "vitest";
import { isCreatedInviteCityRun } from "./is-created-invite-city-run";

describe("isCreatedInviteCityRun", () => {
  const base = {
    plannedWorkoutId: null as string | null,
    workout: null as { planId: string | null } | null,
    planned_workouts: [] as Array<{ planId: string | null }>,
    plannedWorkout: null as { planId: string | null } | null,
  };

  it("allows athlete invite with run-scoped planned workout template", () => {
    expect(
      isCreatedInviteCityRun({
        ...base,
        plannedWorkoutId: "pw-1",
        plannedWorkout: { planId: null },
      }),
    ).toBe(true);
  });

  it("rejects training-plan prescribe via workout.planId", () => {
    expect(
      isCreatedInviteCityRun({
        ...base,
        workout: { planId: "plan-1" },
      }),
    ).toBe(false);
  });

  it("rejects training-plan rows on planned_workouts", () => {
    expect(
      isCreatedInviteCityRun({
        ...base,
        planned_workouts: [{ planId: "plan-1" }],
      }),
    ).toBe(false);
  });
});
