import assert from "node:assert/strict";
import test from "node:test";
import {
  toCandidatePublicFields,
  validateCandidatePurchaseIdentity,
  type CandidatePublicFields,
} from "./candidate-service";
import { AdvertisingCandidateStatus, AdvertisingCandidateType } from "@prisma/client";

test("toCandidatePublicFields maps minimal public candidate shape", () => {
  const row = {
    id: "cand-1",
    code: "GFA-ABC12345",
    candidateType: AdvertisingCandidateType.ATHLETE,
    athleteId: "athlete-1",
    status: AdvertisingCandidateStatus.ELIGIBLE,
    displayLabel: "Sarah Chen",
    photoUrl: "https://example.com/photo.jpg",
    publicSlugSnapshot: "sarah-runs-dc",
    eligibleAt: new Date(),
    pausedAt: null,
    retiredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const publicFields: CandidatePublicFields = toCandidatePublicFields(row);

  assert.equal(publicFields.id, "cand-1");
  assert.equal(publicFields.code, "GFA-ABC12345");
  assert.equal(publicFields.athleteId, "athlete-1");
  assert.equal(publicFields.displayLabel, "Sarah Chen");
  assert.equal(publicFields.publicSlug, "sarah-runs-dc");
  assert.equal(publicFields.status, AdvertisingCandidateStatus.ELIGIBLE);
});

test("candidate purchase codes use GFA prefix", () => {
  const code = "GFA-TESTCODE";
  assert.match(code, /^GFA-[A-Z0-9_-]+$/);
});

test("validateCandidatePurchaseIdentity accepts matching eligible athlete", () => {
  const candidate = {
    id: "cand-1",
    code: "GFA-ABC12345",
    status: AdvertisingCandidateStatus.ELIGIBLE,
    candidateType: AdvertisingCandidateType.ATHLETE,
  };
  assert.equal(validateCandidatePurchaseIdentity(candidate, "cand-1", "GFA-ABC12345"), true);
});

test("validateCandidatePurchaseIdentity rejects code mismatch", () => {
  const candidate = {
    id: "cand-1",
    code: "GFA-ABC12345",
    status: AdvertisingCandidateStatus.ELIGIBLE,
    candidateType: AdvertisingCandidateType.ATHLETE,
  };
  assert.equal(validateCandidatePurchaseIdentity(candidate, "cand-1", "GFA-WRONG"), false);
});

test("validateCandidatePurchaseIdentity rejects paused candidate", () => {
  const candidate = {
    id: "cand-1",
    code: "GFA-ABC12345",
    status: AdvertisingCandidateStatus.PAUSED,
    candidateType: AdvertisingCandidateType.ATHLETE,
  };
  assert.equal(validateCandidatePurchaseIdentity(candidate, "cand-1", "GFA-ABC12345"), false);
});

test("validateCandidatePurchaseIdentity rejects ineligible id", () => {
  const candidate = {
    id: "cand-1",
    code: "GFA-ABC12345",
    status: AdvertisingCandidateStatus.ELIGIBLE,
    candidateType: AdvertisingCandidateType.ATHLETE,
  };
  assert.equal(validateCandidatePurchaseIdentity(candidate, "cand-other", "GFA-ABC12345"), false);
});
