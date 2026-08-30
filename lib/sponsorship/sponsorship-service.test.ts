import assert from "node:assert/strict";
import test from "node:test";
import { extractCpmAmountFromBreakdown } from "./pricing-breakdown";
import { deriveSponsorshipDeliveryStatus } from "./sponsorship-service";
import { SponsorshipDeliveryStatus } from "@prisma/client";

test("extractCpmAmountFromBreakdown reads impressionQty from quote breakdown", () => {
  assert.equal(
    extractCpmAmountFromBreakdown({ impressionQty: 500, packs: 5 }),
    500,
  );
  assert.equal(extractCpmAmountFromBreakdown(null), 0);
});

test("deriveSponsorshipDeliveryStatus returns LIVE during window", () => {
  const startsAt = new Date("2026-08-01T00:00:00.000Z");
  const endsAt = new Date("2026-08-31T00:00:00.000Z");
  const now = new Date("2026-08-15T00:00:00.000Z");
  assert.equal(
    deriveSponsorshipDeliveryStatus(startsAt, endsAt, now),
    SponsorshipDeliveryStatus.LIVE,
  );
});

test("deriveSponsorshipDeliveryStatus returns FINISHED after end", () => {
  const startsAt = new Date("2026-08-01T00:00:00.000Z");
  const endsAt = new Date("2026-08-31T00:00:00.000Z");
  const now = new Date("2026-09-01T00:00:00.000Z");
  assert.equal(
    deriveSponsorshipDeliveryStatus(startsAt, endsAt, now),
    SponsorshipDeliveryStatus.FINISHED,
  );
});
