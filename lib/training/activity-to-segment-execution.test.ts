import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("recordAlignmentFailure does not clear segment execution on miss", () => {
  const path = fileURLToPath(new URL("./activity-to-segment-execution.ts", import.meta.url));
  const src = readFileSync(path, "utf8");
  const fnMatch = src.match(
    /async function recordAlignmentFailure[\s\S]*?\n\}/
  );
  assert.ok(fnMatch, "recordAlignmentFailure should exist");
  assert.doesNotMatch(
    fnMatch[0]!,
    /clearWorkoutSegmentExecution/,
    "failed assign must not wipe existing actuals or paceDelta"
  );
});
