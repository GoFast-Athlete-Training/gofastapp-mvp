import test from "node:test";
import assert from "node:assert/strict";
import { fillMissingRunBrandStampFromCatalog } from "./run-brand-stamp";

test("fills an empty logo from the prod brand snap", () => {
  const filled = fillMissingRunBrandStampFromCatalog(
    { runBrandId: "brand-1", runBrandName: "lululemon", runBrandLogoUrl: null },
    {
      name: "lululemon",
      logoUrl: "https://cdn.example/lulu.png",
      websiteUrl: "https://lululemon.com",
      instagramHandle: "lululemon",
    },
  );
  assert.equal(filled.runBrandLogoUrl, "https://cdn.example/lulu.png");
  assert.equal(filled.runBrandWebsiteUrl, "https://lululemon.com");
});

test("does not overwrite a stamp that already has a logo", () => {
  const filled = fillMissingRunBrandStampFromCatalog(
    { runBrandLogoUrl: "https://stamp.example/logo.png" },
    { name: "lululemon", logoUrl: "https://cdn.example/lulu.png" },
  );
  assert.equal(filled.runBrandLogoUrl, "https://stamp.example/logo.png");
});
