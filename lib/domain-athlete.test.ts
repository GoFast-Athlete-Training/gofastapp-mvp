import assert from "node:assert/strict";
import test from "node:test";
import { athleteAuthSelect } from "./domain-athlete";

test("athleteAuthSelect only projects auth-safe columns", () => {
  assert.deepEqual(Object.keys(athleteAuthSelect).sort(), [
    "email",
    "firebaseId",
    "firstName",
    "id",
  ]);
  assert.equal(
    "primaryGoalNameSnapshot" in athleteAuthSelect,
    false,
    "removed snapshot columns must not be selected during auth"
  );
});
