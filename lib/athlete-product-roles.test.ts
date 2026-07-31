import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAthleteProductRole } from "./athlete-product-roles";

describe("athlete-product-roles", () => {
  it("accepts CLUB_LEADER and AMBASSADOR only", () => {
    assert.equal(isAthleteProductRole("CLUB_LEADER"), true);
    assert.equal(isAthleteProductRole("AMBASSADOR"), true);
    assert.equal(isAthleteProductRole("USER"), false);
  });
});
