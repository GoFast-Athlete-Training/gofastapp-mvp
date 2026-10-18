import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeProdClubIdentityFields,
  normalizeClubIdentityName,
  normalizeReferenceUrl,
  parseClubReferenceForProd,
} from "./club-identity";

test("normalizeClubIdentityName strips run club suffix", () => {
  assert.equal(normalizeClubIdentityName("Boston Run Club"), "boston");
});

test("normalizeReferenceUrl strips www and trailing slash", () => {
  assert.equal(normalizeReferenceUrl("https://WWW.Example.com/"), "example.com");
});

test("parseClubReferenceForProd maps instagram handle", () => {
  const p = parseClubReferenceForProd("@myclub");
  assert.match(p.instagramUrl ?? "", /instagram\.com\/myclub/);
});

test("mergeProdClubIdentityFields preserves existing rich identity", () => {
  const merged = mergeProdClubIdentityFields(
    {
      name: "Legacy Name",
      city: "Boston",
      websiteUrl: "https://legacy.example",
      instagramUrl: null,
      stravaUrl: null,
      runUrl: null,
    },
    {
      name: "New Name",
      city: "Cambridge",
      websiteUrl: "https://new.example",
      instagramUrl: "https://instagram.com/x",
      stravaUrl: null,
      runUrl: null,
    },
  );
  assert.equal(merged.name, "Legacy Name");
  assert.equal(merged.city, "Boston");
  assert.equal(merged.websiteUrl, "https://legacy.example");
  assert.equal(merged.instagramUrl, "https://instagram.com/x");
});
