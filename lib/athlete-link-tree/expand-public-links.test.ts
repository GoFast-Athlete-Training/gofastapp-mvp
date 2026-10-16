import assert from "node:assert/strict";
import test from "node:test";
import { AthleteLinkTreeLinkKind } from "@prisma/client";
import type { AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";

test("expandAthleteLinkTreeLinksForPublic passes custom links through", async () => {
  const { expandAthleteLinkTreeLinksForPublic } = await import(
    "@/lib/athlete-link-tree/expand-public-links"
  );

  const links: Array<AthleteLinkTreeLink & { kind: AthleteLinkTreeLinkKind }> = [
    {
      id: "a",
      name: "Instagram",
      publicLabel: null,
      internalDescription: null,
      isSection: false,
      kind: AthleteLinkTreeLinkKind.CUSTOM,
      description: null,
      linkLogoUrl: null,
      emoji: "📱",
      url: "https://instagram.com/runner",
      athleteRaceId: null,
      cityRunId: null,
      parentSectionId: null,
      sortOrder: 0,
    },
  ];

  const out = await expandAthleteLinkTreeLinksForPublic({
    athleteId: "athlete-no-races",
    links,
  });

  assert.equal(out.length, 1);
  assert.equal(out[0]?.url, "https://instagram.com/runner");
});
