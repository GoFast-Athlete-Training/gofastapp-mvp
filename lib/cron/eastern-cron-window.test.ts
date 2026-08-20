import assert from "node:assert/strict";
import test from "node:test";
import { easternHour, isEasternHour } from "./eastern-cron-window";

test("easternHour resolves 5 AM Eastern during EDT from 09:00 UTC", () => {
  const utc = new Date("2026-08-20T09:00:00.000Z");
  assert.equal(easternHour(utc), 5);
  assert.equal(isEasternHour(utc, 5), true);
  assert.equal(isEasternHour(utc, 4), false);
});

test("easternHour resolves 5 AM Eastern during EST from 10:00 UTC", () => {
  const utc = new Date("2026-01-15T10:00:00.000Z");
  assert.equal(easternHour(utc), 5);
  assert.equal(isEasternHour(utc, 5), true);
});

test("09:00 UTC is not 5 AM Eastern during EST", () => {
  const utc = new Date("2026-01-15T09:00:00.000Z");
  assert.equal(easternHour(utc), 4);
  assert.equal(isEasternHour(utc, 5), false);
});
