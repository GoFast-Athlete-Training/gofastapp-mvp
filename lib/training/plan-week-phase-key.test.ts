import assert from "node:assert/strict";
import test from "node:test";
import {
  planWeekPhaseForNumber,
  planWeekPhaseUxLabel,
  stampPhaseOnPlanSchedule,
} from "@/lib/training/plan-week-phase-key";
import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";

test("stampPhaseOnPlanSchedule marks B T RW for sixteen weeks", () => {
  const schedule: PlanWeekSchedule[] = Array.from({ length: 16 }, (_, i) => ({
    weekNumber: i + 1,
    days: [],
  }));
  stampPhaseOnPlanSchedule(schedule, 16);
  assert.equal(schedule[0]?.phase, "B");
  assert.equal(schedule[12]?.phase, "B");
  assert.equal(schedule[13]?.phase, "T");
  assert.equal(schedule[14]?.phase, "T");
  assert.equal(schedule[15]?.phase, "RW");
  assert.equal(planWeekPhaseUxLabel("T"), "Taper");
});

test("planWeekPhaseForNumber single week plan is race week", () => {
  assert.equal(planWeekPhaseForNumber(1, 1), "RW");
});
