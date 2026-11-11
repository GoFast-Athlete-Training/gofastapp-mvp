import { normalizeCauseWebsiteUrl } from "@/lib/athlete-causes/cause-url";
import type { AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";

/** Stable marker in `internalDescription` for charity links from race_registry search. */
export const LINK_TREE_CHARITY_TAG_PREFIX = "linktree:raceRegistryCharity:";

export function charityLinkInternalDescription(raceRegistryId: string): string {
  return `${LINK_TREE_CHARITY_TAG_PREFIX}${raceRegistryId.trim()}`;
}

export function linkIdForCharityRaceRegistry(
  sortedLinks: AthleteLinkTreeLink[],
  raceRegistryId: string,
): string | null {
  const tag = charityLinkInternalDescription(raceRegistryId);
  const hit = sortedLinks.find((l) => !l.isSection && l.internalDescription?.trim() === tag);
  return hit?.id ?? null;
}

export function linkIdForAthleteCause(
  sortedLinks: AthleteLinkTreeLink[],
  athleteCauseId: string,
): string | null {
  const hit = sortedLinks.find((l) => !l.isSection && l.athleteCauseId === athleteCauseId);
  return hit?.id ?? null;
}

type CauseUrlRow = { id: string; websiteUrl: string };

/** Match catalog picker row to an on-page cause link (athleteCauseId on the link row only). */
export function linkIdForCharityPickerHit(
  sortedLinks: AthleteLinkTreeLink[],
  hit: { charityUrl: string; athleteCauseId: string | null },
  savedCauses: CauseUrlRow[],
): string | null {
  const targetUrl = normalizeCauseWebsiteUrl(hit.charityUrl);
  let causeId = hit.athleteCauseId;

  if (!causeId && targetUrl) {
    causeId =
      savedCauses.find((c) => normalizeCauseWebsiteUrl(c.websiteUrl) === targetUrl)?.id ?? null;
  }

  if (!causeId) return null;
  return linkIdForAthleteCause(sortedLinks, causeId);
}
