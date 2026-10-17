import test from "node:test";
import assert from "node:assert/strict";
import { nextYmdForDayOfWeek } from "@/lib/runmanage/series-operational-list";

test("nextYmdForDayOfWeek returns same weekday on or after today", () => {
  const from = new Date("2026-10-17T12:00:00"); // Saturday
  const ymd = nextYmdForDayOfWeek("TUESDAY", from);
  assert.equal(ymd, "2026-10-20");
});
