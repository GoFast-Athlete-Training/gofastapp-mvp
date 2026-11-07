import assert from "node:assert/strict";
import test from "node:test";
import {
  CLUB_RUN_AUTO_ADVANCE_ENV,
  isClubRunAutoAdvanceEnabled,
} from "./club-run-auto-advance";

test("isClubRunAutoAdvanceEnabled is always on", () => {
  assert.equal(isClubRunAutoAdvanceEnabled(), true);
});
