import assert from "node:assert/strict";
import test from "node:test";
import {
  isBrandPartnershipCheckoutSession,
  StripeWebhookValidationError,
  validateBrandPartnershipCheckoutSession,
  validateCommitmentAgainstCheckoutSession,
} from "./stripe-webhook-service";
import {
  SponsorCommitmentPaymentStatus,
  type sponsor_commitments,
} from "@prisma/client";
import type Stripe from "stripe";

function baseSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_test_123",
    object: "checkout.session",
    payment_status: "paid",
    amount_total: 17500,
    currency: "usd",
    metadata: {
      type: "brand_partnership",
      sponsorCommitmentId: "commit_1",
      brandId: "brand_1",
      athleteId: "athlete_1",
      pricingRuleKey: "profile-container-daily",
      pricingRuleVersion: "1",
      athleteSharePercent: "20",
      platformSharePercent: "80",
      payoutConfigKey: "athlete-destination-v1",
      payoutConfigVersion: "1",
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

function baseCommitment(overrides: Partial<sponsor_commitments> = {}): sponsor_commitments {
  return {
    id: "commit_1",
    candidateId: "cand_1",
    candidateCodeSnapshot: "abc123",
    brandId: "brand_1",
    brandUserId: "user_1",
    brandNameSnapshot: "Acme",
    brandLogoUrlSnapshot: null,
    creativeUrl: "https://example.com/ad.png",
    ctaUrl: "https://example.com",
    startsAt: new Date("2026-08-01T00:00:00.000Z"),
    endsAt: new Date("2026-08-07T00:00:00.000Z"),
    pricingRuleKey: "profile-container-daily",
    pricingRuleVersion: 1,
    pricingBreakdownJson: null,
    quotedAmountCents: 17500,
    amountPaidCents: null,
    currency: "usd",
    athleteShareCents: 3500,
    platformShareCents: 14000,
    paymentStatus: SponsorCommitmentPaymentStatus.CHECKOUT_PENDING,
    status: "DRAFT" as sponsor_commitments["status"],
    stripeCheckoutSessionId: "cs_test_123",
    stripePaymentIntentId: null,
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

test("isBrandPartnershipCheckoutSession detects brand_partnership metadata", () => {
  assert.equal(isBrandPartnershipCheckoutSession(baseSession()), true);
  assert.equal(isBrandPartnershipCheckoutSession(baseSession({ metadata: { type: "other" } })), false);
});

test("validateBrandPartnershipCheckoutSession rejects unpaid sessions", () => {
  assert.throws(
    () =>
      validateBrandPartnershipCheckoutSession(
        baseSession({ payment_status: "unpaid" }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof StripeWebhookValidationError);
      assert.match((error as Error).message, /not paid/i);
      return true;
    },
  );
});

test("validateBrandPartnershipCheckoutSession requires sponsorCommitmentId", () => {
  assert.throws(
    () =>
      validateBrandPartnershipCheckoutSession(
        baseSession({ metadata: { type: "brand_partnership" } }),
      ),
    /Missing sponsorCommitmentId/,
  );
});

test("validateCommitmentAgainstCheckoutSession rejects session id mismatch", () => {
  assert.throws(
    () =>
      validateCommitmentAgainstCheckoutSession(
        baseCommitment({ stripeCheckoutSessionId: "cs_other" }),
        baseSession(),
      ),
    /session id mismatch/i,
  );
});

test("validateCommitmentAgainstCheckoutSession rejects amount mismatch", () => {
  assert.throws(
    () =>
      validateCommitmentAgainstCheckoutSession(
        baseCommitment({ quotedAmountCents: 10000 }),
        baseSession(),
      ),
    /amount does not match/i,
  );
});

test("validateCommitmentAgainstCheckoutSession rejects currency mismatch", () => {
  assert.throws(
    () =>
      validateCommitmentAgainstCheckoutSession(
        baseCommitment({ currency: "eur" }),
        baseSession(),
      ),
    /currency does not match/i,
  );
});

test("validateCommitmentAgainstCheckoutSession allows CHECKOUT_PENDING and PAID", () => {
  assert.doesNotThrow(() =>
    validateCommitmentAgainstCheckoutSession(baseCommitment(), baseSession()),
  );
  assert.doesNotThrow(() =>
    validateCommitmentAgainstCheckoutSession(
      baseCommitment({ paymentStatus: SponsorCommitmentPaymentStatus.PAID }),
      baseSession(),
    ),
  );
});

test("validateCommitmentAgainstCheckoutSession rejects invalid payment status", () => {
  assert.throws(
    () =>
      validateCommitmentAgainstCheckoutSession(
        baseCommitment({ paymentStatus: SponsorCommitmentPaymentStatus.FAILED }),
        baseSession(),
      ),
    /cannot be finalized/i,
  );
});

test("handleBrandPartnershipCheckoutCompleted ignores non-partnership sessions", async () => {
  const { handleBrandPartnershipCheckoutCompleted } = await import("./stripe-webhook-service");
  const result = await handleBrandPartnershipCheckoutCompleted(
    { id: "evt_1", type: "checkout.session.completed" } as Stripe.Event,
    baseSession({ metadata: { type: "legacy_plan" } }),
  );
  assert.deepEqual(result, { handled: false, newlyActivated: false });
});
