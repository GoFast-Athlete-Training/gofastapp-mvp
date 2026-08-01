import assert from "node:assert/strict";
import test from "node:test";
import { validateCandidatePurchaseIdentity } from "./candidate-service";
import {
  SponsorshipCandidateStatus,
  SponsorshipCandidateType,
} from "@prisma/client";

test("validateCandidatePurchaseIdentity accepts matching eligible athlete", () => {
  const ok = validateCandidatePurchaseIdentity(
    {
      id: "c1",
      code: "GFA-TEST1234",
      status: SponsorshipCandidateStatus.ELIGIBLE,
      candidateType: SponsorshipCandidateType.ATHLETE,
    },
    "c1",
    "GFA-TEST1234",
  );
  assert.equal(ok, true);
});

test("validateCandidatePurchaseIdentity rejects code mismatch", () => {
  const ok = validateCandidatePurchaseIdentity(
    {
      id: "c1",
      code: "GFA-TEST1234",
      status: SponsorshipCandidateStatus.ELIGIBLE,
      candidateType: SponsorshipCandidateType.ATHLETE,
    },
    "c1",
    "GFA-WRONG",
  );
  assert.equal(ok, false);
});
