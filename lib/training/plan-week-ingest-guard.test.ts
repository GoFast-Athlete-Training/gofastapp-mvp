import assert from "node:assert/strict";
import test from "node:test";
import {
  dateKeyForWeekDay,
  mergeWeekIngestWithGuard,
} from "@/lib/training/plan-week-ingest-guard";
import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";

const planStart = new Date("2026-10-12T12:00:00.000Z");
const weekNumber = 1;

test("mergeWeekIngestWithGuard drops Race rows and preserves protected race day from existing week", () => {
  const raceDow = 7;
  const raceDateKey = dateKeyForWeekDay(planStart, weekNumber, raceDow);
  const protectedDateKeys = new Set([raceDateKey]);
  const skippedNotes: string[] = [];

  const existing: PlanWeekSchedule[] = [
    {
      weekNumber: 1,
      days: [
        { dow: 1, workoutType: "Easy", miles: 4, catalogueWorkoutId: null, planCycleIndex: null },
        {
          dow: raceDow,
          workoutType: "Race",
          miles: 26.2,
          catalogueWorkoutId: null,
          planCycleIndex: null,
        },
      ],
    },
  ];

  const incoming: PlanWeekSchedule = {
    weekNumber: 1,
    days: [
      { dow: 1, workoutType: "Tempo", miles: 6, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: raceDow, workoutType: "Race", miles: 26.2, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 3, workoutType: "Easy", miles: 3, catalogueWorkoutId: null, planCycleIndex: null },
    ],
  };

  const merged = mergeWeekIngestWithGuard({
    incoming,
    existingSchedule: existing,
    planStartDate: planStart,
    weekNumber,
    protectedDateKeys,
    skippedNotes,
  });

  assert.equal(merged.days.length, 3);
  assert.equal(merged.days.find((d) => d.dow === 1)?.workoutType, "Tempo");
  assert.equal(merged.days.find((d) => d.dow === raceDow)?.workoutType, "Race");
  assert.ok(skippedNotes.some((n) => n.includes("race")));
});

test("protected completed day keeps existing slot when incoming replaces week", () => {
  const completedDow = 2;
  const completedKey = dateKeyForWeekDay(planStart, weekNumber, completedDow);
  const protectedDateKeys = new Set([completedKey]);
  const skippedNotes: string[] = [];

  const existing: PlanWeekSchedule[] = [
    {
      weekNumber: 1,
      days: [
        {
          dow: completedDow,
          workoutType: "Tempo",
          miles: 6,
          catalogueWorkoutId: "cat-old",
          planCycleIndex: 0,
        },
      ],
    },
  ];

  const incoming: PlanWeekSchedule = {
    weekNumber: 1,
    days: [
      { dow: 1, workoutType: "Easy", miles: 5, catalogueWorkoutId: null, planCycleIndex: null },
    ],
  };

  const merged = mergeWeekIngestWithGuard({
    incoming,
    existingSchedule: existing,
    planStartDate: planStart,
    weekNumber,
    protectedDateKeys,
    skippedNotes,
  });

  const tue = merged.days.find((d) => d.dow === completedDow);
  assert.equal(tue?.catalogueWorkoutId, "cat-old");
  assert.equal(tue?.miles, 6);
});
