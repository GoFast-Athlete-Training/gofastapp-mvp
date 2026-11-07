import test from "node:test";
import assert from "node:assert/strict";
import { AthleteLinkTreeLinkKind } from "@prisma/client";
import { linkIdsForAthleteTreeDelete } from "./link-tree-blocks";
import { charityLinkInternalDescription, linkIdForCharityRaceRegistry } from "./link-tree-charity";
import type { AthleteLinkTreeLink } from "../content/athlete-link-tree-types";

test("linkIdsForAthleteTreeDelete section includes children with parentSectionId", () => {
  const rows = [
    { id: "s1", parentSectionId: null, isSection: true },
    { id: "c1", parentSectionId: "s1", isSection: false },
    { id: "c2", parentSectionId: "s1", isSection: false },
    { id: "s2", parentSectionId: null, isSection: true },
  ];
  const ids = linkIdsForAthleteTreeDelete(rows, "s1", true);
  assert.deepEqual(new Set(ids), new Set(["s1", "c1", "c2"]));
});

test("linkIdsForAthleteTreeDelete non-section is single id", () => {
  const rows = [
    { id: "s1", parentSectionId: null, isSection: true },
    { id: "c1", parentSectionId: "s1", isSection: false },
  ];
  assert.deepEqual(linkIdsForAthleteTreeDelete(rows, "c1", false), ["c1"]);
});

test("charity tag round-trip for link lookup", () => {
  const regId = "rr-abc";
  const tag = charityLinkInternalDescription(regId);
  const links: AthleteLinkTreeLink[] = [
    {
      id: "x",
      name: "Red Cross",
      publicLabel: "Red Cross",
      internalDescription: tag,
      isSection: false,
      kind: AthleteLinkTreeLinkKind.CUSTOM,
      description: null,
      linkLogoUrl: null,
      emoji: "❤️",
      url: "https://example.org",
      athleteRaceId: null,
      cityRunId: null,
      athleteCauseId: null,
      parentSectionId: "sec",
      sortOrder: 0,
    },
  ];
  assert.equal(linkIdForCharityRaceRegistry(links, regId), "x");
});
