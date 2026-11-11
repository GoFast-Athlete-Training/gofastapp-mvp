import test from "node:test";
import assert from "node:assert/strict";
import { AthleteLinkTreeLinkKind } from "@prisma/client";
import type { AthleteLinkTreeLink } from "../content/athlete-link-tree-types";
import { linkIdForAthleteCause, linkIdForCharityPickerHit } from "./link-tree-charity";

function link(partial: Partial<AthleteLinkTreeLink> & { id: string }): AthleteLinkTreeLink {
  return {
    name: "Cause",
    publicLabel: "Cause",
    internalDescription: null,
    isSection: false,
    kind: AthleteLinkTreeLinkKind.CUSTOM,
    description: null,
    linkLogoUrl: null,
    emoji: null,
    url: "https://example.org",
    athleteRaceId: null,
    cityRunId: null,
    athleteCauseId: null,
    parentSectionId: null,
    sortOrder: 0,
    ...partial,
  };
}

test("linkIdForCharityPickerHit requires athleteCauseId on link row", () => {
  const causeId = "cause-1";
  const links = [
    link({
      id: "url-only",
      url: "https://ainsleysangels.org",
      athleteCauseId: null,
    }),
    link({
      id: "real",
      url: "https://ainsleysangels.org",
      athleteCauseId: causeId,
    }),
  ];
  const saved = [{ id: causeId, websiteUrl: "https://ainsleysangels.org" }];

  assert.equal(
    linkIdForCharityPickerHit(
      links,
      { charityUrl: "https://ainsleysangels.org", athleteCauseId: causeId },
      saved,
    ),
    "real",
  );
  assert.equal(linkIdForAthleteCause(links, causeId), "real");
});

test("linkIdForCharityPickerHit does not match custom URL-only links", () => {
  const links = [
    link({
      id: "custom",
      url: "https://ainsleysangels.org",
      athleteCauseId: null,
    }),
  ];
  const saved = [{ id: "cause-1", websiteUrl: "https://ainsleysangels.org" }];

  assert.equal(
    linkIdForCharityPickerHit(
      links,
      { charityUrl: "https://ainsleysangels.org", athleteCauseId: null },
      saved,
    ),
    null,
  );
});
