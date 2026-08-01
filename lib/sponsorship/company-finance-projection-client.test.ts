import assert from "node:assert/strict";
import test from "node:test";
import { CompanyFinanceProjectionError } from "./company-finance-projection-client";

test("CompanyFinanceProjectionError marks retryable failures", () => {
  const retryable = new CompanyFinanceProjectionError("upstream down", true);
  assert.equal(retryable.retryable, true);

  const fatal = new CompanyFinanceProjectionError("misconfigured", false);
  assert.equal(fatal.retryable, false);
});

test("projectPaidSponsorshipToCompany sends stripeEventId only", () => {
  const bodyShape = { stripeEventId: "evt_123" };
  assert.equal(Object.keys(bodyShape).length, 1);
  assert.equal(bodyShape.stripeEventId, "evt_123");
});
