import assert from "node:assert/strict";
import test from "node:test";
import { EASY_RUN_CONFIG_DEFAULTS } from "@/lib/training/easy-run-config";
import {
  distributeEasyMiles,
  easyFillCapacityMiles,
  isDeloadStyleWeek,
} from "@/lib/training/distribute-easy";
import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";

const baseCfg = { ...EASY_RUN_CONFIG_DEFAULTS };

function week(
  weekNumber: number,
  days: PlanWeekSchedule["days"]
): PlanWeekSchedule {
  return { weekNumber, days };
}

function runDistribute(
  schedule: PlanWeekSchedule[],
  weeklyMileageTarget: number,
  overrides: Partial<Parameters<typeof distributeEasyMiles>[0]> = {}
): PlanWeekSchedule[] {
  const copy = structuredClone(schedule);
  distributeEasyMiles({
    planSchedule: copy,
    weeklyMileageTarget,
    minWeeklyMiles: 25,
    raceDistanceMiles: 26.2,
    easyRunConfig: baseCfg,
    catalogueRowsById: new Map(),
    typicalWeekPreferredCount: 4,
    ...overrides,
  });
  return copy;
}

test("easy runs never exceed maxMiles when filling toward weekly target", () => {
  const schedule = [
    week(1, [
      { dow: 2, workoutType: "Tempo", miles: 6, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 4, workoutType: "Intervals", miles: 5, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 6, workoutType: "LongRun", miles: 12, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 5, workoutType: "Easy", miles: 0, catalogueWorkoutId: null, planCycleIndex: null },
    ]),
  ];

  const out = runDistribute(schedule, 45);
  const easy = out[0]!.days.find((d) => d.workoutType === "Easy")!;

  assert.ok(easy.miles <= baseCfg.maxMiles, `easy miles ${easy.miles} exceeded cap`);
  assert.ok(easy.miles <= 10);
});

test("insufficient easy capacity leaves week under target instead of breaking cap", () => {
  const schedule = [
    week(1, [
      { dow: 2, workoutType: "Tempo", miles: 6, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 4, workoutType: "Intervals", miles: 5, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 6, workoutType: "LongRun", miles: 12, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 3, workoutType: "Easy", miles: 0, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 5, workoutType: "Easy", miles: 0, catalogueWorkoutId: null, planCycleIndex: null },
    ]),
  ];

  const out = runDistribute(schedule, 45);
  const weekTotal = out[0]!.days.reduce((s, d) => s + d.miles, 0);
  const easyMiles = out[0]!.days
    .filter((d) => d.workoutType === "Easy")
    .map((d) => d.miles);

  assert.ok(weekTotal < 45 - 0.05, `expected under target, got ${weekTotal}`);
  for (const m of easyMiles) {
    assert.ok(m <= 10);
  }
});

test("deload-style week does not refill easy days toward weekly target", () => {
  const schedule = [
    week(1, [
      { dow: 2, workoutType: "Tempo", miles: 6, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 4, workoutType: "Intervals", miles: 5, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 6, workoutType: "LongRun", miles: 16, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 5, workoutType: "Easy", miles: 0, catalogueWorkoutId: null, planCycleIndex: null },
    ]),
    week(2, [
      { dow: 2, workoutType: "Tempo", miles: 6, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 4, workoutType: "Intervals", miles: 5, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 6, workoutType: "LongRun", miles: 10, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 5, workoutType: "Easy", miles: 0, catalogueWorkoutId: null, planCycleIndex: null },
    ]),
  ];

  const out = runDistribute(schedule, 45);
  const week1Total = out[0]!.days.reduce((s, d) => s + d.miles, 0);
  const week2Easy = out[1]!.days.find((d) => d.workoutType === "Easy")!;
  const week2Total = out[1]!.days.reduce((s, d) => s + d.miles, 0);

  assert.ok(week1Total > 30);
  assert.equal(week2Easy.miles, baseCfg.standardMiles);
  assert.ok(week2Total < 45 - 0.05);
  assert.ok(isDeloadStyleWeek({ weekTotalMiles: week2Total, previousWeekTotalMiles: week1Total }));
});

test("easyFillCapacityMiles sums headroom before max", () => {
  assert.equal(
    easyFillCapacityMiles([{ miles: 6 }, { miles: 9.5 }], 10),
    4.5
  );
});

test("isDeloadStyleWeek false when volume is steady", () => {
  assert.equal(isDeloadStyleWeek({ weekTotalMiles: 40, previousWeekTotalMiles: 42 }), false);
});
