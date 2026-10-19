import assert from "node:assert/strict";
import test from "node:test";
import { buildWeekPreviewDays } from "@/lib/training/plan-week-preview-days";
import { weekBoundsFromPlan } from "@/lib/training/plan-schedule";

const planStart = new Date("2026-10-19T12:00:00.000Z");
const weekNumber = 1;
const bounds = weekBoundsFromPlan(planStart, weekNumber, {
  raceDate: new Date("2026-10-25T12:00:00.000Z"),
  totalWeeks: 1,
});

test("buildWeekPreviewDays marks race day as keep", () => {
  const guardedWeek = {
    weekNumber: 1,
    days: [
      { dow: 2, workoutType: "Tempo" as const, miles: 6, catalogueWorkoutId: null, planCycleIndex: null },
      { dow: 7, workoutType: "Race" as const, miles: 26.2, catalogueWorkoutId: null, planCycleIndex: null },
    ],
  };
  const protectedDateKeys = new Set(["2026-10-25"]);
  const days = buildWeekPreviewDays({
    weekStart: bounds.weekStart,
    weekEnd: bounds.weekEnd,
    guardedWeek,
    protectedDateKeys,
    raceDateKey: "2026-10-25",
    metaByDateKey: {
      "2026-10-20": { workoutName: "Tempo day", paceNote: "6:45/mi" },
    },
  });
  const race = days.find((d) => d.dateKey === "2026-10-25");
  assert.equal(race?.action, "keep");
  assert.equal(race?.keepReason, "race");
  const tempo = days.find((d) => d.dateKey === "2026-10-20");
  assert.equal(tempo?.action, "replace");
  assert.equal(tempo?.workoutName, "Tempo day");
});
