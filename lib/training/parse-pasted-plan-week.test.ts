import assert from "node:assert/strict";
import test from "node:test";
import {
  tryParsePastedFullPlanText,
  tryParsePastedWeekScheduleText,
} from "./parse-pasted-plan-week";

test("tryParsePastedWeekScheduleText parses day lines", () => {
  const week = tryParsePastedWeekScheduleText(
    "Mon easy 5\nWed tempo 6 mi\nSat long 14",
    3
  );
  assert.equal(week?.weekNumber, 3);
  assert.equal(week?.days.length, 3);
  assert.equal(week?.days[0]?.workoutType, "Easy");
  assert.equal(week?.days[0]?.miles, 5);
  assert.equal(week?.days[1]?.workoutType, "Tempo");
});

test("tryParsePastedFullPlanText groups by week headers", () => {
  const text = `Week 2
Mon easy 4
Week 3
Tue tempo 5`;
  const weeks = tryParsePastedFullPlanText(text);
  assert.deepEqual(weeks?.map((w) => w.weekNumber), [2, 3]);
});
