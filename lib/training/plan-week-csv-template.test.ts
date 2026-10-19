import assert from "node:assert/strict";
import test from "node:test";
import {
  isPlanWeekCsvHeaderLine,
  PLAN_WEEK_CSV_TEMPLATE,
} from "@/lib/training/plan-week-csv-template";
import { looksLikePlanWeekCsv } from "@/lib/training/parse-plan-week-csv";

test("week CSV template header matches parser contract", () => {
  const firstLine = PLAN_WEEK_CSV_TEMPLATE.split(/\r?\n/)[0]!;
  assert.ok(isPlanWeekCsvHeaderLine(firstLine));
  assert.ok(looksLikePlanWeekCsv(PLAN_WEEK_CSV_TEMPLATE));
});
