import assert from "node:assert/strict";
import test from "node:test";
import { tryParsePlanWeekCsvText } from "@/lib/training/parse-plan-week-csv";
import { weekBoundsFromPlan } from "@/lib/training/plan-schedule";

const planStart = new Date("2026-10-19T12:00:00.000Z");
const weekNumber = 1;
const bounds = weekBoundsFromPlan(planStart, weekNumber, {
  raceDate: new Date("2026-10-25T12:00:00.000Z"),
  totalWeeks: 1,
});

const MCM_CSV = `Date,Workout,Type,Mileage,Pace
2026-10-20,Controlled Tempo,Tempo,6,"2 mi warm-up easy; 2 mi tempo @ 6:45/mi; 2 mi cool-down easy"
2026-10-21,Ballston Runaways,Easy,3,8:00/mi
2026-10-24,MCM Shakeout,Shakeout,3,8:30-9:00/mi
2026-10-25,Marine Corps Marathon,Race,26.2,6:55-7:00/mi`;

test("CSV week parse skips race row and maps shakeout to Easy", () => {
  const parsed = tryParsePlanWeekCsvText({
    sourceText: MCM_CSV,
    weekNumber,
    weekBounds: bounds,
    fiveKPace: "7:30/mi",
    raceDateKey: "2026-10-25",
  });
  assert.ok(parsed);
  assert.ok(parsed!.skippedNotes.some((n) => n.includes("2026-10-25")));
  assert.ok(!parsed!.week.days.some((d) => d.workoutType === "Race"));
  const shakeoutDow = 6;
  const shake = parsed!.week.days.find((d) => d.dow === shakeoutDow);
  assert.equal(shake?.workoutType, "Easy");
  assert.equal(shake?.miles, 3);
});

test("CSV structured tempo pace yields preview segments for that date", () => {
  const parsed = tryParsePlanWeekCsvText({
    sourceText: MCM_CSV,
    weekNumber,
    weekBounds: bounds,
    fiveKPace: "7:30/mi",
    raceDateKey: "2026-10-25",
  });
  assert.ok(parsed);
  const segs = parsed!.daySegmentsByDateKey["2026-10-20"];
  assert.ok(segs && segs.length >= 2);
});
