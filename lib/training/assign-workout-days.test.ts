import assert from "node:assert/strict";
import test from "node:test";
import { assignWorkoutDays } from "@/lib/training/assign-workout-days";

const baseInput = {
  planStartDate: new Date("2026-05-20T00:00:00.000Z"),
  raceDate: new Date("2026-10-24T00:00:00.000Z"),
  raceName: "Marine Corps Marathon",
  raceDistanceMiles: 26.2,
  totalWeeks: 23,
  preferredDays: [2, 4, 5, 6],
  preferredLongRunDow: 6,
  preferredTempoDow: 2,
  preferredIntervalDow: 4,
  tempoIdealDow: 2,
  intervalIdealDow: 4,
  longRunDefaultDow: 6,
  peakWeeklyMilesForCap: 40,
  longRunCycleLen: 4,
  longRunPositions: [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: "lr-1" }],
  intervalsPositions: [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: "int-1" }],
  tempoPositions: [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: "tempo-1" }],
  easyPositions: [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: "easy-1" }],
};

test("mid-week week 1 skips missed tempo instead of cramming both quality sessions", () => {
  const { schedule } = assignWorkoutDays(baseInput);
  const week1 = schedule[0];

  assert.equal(week1?.weekNumber, 1);
  assert.deepEqual(
    week1?.days.map((d) => [d.dow, d.workoutType]),
    [
      [4, "Intervals"],
      [5, "Easy"],
      [6, "LongRun"],
    ]
  );
});

test("easy days receive catalogue workout ids from easy rotation", () => {
  const { schedule } = assignWorkoutDays(baseInput);
  const easyDays = schedule.flatMap((w) => w.days.filter((d) => d.workoutType === "Easy"));
  assert.ok(easyDays.length > 0);
  for (const day of easyDays) {
    assert.equal(day.catalogueWorkoutId, "easy-1");
  }
});

test("partial week 1 caps quality work at one hard session", () => {
  const { schedule } = assignWorkoutDays({
    ...baseInput,
    preferredDays: [3, 4, 5, 6],
    preferredTempoDow: 3,
    tempoIdealDow: 3,
  });
  const week1Quality = schedule[0]?.days.filter(
    (d) => d.workoutType === "Tempo" || d.workoutType === "Intervals"
  );

  assert.deepEqual(
    week1Quality?.map((d) => d.workoutType),
    ["Tempo"]
  );
});
