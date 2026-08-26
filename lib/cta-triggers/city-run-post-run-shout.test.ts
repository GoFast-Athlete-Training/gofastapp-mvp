import assert from "node:assert/strict";
import test from "node:test";
import {
  isCheckinWithinPostRunShoutCtaWindow,
  isRunWithinPostRunCheckinCtaWindow,
  POST_RUN_CTA_MAX_AGE_MS,
  RUN_PAST_BUFFER_MS,
} from "./city-run-post-run-shout";

test("shout CTA expires 24h after check-in", () => {
  const checkedInAt = new Date("2026-06-20T10:00:00.000Z");
  const within = checkedInAt.getTime() + POST_RUN_CTA_MAX_AGE_MS - 60_000;
  const expired = checkedInAt.getTime() + POST_RUN_CTA_MAX_AGE_MS + 60_000;
  assert.equal(isCheckinWithinPostRunShoutCtaWindow(checkedInAt, within), true);
  assert.equal(isCheckinWithinPostRunShoutCtaWindow(checkedInAt, expired), false);
});

test("check-in CTA shows only within 24h after run is past", () => {
  const run = {
    date: new Date("2026-06-20T06:00:00.000Z"),
    startTimeHour: 6,
    startTimeMinute: 0,
    startTimePeriod: "AM",
  };
  const justPast = new Date("2026-06-20T10:05:00.000Z").getTime();
  const expired = new Date("2026-06-21T11:00:00.000Z").getTime();
  const beforePast = new Date("2026-06-20T09:00:00.000Z").getTime();
  assert.equal(isRunWithinPostRunCheckinCtaWindow(run, justPast), true);
  assert.equal(isRunWithinPostRunCheckinCtaWindow(run, expired), false);
  assert.equal(isRunWithinPostRunCheckinCtaWindow(run, beforePast), false);
});
