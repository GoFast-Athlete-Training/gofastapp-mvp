import assert from "node:assert/strict";
import test from "node:test";
import {
  athleteRunnerPublicUrl,
  normalizeLinkUrlForCompare,
  presetLinkForId,
} from "./athlete-runner-public-links";

test("presetLinkForId builds runner landing subpaths", () => {
  const story = presetLinkForId("story", "adamcole");
  assert.match(story.url, /adamcole\/story$/);
  assert.equal(story.title, "Runner story");
});

test("normalizeLinkUrlForCompare strips trailing slash", () => {
  assert.equal(
    normalizeLinkUrlForCompare("https://example.com/foo/"),
    normalizeLinkUrlForCompare("https://example.com/foo"),
  );
});

test("athleteRunnerPublicUrl joins segment", () => {
  const url = athleteRunnerPublicUrl("handle", "reflections");
  assert.match(url, /handle\/reflections$/);
});
