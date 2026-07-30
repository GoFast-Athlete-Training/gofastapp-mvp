import { describe, expect, it } from "vitest";
import {
  buildDeterministicPublicPlanDescriptionFallback,
  buildPublicPlanDescriptionFacts,
  summarizePlanScheduleForDescription,
} from "./draft-public-plan-description-facts";

describe("summarizePlanScheduleForDescription", () => {
  it("counts quality sessions and long runs from structured weeks", () => {
    const summary = summarizePlanScheduleForDescription([
      {
        weekNumber: 1,
        days: [
          { dow: 2, workoutType: "Tempo", miles: 6, catalogueWorkoutId: null, planCycleIndex: 0 },
          { dow: 4, workoutType: "Intervals", miles: 5, catalogueWorkoutId: null, planCycleIndex: 0 },
          { dow: 6, workoutType: "LongRun", miles: 14, catalogueWorkoutId: null, planCycleIndex: 0 },
        ],
      },
      {
        weekNumber: 2,
        days: [
          { dow: 2, workoutType: "Tempo", miles: 6, catalogueWorkoutId: null, planCycleIndex: 1 },
          { dow: 6, workoutType: "LongRun", miles: 16, catalogueWorkoutId: null, planCycleIndex: 1 },
        ],
      },
    ]);

    expect(summary.weekCount).toBe(2);
    expect(summary.qualitySessionsPerWeek).toBe(1.5);
    expect(summary.weeksWithLongRun).toBe(2);
    expect(summary.distinctCycleSlots).toBe(2);
  });
});

describe("buildDeterministicPublicPlanDescriptionFallback", () => {
  it("mentions race, weeks, goal, and quality rhythm when facts exist", () => {
    const facts = buildPublicPlanDescriptionFacts({
      raceName: "Boston Marathon",
      raceDistanceLabel: "26.2 mi",
      goalRaceTime: "3:05:00",
      totalWeeks: 18,
      athleteFirstName: "Alex",
      planSchedule: [
        {
          weekNumber: 1,
          days: [
            { dow: 2, workoutType: "Tempo", miles: 6, catalogueWorkoutId: null, planCycleIndex: 0 },
            { dow: 6, workoutType: "LongRun", miles: 14, catalogueWorkoutId: null, planCycleIndex: 0 },
          ],
        },
      ],
    });

    const text = buildDeterministicPublicPlanDescriptionFallback(facts);
    expect(text).toContain("Boston Marathon");
    expect(text).toContain("18-week");
    expect(text).toContain("3:05:00");
    expect(text).toContain("quality session");
  });
});
