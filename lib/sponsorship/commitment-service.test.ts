import assert from "node:assert/strict";
import test from "node:test";
import { deriveRuntimeStatus } from "./commitment-service";
import { SponsorCommitmentStatus } from "@prisma/client";

test("deriveRuntimeStatus returns SCHEDULED before start", () => {
  const startsAt = new Date("2026-08-01T00:00:00.000Z");
  const endsAt = new Date("2026-08-31T00:00:00.000Z");
  const now = new Date("2026-07-15T00:00:00.000Z");
  assert.equal(deriveRuntimeStatus(startsAt, endsAt, now), SponsorCommitmentStatus.SCHEDULED);
});

test("deriveRuntimeStatus returns ACTIVE during window", () => {
  const startsAt = new Date("2026-08-01T00:00:00.000Z");
  const endsAt = new Date("2026-08-31T00:00:00.000Z");
  const now = new Date("2026-08-15T00:00:00.000Z");
  assert.equal(deriveRuntimeStatus(startsAt, endsAt, now), SponsorCommitmentStatus.ACTIVE);
});

test("deriveRuntimeStatus returns EXPIRED after end", () => {
  const startsAt = new Date("2026-08-01T00:00:00.000Z");
  const endsAt = new Date("2026-08-31T00:00:00.000Z");
  const now = new Date("2026-09-01T00:00:00.000Z");
  assert.equal(deriveRuntimeStatus(startsAt, endsAt, now), SponsorCommitmentStatus.EXPIRED);
});
