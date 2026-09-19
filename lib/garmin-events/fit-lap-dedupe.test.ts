import assert from "node:assert/strict";
import test from "node:test";
import { fitLapStartTimesMatch } from "./dedupe";

test("fitLapStartTimesMatch treats duplicate ping lap sequence as processed", () => {
  const first = [1000, 1300, 1600];
  const duplicate = [1000, 1300, 1600];
  const changed = [1000, 1300, 1700];

  assert.equal(fitLapStartTimesMatch(first, duplicate), true);
  assert.equal(fitLapStartTimesMatch(first, changed), false);
  assert.equal(fitLapStartTimesMatch(first, [1000]), false);
});
