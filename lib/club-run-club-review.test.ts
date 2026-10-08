import assert from "node:assert/strict";
import test from "node:test";
import { assertClubRunVerifiedForPublish } from "./club-run-club-review";

test("CLUB runs require verified clubReviewStatus to publish", () => {
  assert.equal(
    assertClubRunVerifiedForPublish({ cityRunType: "CLUB", clubReviewStatus: "draft" }).ok,
    false
  );
  assert.equal(
    assertClubRunVerifiedForPublish({ cityRunType: "CLUB", clubReviewStatus: "pending_club_review" })
      .ok,
    false
  );
  assert.equal(
    assertClubRunVerifiedForPublish({ cityRunType: "CLUB", clubReviewStatus: "verified" }).ok,
    true
  );
});

test("non-CLUB runs ignore clubReviewStatus for publish gate", () => {
  assert.equal(
    assertClubRunVerifiedForPublish({ cityRunType: "RACE_SHAKEOUT", clubReviewStatus: "draft" }).ok,
    true
  );
});
