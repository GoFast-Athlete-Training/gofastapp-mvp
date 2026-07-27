import assert from "node:assert/strict";
import test from "node:test";
import { AdvertisingBlockStatus } from "@prisma/client";

function deriveBlockStatus(
  startsAt: Date,
  endsAt: Date,
  now: Date,
): AdvertisingBlockStatus {
  if (now < startsAt) return AdvertisingBlockStatus.SCHEDULED;
  if (now >= endsAt) return AdvertisingBlockStatus.EXPIRED;
  return AdvertisingBlockStatus.ACTIVE;
}

test("deriveBlockStatus marks future term as scheduled", () => {
  const startsAt = new Date("2026-08-01T00:00:00.000Z");
  const endsAt = new Date("2026-09-01T00:00:00.000Z");
  const now = new Date("2026-07-15T00:00:00.000Z");
  assert.equal(deriveBlockStatus(startsAt, endsAt, now), AdvertisingBlockStatus.SCHEDULED);
});

test("deriveBlockStatus marks in-window term as active", () => {
  const startsAt = new Date("2026-07-01T00:00:00.000Z");
  const endsAt = new Date("2026-08-01T00:00:00.000Z");
  const now = new Date("2026-07-15T00:00:00.000Z");
  assert.equal(deriveBlockStatus(startsAt, endsAt, now), AdvertisingBlockStatus.ACTIVE);
});

test("deriveBlockStatus marks ended term as expired", () => {
  const startsAt = new Date("2026-06-01T00:00:00.000Z");
  const endsAt = new Date("2026-07-01T00:00:00.000Z");
  const now = new Date("2026-07-15T00:00:00.000Z");
  assert.equal(deriveBlockStatus(startsAt, endsAt, now), AdvertisingBlockStatus.EXPIRED);
});

test("deriveBlockStatus treats exact end as expired", () => {
  const startsAt = new Date("2026-06-01T00:00:00.000Z");
  const endsAt = new Date("2026-07-01T00:00:00.000Z");
  const now = new Date("2026-07-01T00:00:00.000Z");
  assert.equal(deriveBlockStatus(startsAt, endsAt, now), AdvertisingBlockStatus.EXPIRED);
});
