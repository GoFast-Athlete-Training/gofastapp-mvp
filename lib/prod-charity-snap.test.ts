import test from "node:test";
import assert from "node:assert/strict";
import { upsertProdCharitySnap } from "./prod-charity-snap";

test("upsertProdCharitySnap rejects missing id or name", async () => {
  const a = await upsertProdCharitySnap({ charityId: "", name: "Test" });
  assert.equal(a.ok, false);
  const b = await upsertProdCharitySnap({ charityId: "abc", name: "" });
  assert.equal(b.ok, false);
});
