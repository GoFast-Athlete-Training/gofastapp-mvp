import assert from "node:assert/strict";
import test from "node:test";
import {
  isPlanWeekCsvHeaderLine,
  PLAN_WEEK_CSV_HEADER_LINE,
  PLAN_WEEK_CSV_TEMPLATE,
} from "@/lib/training/plan-week-csv-template";
import {
  looksLikePlanWeekCsv,
  planWeekCsvNonCommentLines,
} from "@/lib/training/parse-plan-week-csv";

test("week CSV template header matches parser contract", () => {
  assert.ok(PLAN_WEEK_CSV_TEMPLATE.includes("Do NOT include goal race day"));
  const dataLines = planWeekCsvNonCommentLines(PLAN_WEEK_CSV_TEMPLATE);
  assert.equal(dataLines[0], PLAN_WEEK_CSV_HEADER_LINE);
  assert.ok(isPlanWeekCsvHeaderLine(dataLines[0]!));
  assert.ok(looksLikePlanWeekCsv(PLAN_WEEK_CSV_TEMPLATE));
});
