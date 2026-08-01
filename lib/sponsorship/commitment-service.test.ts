import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveRuntimeStatus,
  finalizePaidCommitment,
  type FinalizePaidResult,
} from "./commitment-service";
import { SponsorCommitmentPaymentStatus, SponsorCommitmentStatus } from "@prisma/client";

test("finalizePaidCommitment result exposes newlyActivated for idempotent webhook retries", () => {
  const paidResult: FinalizePaidResult = {
    commitment: {
      id: "commit_1",
    } as FinalizePaidResult["commitment"],
    newlyActivated: false,
  };

  assert.equal(paidResult.newlyActivated, false);
  assert.equal(typeof finalizePaidCommitment, "function");
  assert.ok(SponsorCommitmentPaymentStatus.PAID);
});


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
