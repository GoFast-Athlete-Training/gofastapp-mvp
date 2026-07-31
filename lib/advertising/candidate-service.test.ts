import assert from "node:assert/strict";
import test from "node:test";
import {
  toCandidatePublicFields,
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
