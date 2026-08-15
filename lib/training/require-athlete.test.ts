import assert from "node:assert/strict";
import test from "node:test";
import { resolveAthleteForVerifiedUid } from "./require-athlete";

const athlete = {
  id: "ath-1",
  firebaseId: "uid-1",
};

const lookups = {
  getAthleteById: async (id: string) => (id === athlete.id ? athlete : null),
  getAthleteByFirebaseId: async (uid: string) =>
    uid === athlete.firebaseId ? athlete : null,
};

test("matching x-athlete-id resolves by primary key", async () => {
  const result = await resolveAthleteForVerifiedUid("uid-1", "ath-1", lookups);
  assert.deepEqual(result, { athlete });
});

test("missing x-athlete-id falls back to firebaseId", async () => {
  const result = await resolveAthleteForVerifiedUid("uid-1", null, lookups);
  assert.deepEqual(result, { athlete });
});

test("mismatched x-athlete-id is rejected", async () => {
  const result = await resolveAthleteForVerifiedUid("uid-other", "ath-1", lookups);
  assert.deepEqual(result, {
    error: "Athlete session mismatch — sign out and back in",
    status: 403,
  });
});

test("unknown header athlete is not found", async () => {
  const result = await resolveAthleteForVerifiedUid("uid-1", "missing", lookups);
  assert.deepEqual(result, { error: "Athlete not found", status: 404 });
});

test("unknown firebase user is not found", async () => {
  const result = await resolveAthleteForVerifiedUid("uid-missing", null, lookups);
  assert.deepEqual(result, { error: "Athlete not found", status: 404 });
});
