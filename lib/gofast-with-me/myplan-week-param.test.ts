import assert from "node:assert/strict";
import test from "node:test";
import { resolveMyPlanInitialWeek } from "@/lib/gofast-with-me/myplan-week-param";

const start = new Date("2026-01-05T12:00:00.000Z");

test("resolveMyPlanInitialWeek: race param uses last week", () => {
  assert.equal(
    resolveMyPlanInitialWeek({ weekParam: "race", totalWeeks: 16, planStartDate: start }),
    16
  );
});

test("resolveMyPlanInitialWeek: numeric week clamped", () => {
  assert.equal(
    resolveMyPlanInitialWeek({ weekParam: "99", totalWeeks: 12, planStartDate: start }),
    12
  );
  assert.equal(
    resolveMyPlanInitialWeek({ weekParam: "2", totalWeeks: 12, planStartDate: start }),
    2
  );
});
