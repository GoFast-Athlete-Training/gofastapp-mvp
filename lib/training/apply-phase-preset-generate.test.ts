import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPhaseTaperLongRunMiles,
  applyPhaseTaperWeekTotalCaps,
  ensureTaperLongRunDays,
} from "@/lib/training/apply-phase-preset-generate";
import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";

function taperOnlySchedule(): PlanWeekSchedule[] {
  return [
    {
      weekNumber: 1,
      days: [
        { dow: 2, workoutType: "Tempo", miles: 6, catalogueWorkoutId: "t1", planCycleIndex: 0 },
        { dow: 4, workoutType: "Intervals", miles: 5, catalogueWorkoutId: "i1", planCycleIndex: 0 },
        { dow: 1, workoutType: "Easy", miles: 4, catalogueWorkoutId: "e1", planCycleIndex: null },
        { dow: 3, workoutType: "Easy", miles: 4, catalogueWorkoutId: "e1", planCycleIndex: null },
      ],
    },
    {
      weekNumber: 2,
      days: [
        { dow: 2, workoutType: "Tempo", miles: 5, catalogueWorkoutId: "t1", planCycleIndex: 0 },
        { dow: 6, workoutType: "Easy", miles: 3, catalogueWorkoutId: "e1", planCycleIndex: null },
      ],
    },
    {
      weekNumber: 3,
      days: [{ dow: 7, workoutType: "Race", miles: 26.2, catalogueWorkoutId: null, planCycleIndex: null }],
    },
  ];
}

test("taper caps only: ensure LR day then set cap; week total trimmed; hard days remain", () => {
  const schedule = taperOnlySchedule();
  const taperWeeks = [
    { weekIndex: 1, totalMilesCap: 40, longRunCapMiles: 12, pins: [] },
    { weekIndex: 2, totalMilesCap: 30, longRunCapMiles: 8, pins: [] },
  ];
  ensureTaperLongRunDays({
    planSchedule: schedule,
    totalWeeks: 3,
    taperWeeks,
    preferredLongRunDow: 6,
    longRunPositions: [{ cyclePosition: 0, catalogueWorkoutId: "lr1", distributionWeight: 1 }],
  });
  applyPhaseTaperLongRunMiles({
    planSchedule: schedule,
    totalWeeks: 3,
    taperWeeks,
  });
  applyPhaseTaperWeekTotalCaps({
    planSchedule: schedule,
    totalWeeks: 3,
    taperWeeks,
  });

  const w1 = schedule.find((w) => w.weekNumber === 1)!;
  assert.ok(w1.days.some((d) => d.workoutType === "Tempo"));
  assert.ok(w1.days.some((d) => d.workoutType === "Intervals"));
  const lr = w1.days.find((d) => d.workoutType === "LongRun");
  assert.ok(lr);
  assert.equal(lr!.miles, 12);
  const sum1 = w1.days.reduce((s, d) => s + d.miles, 0);
  assert.ok(sum1 <= 40.1);

  const w2 = schedule.find((w) => w.weekNumber === 2)!;
  assert.ok(w2.days.some((d) => d.workoutType === "Tempo"));
  const lr2 = w2.days.find((d) => d.workoutType === "LongRun");
  assert.equal(lr2?.miles, 8);
});
