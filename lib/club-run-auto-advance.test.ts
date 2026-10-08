import assert from "node:assert/strict";
import test from "node:test";
import {
  CLUB_RUN_AUTO_ADVANCE_ENV,
  isClubRunAutoAdvanceEnabled,
} from "./club-run-auto-advance";

test("isClubRunAutoAdvanceEnabled is false unless env is exactly true", () => {
  const prev = process.env[CLUB_RUN_AUTO_ADVANCE_ENV];
  try {
    delete process.env[CLUB_RUN_AUTO_ADVANCE_ENV];
    assert.equal(isClubRunAutoAdvanceEnabled(), false);
    process.env[CLUB_RUN_AUTO_ADVANCE_ENV] = "false";
    assert.equal(isClubRunAutoAdvanceEnabled(), false);
    process.env[CLUB_RUN_AUTO_ADVANCE_ENV] = "true";
    assert.equal(isClubRunAutoAdvanceEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env[CLUB_RUN_AUTO_ADVANCE_ENV];
    else process.env[CLUB_RUN_AUTO_ADVANCE_ENV] = prev;
  }
});
