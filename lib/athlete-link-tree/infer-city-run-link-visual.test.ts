import assert from "node:assert/strict";
import test from "node:test";
import { inferCityRunLinkVisual } from "./infer-city-run-link-visual";

test("inferCityRunLinkVisual prefers map image over default emoji", () => {
  const result = inferCityRunLinkVisual({
    mapImageUrl: "https://cdn.example/map.png",
    routePhotos: ["https://cdn.example/route.jpg"],
  });
  assert.equal(result.linkLogoUrl, "https://cdn.example/map.png");
  assert.equal(result.emoji, null);
});

test("inferCityRunLinkVisual uses route photo when no map", () => {
  const result = inferCityRunLinkVisual({
    routePhotos: ["https://cdn.example/monument.jpg"],
  });
  assert.equal(result.linkLogoUrl, "https://cdn.example/monument.jpg");
  assert.equal(result.emoji, null);
});

test("inferCityRunLinkVisual defaults to run emoji", () => {
  const result = inferCityRunLinkVisual({});
  assert.equal(result.linkLogoUrl, null);
  assert.equal(result.emoji, "🏃");
});

test("inferCityRunLinkVisual uses profile emoji when no photo", () => {
  const result = inferCityRunLinkVisual({ profileEmoji: "🎂" });
  assert.equal(result.linkLogoUrl, null);
  assert.equal(result.emoji, "🎂");
});

test("inferCityRunLinkVisual prefers map over profile emoji", () => {
  const result = inferCityRunLinkVisual({
    mapImageUrl: "https://cdn.example/map.png",
    profileEmoji: "🎂",
  });
  assert.equal(result.linkLogoUrl, "https://cdn.example/map.png");
  assert.equal(result.emoji, null);
});
