import test from "node:test";
import assert from "node:assert/strict";
import { resolveShakeoutPublicHost } from "./shakeout-public-host";

test("staff shakeout defaults to associated brand, not a person", () => {
  const host = resolveShakeoutPublicHost({
    cityRunType: "RACE_SHAKEOUT",
    shakeoutSponsorName: "lululemon",
    shakeoutClubName: "Northeast Track Club",
  });
  assert.deepEqual(host, { name: "lululemon", logoUrl: null, kind: "brand" });
});

test("Make host club wins over brand default", () => {
  const host = resolveShakeoutPublicHost({
    cityRunType: "RACE_SHAKEOUT",
    organizerType: "club",
    runClub: { name: "Northeast Track Club", logoUrl: null },
    shakeoutSponsorName: "lululemon",
  });
  assert.equal(host?.kind, "club");
  assert.equal(host?.name, "Northeast Track Club");
});

test("returns null when staff never associated a brand or club", () => {
  const host = resolveShakeoutPublicHost({
    cityRunType: "RACE_SHAKEOUT",
  });
  assert.equal(host, null);
});
