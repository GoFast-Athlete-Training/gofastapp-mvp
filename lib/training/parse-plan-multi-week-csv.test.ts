import assert from "node:assert/strict";
import test from "node:test";
import { tryParsePlanMultiWeekCsvWithMeta } from "@/lib/training/parse-plan-multi-week-csv";

const CSV = `# comment
Week,Date,Workout,Type,Mileage,Pace
1,2026-10-20,Easy run,Easy,5,
1,2026-10-22,Tempo,Tempo,6,steady
2,2026-10-27,Long,LongRun,14,
`;

test("multi-week CSV groups days by week number", () => {
  const parsed = tryParsePlanMultiWeekCsvWithMeta({
    sourceText: CSV,
    raceDateKey: null,
  });
  assert.ok(parsed);
  assert.equal(parsed!.weeks.length, 2);
  assert.equal(parsed!.weeks[0]!.weekNumber, 1);
  assert.equal(parsed!.weeks[0]!.days.length, 2);
  assert.equal(parsed!.weeks[1]!.days[0]!.workoutType, "LongRun");
});
