import test from "node:test";
import assert from "node:assert/strict";
import { AthleteLinkTreeLinkKind } from "@prisma/client";
import type { AthleteLinkTreeLink } from "../content/athlete-link-tree-types";
import { buildLinkTreeEditorBlocks } from "./link-tree-blocks";

function row(partial: Partial<AthleteLinkTreeLink> & { id: string }): AthleteLinkTreeLink {
  return {
    name: "x",
    publicLabel: null,
    internalDescription: null,
    isSection: false,
    kind: AthleteLinkTreeLinkKind.CUSTOM,
    description: null,
    linkLogoUrl: null,
    emoji: null,
    url: "https://example.org",
    athleteRaceId: null,
    cityRunId: null,
    athleteCauseId: "cause-1",
    parentSectionId: null,
    sortOrder: 0,
    ...partial,
  };
}

test("buildLinkTreeEditorBlocks shows links with missing section parent", () => {
  const links = [
    row({
      id: "sec",
      name: "My causes",
      isSection: true,
      athleteCauseId: null,
      sortOrder: 0,
    }),
    row({
      id: "orphan",
      name: "Ainsley",
      parentSectionId: "deleted-section",
      sortOrder: 1,
    }),
  ];
  const blocks = buildLinkTreeEditorBlocks(links);
  const rootLinks = blocks.filter((b) => b.type === "link");
  assert.equal(rootLinks.length, 1);
  assert.equal(rootLinks[0]?.type === "link" && rootLinks[0].link.id, "orphan");
});
