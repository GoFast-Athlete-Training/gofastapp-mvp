import assert from "node:assert/strict";
import test from "node:test";
import {
  peakBlockCutbackIndexes,
  peakBlockSeries,
  planFoundationBuild,
  resolveAthleteStart,
} from "@/lib/training/foundation-progression";

const entry = {
  entryLongRunMiles: 12,
  peakLongRunMiles: 20,
  entryWeeklyMiles: 40,
  peakWeeklyMiles: 55,
  longRunCutback: 0.2,
};

test("ready athlete holds at capability and does not clamp up to preset min", () => {
  const athlete = resolveAthleteStart({
    currentWeeklyMileage: 50,
    longRunCapabilityMiles: 16,
  });
  const plan = planFoundationBuild({
    holdWeekNumbers: [1, 2, 3, 4],
    rampWeekNumbers: [5, 6, 7, 8, 9, 10, 11, 12],
    athlete,
    ...entry,
  });
  assert.equal(plan.unrealistic, false);
  assert.equal(plan.weeklyByWeek.get(1), 50);
  assert.equal(plan.longRunByWeek.get(1), 16);
  assert.equal(plan.longRunByWeek.get(12), 20);
  assert.ok((plan.weeklyByWeek.get(1) ?? 0) < 55);
});

test("low mileage bridges toward entry without using preset minimum as a floor", () => {
  const athlete = resolveAthleteStart({
    currentWeeklyMileage: 22,
    longRunCapabilityMiles: 8,
  });
  const plan = planFoundationBuild({
    holdWeekNumbers: [1, 2, 3, 4, 5, 6],
    rampWeekNumbers: [7, 8, 9, 10, 11, 12, 13, 14],
    athlete,
    ...entry,
  });
  assert.equal(plan.weeklyByWeek.get(1)! < 40, true);
  assert.ok(plan.weeklyByWeek.get(1)! >= 22);
  assert.equal(plan.longRunByWeek.get(6), 12);
  assert.equal(plan.weeklyByWeek.get(6), 40);
  assert.equal(plan.missingData, false);
});

test("missing both inputs flags missingData and starts the peak block at entry", () => {
  const athlete = resolveAthleteStart({});
  assert.equal(athlete.missingData, true);
  const plan = planFoundationBuild({
    holdWeekNumbers: [],
    rampWeekNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
    athlete,
    ...entry,
  });
  assert.equal(plan.missingData, true);
  assert.ok((plan.longRunByWeek.get(1) ?? 0) >= 12);
  assert.equal(plan.longRunByWeek.get(8), 20);
});

test("one input is derived from the other", () => {
  const fromWeekly = resolveAthleteStart({ currentWeeklyMileage: 30 });
  assert.equal(fromWeekly.derived, true);
  assert.equal(fromWeekly.longRunMiles, 9);
  const fromLong = resolveAthleteStart({ longRunCapabilityMiles: 12 });
  assert.equal(fromLong.derived, true);
  assert.equal(fromLong.weeklyMiles, 40);
});

test("injury return lowers both anchors", () => {
  const athlete = resolveAthleteStart({
    currentWeeklyMileage: 40,
    longRunCapabilityMiles: 12,
    returningFromInjury: true,
  });
  assert.equal(athlete.weeklyMiles, 30);
  assert.equal(athlete.longRunMiles, 9);
  assert.equal(athlete.returningFromInjury, true);
});

test("eight-week block has two cutbacks and ends at the peak", () => {
  assert.deepEqual(peakBlockCutbackIndexes(8), [3, 6]);
  const series = peakBlockSeries(8, 12, 20, 0.2);
  assert.equal(series.length, 8);
  assert.equal(series[7], 20);
  assert.ok(series[3]! < series[2]!);
  assert.ok(series[6]! < series[5]!);
  assert.ok(series[2]! > series[0]!);
});

test("shortened build keeps a peak week and a cutback when weeks allow", () => {
  const athlete = resolveAthleteStart({
    currentWeeklyMileage: 36,
    longRunCapabilityMiles: 10,
  });
  const plan = planFoundationBuild({
    holdWeekNumbers: [],
    rampWeekNumbers: [1, 2, 3, 4],
    athlete,
    ...entry,
  });
  assert.equal(plan.longRunByWeek.get(4), 20);
  assert.equal(peakBlockCutbackIndexes(4).length, 1);
  const cut = peakBlockCutbackIndexes(4)[0]!;
  const series = peakBlockSeries(4, 10, 20, 0.2);
  assert.ok(series[cut]! < series[cut - 1]!);
});

