import { describe, expect, it } from "vitest";
import {
  buildCustomWorkoutSnapshot,
  buildPreviewSnapshot,
} from "./public-training-plan-snapshots";

describe("public-training-plan-snapshots", () => {
  it("builds preview snapshot with custom workout markers", () => {
    const snapshot = buildPreviewSnapshot({
      plan: {
        name: "Chicago Marathon",
        totalWeeks: 16,
        phases: [{ name: "Base", startWeek: 1, endWeek: 8 }],
        planSchedule: [
          {
            weekNumber: 1,
            days: [
              { dow: 1, workoutType: "Easy", miles: 5, catalogueWorkoutId: "c1", planCycleIndex: null },
              { dow: 6, workoutType: "LongRun", miles: 12, catalogueWorkoutId: "c2", planCycleIndex: 0 },
            ],
          },
        ],
        weeklyMileageTarget: 45,
        currentWeeklyMileage: 40,
      },
      raceName: "Chicago Marathon",
      customWorkouts: [{ weekNumber: 1, dow: 6, title: "Leader long run variant" }],
    });

    expect(snapshot.planName).toBe("Chicago Marathon");
    expect(snapshot.phases).toHaveLength(1);
    expect(snapshot.sampleWeeks[0]?.days.some((d) => d.isCustom)).toBe(true);
    expect(snapshot.weeklyMileageRange).toEqual({ min: 40, max: 45 });
  });

  it("builds custom workout snapshot for adoption copy", () => {
    const snapshot = buildCustomWorkoutSnapshot([
      {
        id: "cw1",
        weekNumber: 3,
        dow: 2,
        title: "Hill repeats",
        description: "6 x 90s",
        workoutType: "Interval",
        content: { reps: 6 },
        leaderNotes: "Stay controlled",
      },
    ]);

    expect(snapshot.workouts).toHaveLength(1);
    expect(snapshot.workouts[0]?.sourceId).toBe("cw1");
    expect(snapshot.workouts[0]?.title).toBe("Hill repeats");
  });
});
