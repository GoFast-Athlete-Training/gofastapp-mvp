import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysUtc,
  computeLaneAdvanceState,
  dateToYmd,
  getHorizonTargetDatesFromPrior,
  getStartOfTodayUTC,
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

test("getHorizonTargetDatesFromPrior returns two weekly slots from prior Monday on Saturday", () => {
  const priorMonday = parseYmd("2026-06-01");
  const saturday = parseYmd("2026-06-06");
  const dates = getHorizonTargetDatesFromPrior(priorMonday, 2, saturday);
  assert.deepEqual(dates, ["2026-06-08", "2026-06-15"]);
});

test("getHorizonTargetDatesFromPrior skips past weeks until on or after today", () => {
  const priorMonday = parseYmd("2026-05-25");
  const saturday = parseYmd("2026-06-06");
  const dates = getHorizonTargetDatesFromPrior(priorMonday, 2, saturday);
  assert.deepEqual(dates, ["2026-06-08", "2026-06-15"]);
});

test("computeLaneAdvanceState needs week2 when only week1 exists", () => {
  const priorMonday = parseYmd("2026-06-01");
  const saturday = parseYmd("2026-06-06");
  const week1 = parseYmd("2026-06-08");
  const state = computeLaneAdvanceState(priorMonday, [week1], 2, saturday);
  assert.equal(state.needsAdvance, true);
  assert.equal(state.expectedNextDateYmd, "2026-06-15");
  assert.deepEqual(state.horizonDates, ["2026-06-08", "2026-06-15"]);
});

test("computeLaneAdvanceState is satisfied when both horizon slots exist", () => {
  const priorMonday = parseYmd("2026-06-01");
  const saturday = parseYmd("2026-06-06");
  const week1 = parseYmd("2026-06-08");
  const week2 = parseYmd("2026-06-15");
  const state = computeLaneAdvanceState(priorMonday, [week1, week2], 2, saturday);
  assert.equal(state.needsAdvance, false);
  assert.equal(state.expectedNextDateYmd, null);
});

test("computeLaneAdvanceState needs both slots when none exist after prior", () => {
  const priorMonday = parseYmd("2026-06-01");
  const saturday = parseYmd("2026-06-06");
  const state = computeLaneAdvanceState(priorMonday, [], 2, saturday);
  assert.equal(state.needsAdvance, true);
  assert.equal(state.expectedNextDateYmd, "2026-06-08");
});

test("computeLaneAdvanceState returns false without prior", () => {
  const state = computeLaneAdvanceState(null, [], 2, getStartOfTodayUTC());
  assert.equal(state.needsAdvance, false);
});