test("steep bridge is still written and flagged unrealistic", () => {
  const athlete = resolveAthleteStart({
    currentWeeklyMileage: 20,
    longRunCapabilityMiles: 6,
  });
  const plan = planFoundationBuild({
    holdWeekNumbers: [1],
    rampWeekNumbers: [2, 3, 4, 5, 6, 7, 8, 9],
    athlete,
    ...entry,
  });
  assert.equal(plan.unrealistic, true);
  assert.equal(plan.longRunByWeek.get(1), 12);
  assert.equal(plan.longRunByWeek.get(9), 20);
});

test("phase handoff: last base week meets build-to-peak entry", () => {
  const athlete = resolveAthleteStart({
    currentWeeklyMileage: 28,
    longRunCapabilityMiles: 8,
  });
  const plan = planFoundationBuild({
    holdWeekNumbers: [1, 2, 3, 4],
    rampWeekNumbers: [5, 6, 7, 8, 9, 10, 11, 12],
    athlete,
    ...entry,
  });
  assert.equal(plan.longRunByWeek.get(4), plan.entryLongRunMiles);
  assert.equal(plan.weeklyByWeek.get(4), plan.entryWeeklyMiles);
  assert.equal(plan.longRunByWeek.get(5)! >= plan.entryLongRunMiles * 0.7, true);
  assert.equal(plan.longRunByWeek.get(12), plan.peakLongRunMiles);
});

test("base band does not lift a low athlete to the base floor", () => {
  const athlete = resolveAthleteStart({
    currentWeeklyMileage: 22,
    longRunCapabilityMiles: 8,
  });
  const plan = planFoundationBuild({
    holdWeekNumbers: [1, 2, 3, 4],
    rampWeekNumbers: [5, 6, 7, 8, 9, 10, 11, 12],
    athlete,
    entryLongRunMiles: 12,
    peakLongRunMiles: 20,
    entryWeeklyMiles: 40,
    baseWeeklyMinMiles: 30,
    peakWeeklyMiles: 55,
    longRunCutback: null,
  });
  assert.ok(plan.weeklyByWeek.get(1)! < 30);
  assert.equal(plan.weeklyByWeek.get(4), 40);
  assert.equal(plan.longRunByWeek.get(4), 12);
  assert.equal(plan.longRunByWeek.get(12), 20);
});

test("missing weekly uses the base band as the guide", () => {
  const athlete = resolveAthleteStart({});
  const plan = planFoundationBuild({
    holdWeekNumbers: [1, 2],
    rampWeekNumbers: [3, 4, 5, 6, 7, 8, 9, 10],
    athlete,
    entryLongRunMiles: 12,
    peakLongRunMiles: 20,
    entryWeeklyMiles: 40,
    baseWeeklyMinMiles: 30,
    peakWeeklyMiles: 55,
    longRunCutback: null,
  });
  assert.ok(plan.weeklyByWeek.get(1)! > 30);
  assert.ok(plan.weeklyByWeek.get(1)! < 40);
  assert.equal(plan.weeklyByWeek.get(2), 40);
  assert.equal(plan.longRunByWeek.get(10), 20);
});

test("peak block starts at the starting long run when the athlete is below it", () => {
  const athlete = resolveAthleteStart({
    currentWeeklyMileage: 25,
    longRunCapabilityMiles: 8,
  });
  const plan = planFoundationBuild({
    holdWeekNumbers: [],
    rampWeekNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
    athlete,
    entryLongRunMiles: 12,
    peakLongRunMiles: 20,
    entryWeeklyMiles: 40,
    peakWeeklyMiles: 55,
    longRunCutback: null,
  });
  const fromStart = peakBlockSeries(8, 12, 20, 0.2);
  assert.equal(plan.longRunByWeek.get(1), fromStart[0]);
  assert.equal(plan.longRunByWeek.get(8), 20);
});
