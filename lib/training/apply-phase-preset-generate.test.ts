import assert from "node:assert/strict";
import test from "node:test";
import {
  applyBuildPhaseLongRunMiles,
  applyPhaseTaperLongRunMiles,
  applyPhaseTaperWeekTotalCaps,
  applyRaceWeekSlotsFromPreset,
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

test("hold weeks use flat long run; ramp weeks climb in last 8 build weeks", () => {
  const schedule: PlanWeekSchedule[] = Array.from({ length: 16 }, (_, i) => ({
    weekNumber: i + 1,
    days: [{ dow: 6, workoutType: "LongRun", miles: 0, catalogueWorkoutId: "lr", planCycleIndex: 0 }],
  }));

  applyBuildPhaseLongRunMiles({
    planSchedule: schedule,
    taperStartWeekNumber: 17,
    peakWeekNumber: 16,
    startLongRunMiles: 10,
    peakLongRunMiles: 20,
    longRunCutback: 0,
    longRunPositions: [{ cyclePosition: 0, catalogueWorkoutId: "lr", distributionWeight: 1 }],
    holdWeekNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
    holdLongRunMiles: 10,
    rampStartWeekNumber: 9,
  });

  assert.equal(schedule.find((w) => w.weekNumber === 1)!.days[0]!.miles, 10);
  assert.equal(schedule.find((w) => w.weekNumber === 8)!.days[0]!.miles, 10);
  const mid = schedule.find((w) => w.weekNumber === 12)!.days[0]!.miles!;
  assert.ok(mid > 10 && mid < 20);
  assert.equal(schedule.find((w) => w.weekNumber === 16)!.days[0]!.miles, 20);
});

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

test("race-week slots: null prescribedMiles keeps distributed miles on existing day", () => {
  const planStart = new Date("2026-04-06T12:00:00.000Z");
  const raceDate = new Date("2026-04-12T12:00:00.000Z");
  const schedule: PlanWeekSchedule[] = [
    {
      weekNumber: 1,
      days: [
        { dow: 1, workoutType: "Easy", miles: 5.2, catalogueWorkoutId: "e1", planCycleIndex: null },
        { dow: 7, workoutType: "Race", miles: 26.2, catalogueWorkoutId: null, planCycleIndex: null },
      ],
    },
  ];

  applyRaceWeekSlotsFromPreset({
    planStart,
    raceDate,
    schedule,
    slots: [
      {
        offsetFromRace: -6,
        runName: "Easy",
        type: "easy",
        catalogueWorkoutId: "e2",
        prescribedMiles: null,
        shakeoutRunConfigId: null,
      },
    ],
  });

  const mon = schedule[0]!.days.find((d) => d.dow === 1)!;
  assert.equal(mon.workoutType, "Easy");
  assert.equal(mon.miles, 5.2);
  assert.equal(mon.catalogueWorkoutId, "e2");
});

test("race-week slots: positive prescribedMiles overwrites miles", () => {
  const planStart = new Date("2026-04-06T12:00:00.000Z");
  const raceDate = new Date("2026-04-12T12:00:00.000Z");
  const schedule: PlanWeekSchedule[] = [
    {
      weekNumber: 1,
      days: [
        { dow: 1, workoutType: "Easy", miles: 5.2, catalogueWorkoutId: "e1", planCycleIndex: null },
      ],
    },
  ];

  applyRaceWeekSlotsFromPreset({
    planStart,
    raceDate,
    schedule,
    slots: [
      {
        offsetFromRace: -6,
        runName: "Shakeout",
        type: "shakeout-easy",
        catalogueWorkoutId: "sh1",
        prescribedMiles: 3,
        shakeoutRunConfigId: null,
      },
    ],
  });

  const mon = schedule[0]!.days.find((d) => d.dow === 1)!;
  assert.equal(mon.miles, 3);
});

test("race-week slots: race offset stamps Race on goal date", () => {
  const planStart = new Date("2026-10-19T12:00:00.000Z");
  const raceDate = new Date("2026-10-25T12:00:00.000Z");
  const schedule: PlanWeekSchedule[] = [
    {
      weekNumber: 1,
      days: [
        { dow: 7, workoutType: "Easy", miles: 8, catalogueWorkoutId: "e1", planCycleIndex: null },
      ],
    },
  ];

  applyRaceWeekSlotsFromPreset({
    planStart,
    raceDate,
    schedule,
    slots: [
      {
        offsetFromRace: 0,
        runName: "Marathon",
        type: "race",
        catalogueWorkoutId: null,
        prescribedMiles: 26.2,
        shakeoutRunConfigId: null,
      },
    ],
  });

  const sun = schedule[0]!.days.find((d) => d.dow === 7)!;
  assert.equal(sun.workoutType, "Race");
  assert.equal(sun.miles, 26.2);
  assert.equal(sun.catalogueWorkoutId, null);
});
