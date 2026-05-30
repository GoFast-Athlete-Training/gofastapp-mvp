import assert from "node:assert/strict";
import test from "node:test";
import { GarminApiError } from "./garmin-training-api";
import {
  deleteGarminScheduleIfPresent,
  scheduleAndVerifyWorkout,
  type GarminScheduleClient,
} from "./garmin-schedule-service";

function mockClient(overrides: Partial<GarminScheduleClient>): GarminScheduleClient {
  return {
    scheduleWorkout: async () => ({ scheduleId: 999 }),
    getSchedule: async () => ({ workoutId: 1, date: "2026-05-29" }),
    deleteSchedule: async () => {},
    ...overrides,
  };
}

test("scheduleAndVerifyWorkout succeeds when schedule matches workout and date", async () => {
  const result = await scheduleAndVerifyWorkout(
    mockClient({
      scheduleWorkout: async () => ({ scheduleId: 555 }),
      getSchedule: async () => ({ workoutId: 42, date: "2026-05-29" }),
    }),
    { garminWorkoutId: 42, scheduledDate: "2026-05-29" }
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.garminScheduleId, 555);
});

test("scheduleAndVerifyWorkout fails verify on workout id mismatch", async () => {
  const result = await scheduleAndVerifyWorkout(
    mockClient({
      getSchedule: async () => ({ workoutId: 99, date: "2026-05-29" }),
    }),
    { garminWorkoutId: 42, scheduledDate: "2026-05-29" }
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.phase, "verify");
    assert.match(result.message, /workout id mismatch/);
  }
});

test("scheduleAndVerifyWorkout fails verify on date mismatch", async () => {
  const result = await scheduleAndVerifyWorkout(
    mockClient({
      getSchedule: async () => ({ workoutId: 42, date: "2026-05-30" }),
    }),
    { garminWorkoutId: 42, scheduledDate: "2026-05-29" }
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.phase, "verify");
    assert.match(result.message, /expected 2026-05-29/);
  }
});

test("scheduleAndVerifyWorkout fails create when scheduleWorkout throws", async () => {
  const result = await scheduleAndVerifyWorkout(
    mockClient({
      scheduleWorkout: async () => {
        throw new GarminApiError({
          status: 502,
          url: "/schedule",
          details: "bad gateway",
        });
      },
    }),
    { garminWorkoutId: 42, scheduledDate: "2026-05-29" }
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.phase, "create");
    assert.equal(result.garminStatus, 502);
  }
});

test("scheduleAndVerifyWorkout fails verify when getSchedule throws", async () => {
  const result = await scheduleAndVerifyWorkout(
    mockClient({
      getSchedule: async () => {
        throw new GarminApiError({
          status: 404,
          url: "/schedule/555",
          details: "not found",
        });
      },
    }),
    { garminWorkoutId: 42, scheduledDate: "2026-05-29" }
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.phase, "verify");
    assert.equal(result.garminStatus, 404);
  }
});

test("deleteGarminScheduleIfPresent treats 404 as stale schedule id", async () => {
  const result = await deleteGarminScheduleIfPresent(
    mockClient({
      deleteSchedule: async () => {
        throw new GarminApiError({
          status: 404,
          url: "/schedule/1",
          details: "gone",
        });
      },
    }),
    123
  );
  assert.equal(result.wasStaleOnGarmin, true);
});

test("deleteGarminScheduleIfPresent no-ops when schedule id is null", async () => {
  let called = false;
  await deleteGarminScheduleIfPresent(
    mockClient({
      deleteSchedule: async () => {
        called = true;
      },
    }),
    null
  );
  assert.equal(called, false);
});
