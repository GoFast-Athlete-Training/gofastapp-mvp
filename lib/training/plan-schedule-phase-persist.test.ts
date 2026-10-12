import assert from "node:assert/strict";
import test from "node:test";
import {
  mergePlanSchedulePhaseSlices,
  slicePlanScheduleByPhases,
} from "@/lib/training/plan-schedule-phase-persist";
import { splitPlanWeekPhases } from "@/lib/training/plan-week-phase-split";
import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";

test("slice and merge round-trip for sixteen-week plan", () => {
  const split = splitPlanWeekPhases(16);
  const schedule: PlanWeekSchedule[] = Array.from({ length: 16 }, (_, i) => ({
    weekNumber: i + 1,
    days: [{ dow: 6, workoutType: "LongRun", miles: 10, catalogueWorkoutId: null, planCycleIndex: null }],
  }));
  const slices = slicePlanScheduleByPhases(schedule, split);
  assert.equal(slices.build.length, 13);
  assert.equal(slices.taper.length, 2);
  assert.equal(slices.raceWeek.length, 1);
  const merged = mergePlanSchedulePhaseSlices(slices);
  assert.equal(merged.length, 16);
  assert.deepEqual(
    merged.map((w) => w.weekNumber),
    Array.from({ length: 16 }, (_, i) => i + 1),
  );
});
