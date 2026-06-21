import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysUtc,
  dateToYmd,
  parseYmd,
  titleForAdvancedDate,
} from "./advance-club-instances";

test("advance-club-instances title updates date suffix", () => {
  assert.equal(
    titleForAdvancedDate("The Ballston Runaways Wednesday Run (6/10)", "2026-06-17"),
    "The Ballston Runaways Wednesday Run (6/17)"
  );
});

test("advance-club-instances adds seven calendar days", () => {
  const prior = parseYmd("2026-06-10");
  const next = addDaysUtc(prior, 7);
  assert.equal(dateToYmd(next), "2026-06-17");
  assert.equal(prior.toISOString(), "2026-06-10T12:00:00.000Z");
  assert.equal(next.toISOString(), "2026-06-17T12:00:00.000Z");
});

test("advance-club-instances keeps Wednesday when advancing from prior Wednesday", () => {
  const prior = parseYmd("2026-06-10");
  const next = addDaysUtc(prior, 7);
  assert.equal(next.getUTCDay(), 3);
});
