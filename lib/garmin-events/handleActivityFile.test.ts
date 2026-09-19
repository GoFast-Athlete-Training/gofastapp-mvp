import assert from "node:assert/strict";
import test from "node:test";
import { handleActivityFile } from "./handleActivityFile";

test("handleActivityFile skips non-FIT file types without error", async () => {
  const result = await handleActivityFile(
    [
      {
        userId: "00000000-0000-0000-0000-000000000001",
        fileType: "TCX",
        callbackURL: "https://example.com/file.tcx",
        activityId: "123",
      },
    ],
    "00000000-0000-0000-0000-000000000001"
  );

  assert.equal(result.errors, 0);
  assert.equal(result.processed, 0);
  assert.equal(result.skipped, 1);
});

test("handleActivityFile skips when callbackURL is missing", async () => {
  const result = await handleActivityFile(
    [
      {
        userId: "00000000-0000-0000-0000-000000000001",
        fileType: "FIT",
        activityId: "123",
      },
    ],
    "00000000-0000-0000-0000-000000000001"
  );

  assert.equal(result.errors, 0);
  assert.equal(result.processed, 0);
  assert.equal(result.skipped, 1);
});
