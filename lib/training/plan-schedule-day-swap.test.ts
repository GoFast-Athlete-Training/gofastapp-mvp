import assert from "node:assert/strict";
import test from "node:test";
import { applyCatalogueDaySwap } from "./plan-schedule-day-edit";

const schedule = [
  {
    weekNumber: 2,
    phase: "B",
    days: [
      {
        dow: 1,
        workoutType: "Easy",
        miles: 5,
        catalogueWorkoutId: "easy-1",
        planCycleIndex: 0,
      },
      {
        dow: 6,
        workoutType: "LongRun",
        miles: 12,
        catalogueWorkoutId: "long-1",
        planCycleIndex: 1,
        raceName: "Tune-up",
      },
    ],
  },
];

test("applyCatalogueDaySwap inserts a missing Thursday", () => {
  const result = applyCatalogueDaySwap(schedule, {
    weekNumber: 2,
    dow: 4,
    workoutType: "Intervals",
    miles: 6,
    catalogueWorkoutId: "track-1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const week = result.next[0] as { days: Array<{ dow: number; catalogueWorkoutId: string }> };
  assert.deepEqual(
    week.days.map((day) => day.dow),
    [1, 4, 6],
  );
  assert.equal(week.days[1]?.catalogueWorkoutId, "track-1");
});

test("applyCatalogueDaySwap replaces Thursday and clears race imprint", () => {
  const withThursday = [
    {
      weekNumber: 2,
      days: [
        {
          dow: 4,
          workoutType: "Tempo",
          miles: 7,
          catalogueWorkoutId: "tempo-1",
          planCycleIndex: 2,
          raceRegistryId: "race-1",
          raceName: "Old race",
          workoutId: "workout-1",
        },
      ],
    },
  ];
  const result = applyCatalogueDaySwap(withThursday, {
    weekNumber: 2,
    dow: 4,
    workoutType: "Intervals",
    miles: 5.5,
    catalogueWorkoutId: "track-1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const day = (result.next[0] as { days: Array<Record<string, unknown>> }).days[0];
  assert.equal(day?.workoutType, "Intervals");
  assert.equal(day?.miles, 5.5);
  assert.equal(day?.catalogueWorkoutId, "track-1");
  assert.equal(day?.planCycleIndex, null);
  assert.equal(day?.raceRegistryId, null);
  assert.equal(day?.raceName, null);
  assert.equal(day?.workoutId, null);
});

test("applyCatalogueDaySwap errors when the week is missing", () => {
  const result = applyCatalogueDaySwap(schedule, {
    weekNumber: 9,
    dow: 4,
    workoutType: "Intervals",
    miles: 5,
    catalogueWorkoutId: "track-1",
  });
  assert.deepEqual(result, { ok: false, error: "Week not found on this plan" });
});
